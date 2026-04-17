#!/usr/bin/env python3
# Naval & Air Traffic Tracker — NAS North Island / Point Loma, San Diego
#
# Setup:
#   pip install requests websockets
#   export ADSB_API_KEY="your-uuid"        # adsbexchange.com -> API tab
#   export AISSTREAM_API_KEY="your-key"    # aisstream.io -> GitHub login -> Dashboard
#   python traffic.py

import asyncio
import json
import os
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


def get_config() -> tuple:
    return os.environ.get("ADSB_API_KEY", ""), os.environ.get("AISSTREAM_API_KEY", "")


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


def format_aircraft(planes: list) -> str:
    if not planes:
        return "[AIR] No data — set ADSB_API_KEY or check network\n"

    def sort_key(ac):
        is_mil = ac.get("mil") == 1 or ac.get("MIL") == 1
        alt = ac.get("alt_baro", 0)
        if not isinstance(alt, (int, float)):
            alt = 0
        return (0 if is_mil else 1, -alt)

    planes = sorted(planes, key=sort_key)
    lines = [f"=== AIR TRAFFIC ({RADIUS_NM} nm) — {len(planes)} contacts ==="]
    for ac in planes:
        is_mil = ac.get("mil") == 1 or ac.get("MIL") == 1
        tag = "[MIL]" if is_mil else "     "
        call = (ac.get("flight") or ac.get("hex") or "?").strip().ljust(10)
        cat = AC_CATS.get(ac.get("category", ""), "?").ljust(8)
        alt = ac.get("alt_baro", "?")
        alt_str = f"{int(alt):6d} ft" if isinstance(alt, (int, float)) else "  ground  "
        spd = ac.get("gs", 0)
        spd_str = f"{int(spd):4d} kt" if isinstance(spd, (int, float)) else "   ? kt"
        hdg = ac.get("track", ac.get("true_heading", "?"))
        hdg_str = f"hdg {int(hdg):3d}°" if isinstance(hdg, (int, float)) else "hdg   ?°"
        lines.append(f"{tag} {call} {cat} {alt_str}  {spd_str}  {hdg_str}")
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
    }


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
        return "[SEA] No data — set AISSTREAM_API_KEY or check network\n"

    def sort_key(v):
        t = v.get("type", 0)
        return (0 if t == 35 else 1, v.get("name", ""))

    vessels = sorted(vessels, key=sort_key)
    box_nm = int(BOX_DEG * 60)
    lines = [f"=== VESSELS ON WATER (~{box_nm} nm box) — {len(vessels)} contacts ==="]
    for v in vessels:
        name = v["name"][:18].ljust(18)
        vtype = _vessel_type_label(v.get("type", 0)).ljust(10)
        spd = v.get("speed", 0)
        spd_str = f"{float(spd):5.1f} kt" if isinstance(spd, (int, float)) else "    ? kt"
        hdg = v.get("heading", 0)
        hdg_str = f"hdg {int(hdg):3d}°" if isinstance(hdg, (int, float)) else "hdg   ?°"
        mmsi = v.get("mmsi", "")
        lines.append(f"{name}  {vtype}  {spd_str}  {hdg_str}  MMSI {mmsi}")
    return "\n".join(lines)


async def run():
    adsb_key, ais_key = get_config()
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\nQuerying at {ts} local — NAS North Island / Point Loma\n")
    raw_ac, vessels = await asyncio.gather(
        fetch_aircraft(adsb_key),
        fetch_vessels(ais_key),
    )
    planes = filter_aircraft(raw_ac)
    print(format_aircraft(planes))
    print()
    print(format_vessels(vessels))
    print()


def main():
    asyncio.run(run())


if __name__ == "__main__":
    main()
