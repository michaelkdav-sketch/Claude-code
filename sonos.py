#!/usr/bin/env python3
"""Sonos controller - discover and control Sonos devices on the local network."""

import sys
import soco


def discover_devices():
    print("Discovering Sonos devices on the network...")
    devices = list(soco.discover() or [])
    return devices


def print_devices(devices):
    if not devices:
        print("No Sonos devices found.")
        return
    print(f"\nFound {len(devices)} device(s):")
    for i, d in enumerate(devices):
        try:
            info = d.get_current_transport_info()
            state = info.get("current_transport_state", "UNKNOWN")
            track = d.get_current_track_info()
            title = track.get("title", "") or "(nothing)"
            artist = track.get("artist", "")
            vol = d.volume
            label = f"{artist} - {title}" if artist else title
            print(f"  [{i}] {d.player_name} ({d.ip_address})  vol={vol}  [{state}]  {label}")
        except Exception as e:
            print(f"  [{i}] {d.player_name} ({d.ip_address})  (error reading state: {e})")


def get_device(devices, index=0):
    if not devices:
        print("No devices available.")
        sys.exit(1)
    if index >= len(devices):
        print(f"Device index {index} out of range (0–{len(devices)-1}).")
        sys.exit(1)
    return devices[index]


def cmd_status(devices, args):
    print_devices(devices)


def cmd_play(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    d.play()
    print(f"Playing on {d.player_name}")


def cmd_pause(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    d.pause()
    print(f"Paused {d.player_name}")


def cmd_next(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    d.next()
    print(f"Skipped to next on {d.player_name}")


def cmd_prev(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    d.previous()
    print(f"Went to previous on {d.player_name}")


def cmd_volume(devices, args):
    if not args:
        print("Usage: volume <level> [device_index]")
        sys.exit(1)
    level = int(args[0])
    d = get_device(devices, int(args[1]) if len(args) > 1 else 0)
    d.volume = level
    print(f"Set volume to {level} on {d.player_name}")


def cmd_mute(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    d.mute = True
    print(f"Muted {d.player_name}")


def cmd_unmute(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    d.mute = False
    print(f"Unmuted {d.player_name}")


def cmd_queue(devices, args):
    d = get_device(devices, int(args[0]) if args else 0)
    queue = d.get_queue()
    if not queue:
        print(f"Queue is empty on {d.player_name}")
        return
    print(f"Queue on {d.player_name} ({len(queue)} items):")
    for i, item in enumerate(queue):
        print(f"  {i+1}. {item.creator} - {item.title}")


COMMANDS = {
    "status": (cmd_status, "List all devices and current state"),
    "play":   (cmd_play,   "Play  [device_index]"),
    "pause":  (cmd_pause,  "Pause [device_index]"),
    "next":   (cmd_next,   "Next track [device_index]"),
    "prev":   (cmd_prev,   "Previous track [device_index]"),
    "volume": (cmd_volume, "Set volume <level> [device_index]"),
    "mute":   (cmd_mute,   "Mute [device_index]"),
    "unmute": (cmd_unmute, "Unmute [device_index]"),
    "queue":  (cmd_queue,  "Show queue [device_index]"),
}


def usage():
    print("Usage: python3 sonos.py <command> [args...]")
    print("\nCommands:")
    for name, (_, desc) in COMMANDS.items():
        print(f"  {name:<10} {desc}")
    print("\nDevice index defaults to 0 (first discovered device).")


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        usage()
        sys.exit(0)

    command = sys.argv[1].lower()
    args = sys.argv[2:]

    if command not in COMMANDS:
        print(f"Unknown command: {command}")
        usage()
        sys.exit(1)

    devices = discover_devices()
    COMMANDS[command][0](devices, args)


if __name__ == "__main__":
    main()
