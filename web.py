#!/usr/bin/env python3
"""Lutron web controller - browser UI for local Lutron control."""

import asyncio
import json
import os
import threading

from flask import Flask, jsonify, render_template, request
from pylutron_caseta.smartbridge import Smartbridge

CONFIG_FILE = os.path.expanduser("~/.lutron_config.json")

app = Flask(__name__)
_bridge = None
_loop = None
_ready = threading.Event()


def _load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)


def _bridge_thread():
    global _bridge, _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)

    async def _connect():
        global _bridge
        config = _load_config()
        _bridge = Smartbridge.create_tls(
            config["host"],
            config["keyfile"],
            config["certfile"],
            config["ca_crtfile"],
        )
        await _bridge.connect()
        _ready.set()

    _loop.run_until_complete(_connect())
    _loop.run_forever()


def _run(coro):
    return asyncio.run_coroutine_threadsafe(coro, _loop).result(timeout=10)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/devices")
def api_devices():
    raw = _bridge.get_devices()
    result = []
    for device_id, d in raw.items():
        dtype = d.get("type", "")
        if dtype in ("WallDimmer", "WallSwitch"):
            result.append({
                "id": device_id,
                "name": d.get("name", "Unknown"),
                "type": dtype,
                "level": d.get("current_state") or 0,
            })
    result.sort(key=lambda x: x["name"])
    return jsonify(result)


@app.route("/api/devices/<device_id>/on", methods=["POST"])
def api_on(device_id):
    _run(_bridge.turn_on(device_id))
    return jsonify({"ok": True})


@app.route("/api/devices/<device_id>/off", methods=["POST"])
def api_off(device_id):
    _run(_bridge.turn_off(device_id))
    return jsonify({"ok": True})


@app.route("/api/devices/<device_id>/level", methods=["POST"])
def api_level(device_id):
    level = int(request.json["level"])
    _run(_bridge.set_value(device_id, level))
    return jsonify({"ok": True})


if __name__ == "__main__":
    t = threading.Thread(target=_bridge_thread, daemon=True)
    t.start()
    print("Connecting to Lutron bridge...")
    _ready.wait()
    print("Connected. Open http://localhost:5000 in your browser.")
    app.run(host="0.0.0.0", port=5000, debug=False)
