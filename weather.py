#!/usr/bin/env python3
"""San Diego outdoor sports weather checker."""

import datetime
import os
import sys

import requests

MPH_TO_KNOTS = 0.868976
CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
OWM_BASE = "https://api.openweathermap.org/data/2.5"
BURNOFF_CLOUD_THRESHOLD = 30
BURNOFF_CUTOFF_HOUR = 14

AREAS = {
    "wingfoil": {
        "name":       "Wingfoil — Fiesta Island (Mission Bay)",
        "lat":        32.7697,
        "lon":       -117.2217,
        "activity":   "wingfoil",
        "wind_ideal": (12, 25),
        "wind_dirs":  ["W", "SW", "NW"],
    },
    "efoil": {
        "name":       "Efoil / Paddleboard — Shelter Island",
        "lat":        32.7208,
        "lon":       -117.2284,
        "activity":   "efoil",
        "wind_ideal": (0, 10),
        "wind_dirs":  [],
    },
    "bike": {
        "name":       "Road Bike — Cabrillo Memorial Dr / Point Loma",
        "lat":        32.6735,
        "lon":       -117.2422,
        "activity":   "bike",
        "wind_ideal": (0, 15),
        "wind_dirs":  [],
    },
}


def get_api_key():
    key = os.environ.get("OPENWEATHER_API_KEY", "")
    if not key:
        print("Error: OPENWEATHER_API_KEY environment variable not set.")
        print("  export OPENWEATHER_API_KEY=your_key_here")
        sys.exit(1)
    return key


def mph_to_knots(mph):
    return mph * MPH_TO_KNOTS


def degrees_to_cardinal(deg):
    return CARDINALS[int((deg + 22.5) / 45) % 8]


def fetch_current(lat, lon, api_key):
    url = f"{OWM_BASE}/weather"
    params = {"lat": lat, "lon": lon, "units": "imperial", "appid": api_key}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching current weather: {e}")
        sys.exit(1)
    return r.json()


def fetch_forecast(lat, lon, api_key):
    url = f"{OWM_BASE}/forecast"
    params = {"lat": lat, "lon": lon, "units": "imperial", "cnt": 16, "appid": api_key}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching forecast: {e}")
        sys.exit(1)
    return r.json().get("list", [])


def parse_current(raw):
    wind = raw.get("wind", {})
    main = raw.get("main", {})
    wind_mph = wind.get("speed", 0)
    gust_mph = wind.get("gust")
    wind_deg = wind.get("deg", 0)
    visibility_m = raw.get("visibility", 0)
    return {
        "wind_knots":    round(mph_to_knots(wind_mph), 1),
        "wind_cardinal": degrees_to_cardinal(wind_deg),
        "wind_deg":      wind_deg,
        "gust_knots":    round(mph_to_knots(gust_mph), 1) if gust_mph is not None else None,
        "temp_f":        main.get("temp", 0),
        "feels_like_f":  main.get("feels_like", 0),
        "cloud_pct":     raw.get("clouds", {}).get("all", 0),
        "visibility_mi": round(visibility_m / 1609.34, 1) if visibility_m else None,
        "description":   raw.get("weather", [{}])[0].get("description", ""),
    }


def parse_forecast(slots):
    result = []
    for slot in slots:
        dt = slot.get("dt", 0)
        slot_dt = datetime.datetime.fromtimestamp(dt)
        result.append({
            "dt":        dt,
            "hour":      slot_dt.strftime("%-I %p"),
            "cloud_pct": slot.get("clouds", {}).get("all", 0),
            "temp_f":    slot.get("main", {}).get("temp", 0),
        })
    return result


def estimate_burnoff(current, forecast_slots):
    if current["cloud_pct"] < BURNOFF_CLOUD_THRESHOLD:
        return f"Already clearing ({current['cloud_pct']}% cloud cover)"
    now = datetime.datetime.now()
    for slot in forecast_slots:
        slot_dt = datetime.datetime.fromtimestamp(slot["dt"])
        if slot_dt <= now:
            continue
        if slot_dt.hour >= BURNOFF_CUTOFF_HOUR:
            break
        if slot["cloud_pct"] < BURNOFF_CLOUD_THRESHOLD:
            return f"~{slot['hour']} (clouds drop to {slot['cloud_pct']}% around then)"
    return "Marine layer may persist past 2 PM"


