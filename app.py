#!/usr/bin/env python3
"""Local Sonos web controller."""

import threading
import soco
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

_devices = {}
_lock = threading.Lock()


def _get_devices():
    with _lock:
        if not _devices:
            for d in soco.discover(timeout=5) or []:
                _devices[d.ip_address] = d
        return dict(_devices)


def _dev(ip):
    devices = _get_devices()
    if ip not in devices:
        # try direct connection
        devices[ip] = soco.SoCo(ip)
        with _lock:
            _devices[ip] = devices[ip]
    return devices[ip]


def _state(device):
    info = device.get_current_transport_info()
    track = device.get_current_track_info()
    return {
        "name": device.player_name,
        "ip": device.ip_address,
        "state": info.get("current_transport_state", "UNKNOWN"),
        "volume": device.volume,
        "mute": device.mute,
        "title": track.get("title", ""),
        "artist": track.get("artist", ""),
        "album": track.get("album", ""),
        "album_art": track.get("album_art_uri", ""),
        "position": track.get("position", "0:00:00"),
        "duration": track.get("duration", "0:00:00"),
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/devices")
def devices():
    devs = _get_devices()
    result = []
    for ip, d in devs.items():
        try:
            result.append(_state(d))
        except Exception as e:
            result.append({"name": d.player_name, "ip": ip, "error": str(e)})
    return jsonify(result)


@app.route("/api/state/<ip>")
def state(ip):
    try:
        return jsonify(_state(_dev(ip)))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/play/<ip>", methods=["POST"])
def play(ip):
    _dev(ip).play()
    return jsonify({"ok": True})


@app.route("/api/pause/<ip>", methods=["POST"])
def pause(ip):
    _dev(ip).pause()
    return jsonify({"ok": True})


@app.route("/api/next/<ip>", methods=["POST"])
def next_track(ip):
    _dev(ip).next()
    return jsonify({"ok": True})


@app.route("/api/prev/<ip>", methods=["POST"])
def prev_track(ip):
    _dev(ip).previous()
    return jsonify({"ok": True})


@app.route("/api/volume/<ip>", methods=["POST"])
def volume(ip):
    level = int(request.json.get("level", 20))
    _dev(ip).volume = max(0, min(100, level))
    return jsonify({"ok": True, "volume": level})


@app.route("/api/mute/<ip>", methods=["POST"])
def mute(ip):
    d = _dev(ip)
    d.mute = not d.mute
    return jsonify({"ok": True, "mute": d.mute})


@app.route("/api/queue/<ip>")
def queue(ip):
    items = []
    for i, item in enumerate(_dev(ip).get_queue()):
        items.append({
            "index": i,
            "title": item.title,
            "artist": getattr(item, "creator", ""),
            "album": getattr(item, "album", ""),
            "album_art": getattr(item, "album_art_uri", ""),
        })
    return jsonify(items)


@app.route("/api/queue/<ip>/play/<int:index>", methods=["POST"])
def play_queue_item(ip, index):
    _dev(ip).play_from_queue(index)
    return jsonify({"ok": True})


@app.route("/api/refresh", methods=["POST"])
def refresh():
    with _lock:
        _devices.clear()
    return jsonify({"ok": True})


if __name__ == "__main__":
    print("Sonos controller running at http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
