#!/usr/bin/env python3
"""Web front end for the SD outdoor sports weather checker."""

import datetime
import os
import sys

from flask import Flask
import weather

app = Flask(__name__)

VERDICT_STYLES = {
    "GO":    ("#16a34a", "#dcfce7"),
    "WAIT":  ("#d97706", "#fef3c7"),
    "NO-GO": ("#dc2626", "#fee2e2"),
}


def fetch_area_data(key, cfg, api_key):
    try:
        raw_current = weather.fetch_current(cfg["lat"], cfg["lon"], api_key)
        raw_forecast = weather.fetch_forecast(cfg["lat"], cfg["lon"], api_key)
        current = weather.parse_current(raw_current)
        slots = weather.parse_forecast(raw_forecast)
        burnoff = weather.estimate_burnoff(current, slots)
        verdict, reason = weather.recommend(cfg, current)
        return {"ok": True, "current": current, "burnoff": burnoff,
                "verdict": verdict, "reason": reason}
    except (SystemExit, Exception) as e:
        return {"ok": False, "error": str(e)}


def card_html(cfg, data):
    if not data["ok"]:
        return f"""
        <div class="card">
          <h2>{cfg['name']}</h2>
          <p class="err">Could not load data — {data['error']}</p>
        </div>"""

    c = data["current"]
    verdict = data["verdict"]
    fg, bg = VERDICT_STYLES.get(verdict, ("#6b7280", "#f3f4f6"))
    gust = f" (gust {c['gust_knots']} kts)" if c["gust_knots"] else ""
    vis = f"{c['visibility_mi']} mi" if c["visibility_mi"] is not None else "—"

    return f"""
    <div class="card">
      <h2>{cfg['name']}</h2>
      <span class="badge" style="color:{fg};background:{bg};">{verdict}</span>
      <p class="reason">{data['reason']}</p>
      <table>
        <tr><td>Wind</td><td>{c['wind_knots']} kts from {c['wind_cardinal']}{gust}</td></tr>
        <tr><td>Temp</td><td>{c['temp_f']:.0f}°F &nbsp; feels like {c['feels_like_f']:.0f}°F</td></tr>
        <tr><td>Cloud cover</td><td>{c['cloud_pct']}%</td></tr>
        <tr><td>Visibility</td><td>{vis}</td></tr>
        <tr><td>Conditions</td><td>{c['description']}</td></tr>
        <tr><td>Marine layer</td><td>{data['burnoff']}</td></tr>
      </table>
    </div>"""


@app.route("/")
def index():
    api_key = weather.get_api_key()
    now = datetime.datetime.now().strftime("%-I:%M %p")
    cards = "".join(card_html(cfg, fetch_area_data(k, cfg, api_key))
                    for k, cfg in weather.AREAS.items())

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="600">
  <title>SD Weather</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f0f4f8;color:#1e293b;padding:24px}}
    header{{margin-bottom:24px}}
    h1{{font-size:1.35rem;font-weight:700;margin-bottom:4px}}
    .meta{{font-size:.82rem;color:#64748b}}
    .meta a{{color:#3b82f6;text-decoration:none}}
    .meta a:hover{{text-decoration:underline}}
    .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}}
    .card{{background:#fff;border-radius:12px;padding:20px;
           box-shadow:0 1px 3px rgba(0,0,0,.08)}}
    .card h2{{font-size:.95rem;font-weight:600;color:#0f172a;margin-bottom:10px}}
    .badge{{display:inline-block;font-size:1rem;font-weight:700;
            padding:3px 14px;border-radius:20px;margin-bottom:8px}}
    .reason{{font-size:.82rem;color:#475569;line-height:1.45;margin-bottom:14px}}
    table{{width:100%;border-collapse:collapse;font-size:.84rem}}
    td{{padding:5px 0;vertical-align:top}}
    td:first-child{{color:#64748b;width:105px;padding-right:8px}}
    tr{{border-bottom:1px solid #f1f5f9}}
    tr:last-child{{border-bottom:none}}
    .err{{color:#dc2626;font-size:.85rem;margin-top:8px}}
  </style>
</head>
<body>
  <header>
    <h1>San Diego Outdoor Weather</h1>
    <p class="meta">Updated {now} &nbsp;&middot;&nbsp;
       <a href="/">Refresh</a> &nbsp;&middot;&nbsp; auto-refreshes every 10 min</p>
  </header>
  <div class="grid">{cards}</div>
</body>
</html>"""


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