def recommend(area_cfg, current):
    activity = area_cfg["activity"]
    wind = current["wind_knots"]
    direction = current["wind_cardinal"]
    cloud = current["cloud_pct"]
    wind_min, wind_max = area_cfg["wind_ideal"]
    allowed_dirs = area_cfg["wind_dirs"]

    if activity == "wingfoil":
        dir_ok = not allowed_dirs or direction in allowed_dirs
        speed_ok = wind_min <= wind <= wind_max
        near_boundary = abs(wind - wind_min) <= 3 or abs(wind - wind_max) <= 3
        if speed_ok and dir_ok:
            return ("GO", f"Wind {wind} kts from {direction} — within ideal {wind_min}–{wind_max} kt range, direction optimal.")
        if speed_ok and not dir_ok:
            return ("WAIT", f"Wind speed {wind} kts is good but direction {direction} is not ideal (want W/SW/NW).")
        if near_boundary:
            return ("WAIT", f"Wind {wind} kts — borderline for {wind_min}–{wind_max} kt ideal range.")
        if wind > wind_max + 5:
            return ("NO-GO", f"Wind {wind} kts — too strong, above safe limit of {wind_max + 5} kts.")
        return ("NO-GO", f"Wind {wind} kts — outside ideal {wind_min}–{wind_max} kt range.")

    if activity == "efoil":
        if wind < 10:
            return ("GO", f"Wind {wind} kts — calm enough for efoil/paddleboard.")
        if wind < 15:
            return ("WAIT", f"Wind {wind} kts — marginal; ideally under 10 kts for flat water.")
        return ("NO-GO", f"Wind {wind} kts — too rough for efoil/paddleboard.")

    if activity == "bike":
        now_hour = datetime.datetime.now().hour
        marine_layer = cloud >= 50 and now_hour < 10
        if wind >= 20:
            return ("NO-GO", f"Wind {wind} kts — unsafe on exposed Point Loma peninsula.")
        if marine_layer:
            return ("WAIT", f"Marine layer present ({cloud}% clouds) — wait for burn-off before heading out.")
        if wind < 15 and cloud < 40:
            return ("GO", f"Wind {wind} kts from {direction}, {cloud}% clouds — good conditions on the peninsula.")
        return ("WAIT", f"Wind {wind} kts from {direction} — manageable but check direction on the exposed loop.")

    return ("GO", "")


def print_area(area_key, area_cfg, current, burnoff):
    width = 60
    print("=" * width)
    print(f" {area_cfg['name']}")
    print("=" * width)

    gust_str = f" (gust {current['gust_knots']} kts)" if current["gust_knots"] else ""
    print(f"  Wind:        {current['wind_knots']} kts from {current['wind_cardinal']}{gust_str}")
    print(f"  Temp:        {current['temp_f']:.0f}°F  (feels like {current['feels_like_f']:.0f}°F)")

    vis_str = f"   Visibility: {current['visibility_mi']} mi" if current["visibility_mi"] is not None else ""
    print(f"  Cloud cover: {current['cloud_pct']}%{vis_str}")
    print(f"  Conditions:  {current['description']}")

    print()
    print(f"  Marine layer burn-off: {burnoff}")

    verdict, reason = recommend(area_cfg, current)
    print()
    print(f"  Verdict: {verdict}")
    print(f"  Reason:  {reason}")
    print("-" * width)


def cmd_all(api_key):
    for area_key, area_cfg in AREAS.items():
        raw_current = fetch_current(area_cfg["lat"], area_cfg["lon"], api_key)
        raw_forecast = fetch_forecast(area_cfg["lat"], area_cfg["lon"], api_key)
        current = parse_current(raw_current)
        forecast_slots = parse_forecast(raw_forecast)
        burnoff = estimate_burnoff(current, forecast_slots)
        print_area(area_key, area_cfg, current, burnoff)
        print()


def cmd_area(area_key, api_key):
    area_cfg = AREAS[area_key]
    raw_current = fetch_current(area_cfg["lat"], area_cfg["lon"], api_key)
    raw_forecast = fetch_forecast(area_cfg["lat"], area_cfg["lon"], api_key)
    current = parse_current(raw_current)
    forecast_slots = parse_forecast(raw_forecast)
    burnoff = estimate_burnoff(current, forecast_slots)
    print_area(area_key, area_cfg, current, burnoff)


def usage():
    print("Usage: python3 weather.py [area]")
    print("\nAreas:")
    for key, cfg in AREAS.items():
        print(f"  {key:<12} {cfg['name']}")
    print("\nWith no argument, shows all areas.")
    print("\nSetup:")
    print("  export OPENWEATHER_API_KEY=your_key_here")
    print("  pip install requests")


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        usage()
        sys.exit(0)

    api_key = get_api_key()

    if len(sys.argv) == 1:
        cmd_all(api_key)
        return

    area_key = sys.argv[1].lower()
    if area_key not in AREAS:
        print(f"Unknown area: {area_key}")
        usage()
        sys.exit(1)

    cmd_area(area_key, api_key)


if __name__ == "__main__":
    main()
