#!/usr/bin/env python3
# Naval & Air Traffic Tracker — NAS North Island / Point Loma, San Diego
#
# Setup:
#   pip install requests websockets
#   export ADSB_API_KEY="your-uuid"        # adsbexchange.com -> API tab
#   export AISSTREAM_API_KEY="your-key"    # aisstream.io -> GitHub login -> Dashboard
#
# Usage:
#   python traffic.py                      # one-shot query
#   python traffic.py --watch 30           # refresh every 30 seconds
#   python traffic.py --watch 30 --notify  # + desktop notification on rare contacts

import argparse
import asyncio
import json
import math
import os
import platform
import subprocess
import sys
from datetime import datetime

import requests
import websockets

LAT, LON = 32.6935, -117.1880
RADIUS_NM = 20
BOX_DEG = 0.33
VESSEL_TIMEOUT = 5.0

ADSB_URL = "https://adsbexchange.com/api/aircraft/v2/lat/{lat}/lon/{lon}/dist/{dist}/"
AIS_URL = "wss://stream.aisstream.io/v0/stream"

AC_CATS = {
    "A0": "?", "A1": "GA-S", "A2": "GA-L", "A3": "Jet", "A4": "HighPerf",
    "A5": "Heli", "A6": "Glider", "A7": "UAV", "B0": "Balloon",
    "B1": "Para", "B4": "UAV", "C0": "Ground", "C1": "Emergency",
}

VESSEL_TYPES = {
    0: "Unknown", 1: "Reserved", 2: "WIG", 3: "Vessel", 4: "HSC",
    5: "Special", 6: "Passenger", 7: "Cargo", 8: "Tanker", 9: "Other",
    35: "Warship",
}

# ICAO type codes for aircraft worth a shout
RARE_AC_TYPES = {
    "E2", "E2C", "E2D",              # Hawkeye AEW
    "E3", "E6", "E7", "E8",          # AWACS / TACAMO / Wedgetail / JSTARS
    "P8", "P3",                      # Maritime patrol
    "F18", "F/A18", "FA18", "F35",   # Strike fighters
    "F16", "F15", "F22",
    "C17", "C5", "C130", "C2",       # Lift
    "B52", "B1", "B2",               # Bombers
    "V22", "MV22", "CV22",           # Osprey
    "H60", "MH60", "SH60", "UH60",   # Seahawk/Blackhawk
    "H53", "CH53", "MH53",           # Super Stallion
    "H1", "UH1", "AH1",              # Huey/Cobra
    "KC130", "KC135", "KC10", "KC46",  # Tankers
    "U2", "SR71", "RQ4",             # ISR
}

# Vessel prefixes that mark interesting hulls (US Navy, MSC)
RARE_VESSEL_PREFIXES = ("USS ", "USNS ")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Naval & air traffic tracker")
    p.add_argument("--watch", type=int, metavar="SECS", default=0,
                   help="refresh every N seconds (default: one-shot)")
    p.add_argument("--notify", action="store_true",
                   help="desktop notification when rare contacts appear")
    return p.parse_args()


def get_config() -> tuple:
    return os.environ.get("ADSB_API_KEY", ""), os.environ.get("AISSTREAM_API_KEY", "")


