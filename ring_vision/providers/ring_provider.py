import asyncio
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from ring_doorbell import Auth, Ring
from ring_doorbell.const import DOORBELL_KINDS

from config import settings

logger = logging.getLogger(__name__)

_ring: Optional[Ring] = None
_auth: Optional[Auth] = None
_last_snapshot_path: Optional[str] = None


def _save_token(token_data: dict):
    Path(settings.token_path).parent.mkdir(parents=True, exist_ok=True)
    with open(settings.token_path, "w") as f:
        json.dump(token_data, f)


def _load_token() -> Optional[dict]:
    try:
        with open(settings.token_path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


async def authenticate(otp_callback=None) -> bool:
    global _ring, _auth
    try:
        token = _load_token()
        _auth = Auth(
            user_agent="RingVision/1.0",
            token=token,
            token_updater=_save_token,
        )
        if not token:
            if not settings.ring_username or not settings.ring_password:
                logger.warning("Ring credentials not configured")
                return False
            try:
                await _auth.async_fetch_token(settings.ring_username, settings.ring_password)
            except Exception as exc:
                if "2fa" in str(exc).lower() or "otp" in str(exc).lower():
                    if otp_callback:
                        otp = await otp_callback()
                        await _auth.async_fetch_token(
                            settings.ring_username, settings.ring_password, otp
                        )
                    else:
                        logger.error("Ring requires 2FA but no OTP callback provided")
                        return False
                else:
                    raise

        _ring = Ring(_auth)
        await _ring.async_update()
        logger.info("Ring authenticated successfully")
        return True
    except Exception:
        logger.exception("Ring authentication failed")
        _ring = None
        return False


def is_connected() -> bool:
    return _ring is not None


async def get_devices() -> list:
    if not _ring:
        return []
    try:
        await _ring.async_update()
        return _ring.video_doorbells + _ring.stickup_cams
    except Exception:
        logger.exception("Failed to get Ring devices")
        return []


async def get_events(limit: int = 30) -> list[dict]:
    devices = await get_devices()
    events: list[dict] = []
    for device in devices:
        try:
            history = await device.async_history(limit=limit)
            for item in history:
                events.append(
                    {
                        "ring_event_id": str(item.get("id", "")),
                        "device_id": str(device.id),
                        "device_name": device.name,
                        "kind": item.get("kind", "motion"),
                        "created_at": item.get("created_at", ""),
                        "recording_id": item.get("id"),
                    }
                )
        except Exception:
            logger.exception("Failed to get history for device %s", device.name)
    return events


async def get_snapshot(device=None) -> Optional[str]:
    global _last_snapshot_path
    devices = await get_devices() if device is None else [device]
    if not devices:
        return _last_snapshot_path

    target = devices[0]
    try:
        snapshot_dir = Path(settings.snapshots_dir)
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        filename = snapshot_dir / f"snap_{int(time.time())}.jpg"
        await target.async_get_snapshot()
        img_data = target.live_stream_session if hasattr(target, "live_stream_session") else None
        # ring_doorbell stores the last snapshot on the device object
        if hasattr(target, "_ring_objects"):
            pass
        # Use recording download as snapshot source
        history = await target.async_history(limit=1)
        if history:
            rec_id = history[0].get("id")
            if rec_id:
                await target.async_recording_download(rec_id, str(filename))
                _last_snapshot_path = str(filename)
                return str(filename)
    except Exception:
        logger.exception("Snapshot fetch failed")
    return _last_snapshot_path


async def get_snapshot_for_event(recording_id) -> Optional[str]:
    devices = await get_devices()
    if not devices:
        return None
    target = devices[0]
    try:
        snapshot_dir = Path(settings.snapshots_dir)
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        filename = snapshot_dir / f"event_{recording_id}.jpg"
        if filename.exists():
            return str(filename)
        await target.async_recording_download(recording_id, str(filename))
        _last_snapshot_path = str(filename)
        return str(filename)
    except Exception:
        logger.exception("Failed to download snapshot for event %s", recording_id)
    return None


async def get_stream_url() -> Optional[str]:
    devices = await get_devices()
    if not devices:
        return None
    target = devices[0]
    try:
        history = await target.async_history(limit=1)
        if history:
            rec_id = history[0].get("id")
            if rec_id:
                url = await target.async_recording_url(rec_id)
                return url
    except Exception:
        logger.exception("Failed to get stream URL")
    return None


async def get_connection_status() -> dict:
    if not _ring:
        return {"connected": False, "devices": [], "error": "Not authenticated"}
    try:
        devices = await get_devices()
        return {
            "connected": True,
            "devices": [
                {"id": str(d.id), "name": d.name, "battery": getattr(d, "battery_life", None)}
                for d in devices
            ],
        }
    except Exception as exc:
        return {"connected": False, "devices": [], "error": str(exc)}
