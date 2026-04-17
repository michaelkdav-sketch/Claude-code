#!/usr/bin/env python3
"""Lutron controller - connect and control Lutron devices on the local network."""

import asyncio
import json
import os
import sys

from pylutron_caseta.smartbridge import Smartbridge

CONFIG_FILE = os.path.expanduser("~/.lutron_config.json")
CERT_DIR = os.path.expanduser("~/.lutron_certs")


def load_config():
    if not os.path.exists(CONFIG_FILE):
        return None
    with open(CONFIG_FILE) as f:
        return json.load(f)


def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)


async def connect(config):
    bridge = Smartbridge.create_tls(
        config["host"],
        config["keyfile"],
        config["certfile"],
        config["ca_crtfile"],
    )
    await bridge.connect()
    return bridge


async def cmd_pair(args):
    if not args:
        print("Usage: pair <bridge_ip>")
        sys.exit(1)
    host = args[0]
    print(f"Pairing with Lutron bridge at {host}...")
    print("Press the small button on the back of the bridge, then press Enter.")
    input()

    from pylutron_caseta import pairing
    data = await pairing.async_pair(host)

    os.makedirs(CERT_DIR, exist_ok=True)
    keyfile = os.path.join(CERT_DIR, "caseta.key")
    certfile = os.path.join(CERT_DIR, "caseta.crt")
    ca_crtfile = os.path.join(CERT_DIR, "caseta-bridge.crt")

    with open(keyfile, "w") as f:
        f.write(data["key"])
    with open(certfile, "w") as f:
        f.write(data["cert"])
    with open(ca_crtfile, "w") as f:
        f.write(data["ca"])

    for path in (keyfile, certfile, ca_crtfile):
        os.chmod(path, 0o600)

    save_config({"host": host, "keyfile": keyfile, "certfile": certfile, "ca_crtfile": ca_crtfile})
    print(f"Paired successfully. Config saved to {CONFIG_FILE}")


async def cmd_status(bridge, args):
    devices = bridge.get_devices()
    if not devices:
        print("No devices found.")
        return
    print(f"Found {len(devices)} device(s):")
    for device_id, device in sorted(devices.items(), key=lambda x: x[1].get("name", "")):
        name = device.get("name", "Unknown")
        level = device.get("current_state", -1)
        device_type = device.get("type", "unknown")
        level_str = f"{level}%" if level >= 0 else "unknown"
        print(f"  [{device_id}] {name} ({device_type})  level={level_str}")


async def cmd_on(bridge, args):
    if not args:
        print("Usage: on <device_id>")
        sys.exit(1)
    device_id = args[0]
    await bridge.turn_on(device_id)
    name = bridge.get_devices().get(device_id, {}).get("name", device_id)
    print(f"Turned on {name}")


async def cmd_off(bridge, args):
    if not args:
        print("Usage: off <device_id>")
        sys.exit(1)
    device_id = args[0]
    await bridge.turn_off(device_id)
    name = bridge.get_devices().get(device_id, {}).get("name", device_id)
    print(f"Turned off {name}")


async def cmd_set(bridge, args):
    if len(args) < 2:
        print("Usage: set <device_id> <level>")
        sys.exit(1)
    device_id, level = args[0], int(args[1])
    await bridge.set_value(device_id, level)
    name = bridge.get_devices().get(device_id, {}).get("name", device_id)
    print(f"Set {name} to {level}%")


async def cmd_scenes(bridge, args):
    scenes = bridge.get_scenes()
    if not scenes:
        print("No scenes found.")
        return
    print(f"Found {len(scenes)} scene(s):")
    for scene_id, scene in sorted(scenes.items(), key=lambda x: x[1].get("name", "")):
        print(f"  [{scene_id}] {scene.get('name', 'Unknown')}")


async def cmd_activate(bridge, args):
    if not args:
        print("Usage: activate <scene_id>")
        sys.exit(1)
    scene_id = args[0]
    await bridge.activate_scene(scene_id)
    name = bridge.get_scenes().get(scene_id, {}).get("name", scene_id)
    print(f"Activated scene: {name}")


COMMANDS = {
    "pair":     ("pair <bridge_ip>",         "Pair with a Lutron bridge (run once)"),
    "status":   ("status",                   "List all devices and current state"),
    "on":       ("on <device_id>",           "Turn on a device"),
    "off":      ("off <device_id>",          "Turn off a device"),
    "set":      ("set <device_id> <level>",  "Set brightness level (0–100)"),
    "scenes":   ("scenes",                   "List all scenes"),
    "activate": ("activate <scene_id>",      "Activate a scene"),
}


def usage():
    print("Usage: python3 lutron.py <command> [args...]")
    print("\nCommands:")
    for name, (syntax, desc) in COMMANDS.items():
        print(f"  {syntax:<35} {desc}")
    print("\nRun 'pair <bridge_ip>' once to authenticate with your bridge.")


async def main_async():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        usage()
        sys.exit(0)

    command = sys.argv[1].lower()
    args = sys.argv[2:]

    if command not in COMMANDS:
        print(f"Unknown command: {command}")
        usage()
        sys.exit(1)

    if command == "pair":
        await cmd_pair(args)
        return

    config = load_config()
    if not config:
        print(f"No config found at {CONFIG_FILE}. Run 'pair <bridge_ip>' first.")
        sys.exit(1)

    bridge = await connect(config)
    try:
        dispatch = {
            "status":   cmd_status,
            "on":       cmd_on,
            "off":      cmd_off,
            "set":      cmd_set,
            "scenes":   cmd_scenes,
            "activate": cmd_activate,
        }
        await dispatch[command](bridge, args)
    finally:
        await bridge.close()


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