def haversine_nm(lat1, lon1, lat2, lon2) -> float:
    R_NM = 3440.065
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R_NM * math.asin(math.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def compass(deg) -> str:
    if not isinstance(deg, (int, float)):
        return "?"
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[int((deg + 22.5) // 45) % 8]


def _dist_brg_str(dist, brg) -> str:
    if not isinstance(dist, (int, float)) or not isinstance(brg, (int, float)):
        return "     ? nm  @   ?°    "
    return f"{dist:5.1f} nm @ {int(brg):3d}° ({compass(brg):>2})"


def notify(title: str, message: str) -> None:
    try:
        sysname = platform.system()
        if sysname == "Darwin":
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(["osascript", "-e", script], timeout=5, check=False)
        elif sysname == "Linux":
            subprocess.run(["notify-send", title, message], timeout=5, check=False)
        elif sysname == "Windows":
            ps = (
                f'[reflection.assembly]::loadwithpartialname("System.Windows.Forms") | Out-Null;'
                f'[System.Windows.Forms.MessageBox]::Show("{message}","{title}")'
            )
            subprocess.run(["powershell", "-Command", ps], timeout=5, check=False)
    except Exception:
        pass


def _sync_adsb_get(api_key: str) -> list:
    try:
        url = ADSB_URL.format(lat=LAT, lon=LON, dist=RADIUS_NM)
        r = requests.get(url, headers={"api-auth": api_key}, timeout=10)
        r.raise_for_status()
        return r.json().get("ac") or []
    except Exception as exc:
        print(f"[AIR] Warning: {exc}", file=sys.stderr)
        return []


async def fetch_aircraft(api_key: str) -> list:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_adsb_get, api_key)


def filter_aircraft(raw: list) -> list:
    out = []
    for ac in raw:
        alt = ac.get("alt_baro")
        is_mil = ac.get("mil") == 1 or ac.get("MIL") == 1
        if is_mil:
            out.append(ac)
            continue
        if alt == "ground" or (isinstance(alt, (int, float)) and alt < 100):
            continue
        out.append(ac)
    return out


def enrich_aircraft(planes: list) -> None:
    for p in planes:
        lat, lon = p.get("lat"), p.get("lon")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            p["_dist"] = haversine_nm(LAT, LON, lat, lon)
            p["_brg"] = bearing_deg(LAT, LON, lat, lon)


def is_rare_aircraft(ac: dict) -> bool:
    t = (ac.get("t") or "").upper().replace("-", "").replace(" ", "")
    return t in RARE_AC_TYPES


def format_aircraft(planes: list) -> str:
    if not planes:
        return "[AIR] No data — set ADSB_API_KEY or check network"

    def sort_key(ac):
        is_mil = ac.get("mil") == 1 or ac.get("MIL") == 1
        rare = is_rare_aircraft(ac)
        d = ac.get("_dist", 999)
        return (0 if rare else 1, 0 if is_mil else 1, d)

    planes = sorted(planes, key=sort_key)
    lines = [f"=== AIR TRAFFIC ({RADIUS_NM} nm) — {len(planes)} contacts ==="]
    for ac in planes:
        is_mil = ac.get("mil") == 1 or ac.get("MIL") == 1
        rare = is_rare_aircraft(ac)
        if rare:
            tag = "[*** ]"
        elif is_mil:
            tag = "[MIL ]"
        else:
            tag = "     "
        call = (ac.get("flight") or ac.get("hex") or "?").strip().ljust(8)
        t = (ac.get("t") or "").strip()
        cat_label = AC_CATS.get(ac.get("category", ""), "?")
        type_str = (t or cat_label).ljust(6)
        alt = ac.get("alt_baro", "?")
        alt_str = f"{int(alt):6d} ft" if isinstance(alt, (int, float)) else "  ground "
        spd = ac.get("gs", 0)
        spd_str = f"{int(spd):4d} kt" if isinstance(spd, (int, float)) else "   ? kt"
        hdg = ac.get("track", ac.get("true_heading", "?"))
        hdg_str = f"hdg {int(hdg):3d}°" if isinstance(hdg, (int, float)) else "hdg   ?°"
        db = _dist_brg_str(ac.get("_dist"), ac.get("_brg"))
        lines.append(f"{tag} {call} {type_str} {alt_str}  {spd_str}  {hdg_str}  {db}")
    return "\n".join(lines)


def _vessel_type_label(code) -> str:
    if not isinstance(code, int):
        return "Unknown"
    return VESSEL_TYPES.get(code) or VESSEL_TYPES.get(code // 10, "Other")


def _normalize_vessel(msg: dict) -> dict:
    meta = msg.get("MetaData", {})
    body = msg.get("Message", {})
    pos = (
        body.get("PositionReport")
        or body.get("StandardClassBPositionReport")
        or body.get("ExtendedClassBPositionReport")
        or {}
    )
    static = body.get("ShipStaticData") or {}
    return {
        "mmsi": meta.get("MMSI", ""),
        "name": meta.get("ShipName", "").strip(),
        "type": static.get("Type") or meta.get("ShipType", 0),
        "speed": pos.get("Sog", 0),
        "heading": pos.get("TrueHeading") or pos.get("Cog", 0),
        "lat": meta.get("latitude"),
        "lon": meta.get("longitude"),
    }


def enrich_vessels(vessels: list) -> None:
    for v in vessels:
        lat, lon = v.get("lat"), v.get("lon")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            v["_dist"] = haversine_nm(LAT, LON, lat, lon)
            v["_brg"] = bearing_deg(LAT, LON, lat, lon)


def is_rare_vessel(v: dict) -> bool:
    name = (v.get("name") or "").upper()
    if any(name.startswith(p) for p in RARE_VESSEL_PREFIXES):
        return True
    return v.get("type") == 35


async def fetch_vessels(api_key: str) -> list:
    subscription = {
        "APIKey": api_key,
        "BoundingBoxes": [[[LAT - BOX_DEG, LON - BOX_DEG], [LAT + BOX_DEG, LON + BOX_DEG]]],
    }
    seen = {}
    try:
        async with websockets.connect(AIS_URL, ssl=True) as ws:
            await ws.send(json.dumps(subscription))
            deadline = asyncio.get_event_loop().time() + VESSEL_TIMEOUT
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                except asyncio.TimeoutError:
                    break
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                mmsi = msg.get("MetaData", {}).get("MMSI")
                name = msg.get("MetaData", {}).get("ShipName", "").strip()
                if mmsi and name and mmsi not in seen:
                    seen[mmsi] = _normalize_vessel(msg)
    except Exception as exc:
        print(f"[SEA] Warning: {exc}", file=sys.stderr)
    return list(seen.values())


def format_vessels(vessels: list) -> str:
    if not vessels:
        return "[SEA] No data — set AISSTREAM_API_KEY or check network"

    def sort_key(v):
        rare = is_rare_vessel(v)
        d = v.get("_dist", 999)
        return (0 if rare else 1, d)

    vessels = sorted(vessels, key=sort_key)
    box_nm = int(BOX_DEG * 60)
    lines = [f"=== VESSELS ON WATER (~{box_nm} nm box) — {len(vessels)} contacts ==="]
    for v in vessels:
        rare = is_rare_vessel(v)
        tag = "[***]" if rare else "     "
        name = v["name"][:18].ljust(18)
        vtype = _vessel_type_label(v.get("type", 0)).ljust(9)
        spd = v.get("speed", 0)
        spd_str = f"{float(spd):5.1f} kt" if isinstance(spd, (int, float)) else "    ? kt"
        hdg = v.get("heading", 0)
        hdg_str = f"hdg {int(hdg):3d}°" if isinstance(hdg, (int, float)) else "hdg   ?°"
        db = _dist_brg_str(v.get("_dist"), v.get("_brg"))
        mmsi = v.get("mmsi", "")
        lines.append(f"{tag} {name} {vtype} {spd_str}  {hdg_str}  {db}  MMSI {mmsi}")
    return "\n".join(lines)


async def one_cycle(notify_enabled: bool, seen_rare: set) -> None:
    adsb_key, ais_key = get_config()
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"Querying at {ts} local — NAS North Island / Point Loma\n")
    raw_ac, vessels = await asyncio.gather(
        fetch_aircraft(adsb_key),
        fetch_vessels(ais_key),
    )
    planes = filter_aircraft(raw_ac)
    enrich_aircraft(planes)
    enrich_vessels(vessels)
    print(format_aircraft(planes))
    print()
    print(format_vessels(vessels))
    print()

    if notify_enabled:
        for p in planes:
            if is_rare_aircraft(p):
                key = ("AIR", p.get("hex"))
                if key not in seen_rare:
                    seen_rare.add(key)
                    call = (p.get("flight") or p.get("hex") or "?").strip()
                    t = p.get("t") or "unknown"
                    notify("Rare aircraft overhead", f"{call} ({t})")
        for v in vessels:
            if is_rare_vessel(v):
                key = ("SEA", v.get("mmsi"))
                if key not in seen_rare:
                    seen_rare.add(key)
                    notify("Rare vessel on water", v.get("name", "unknown"))


async def run(args: argparse.Namespace) -> None:
    seen_rare: set = set()
    if args.watch <= 0:
        await one_cycle(args.notify, seen_rare)
        return
    while True:
        sys.stdout.write("\033[2J\033[H")
        sys.stdout.flush()
        await one_cycle(args.notify, seen_rare)
        print(f"(refresh in {args.watch}s — Ctrl-C to quit)")
        try:
            await asyncio.sleep(args.watch)
        except asyncio.CancelledError:
            break


def main() -> None:
    args = parse_args()
    try:
        asyncio.run(run(args))
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
