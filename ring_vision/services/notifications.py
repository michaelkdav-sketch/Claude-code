import asyncio
import logging
import time
from pathlib import Path
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

_last_notified: dict[str, float] = {}


def _get_apprise():
    try:
        import apprise
        ap = apprise.Apprise()
        for url in settings.notification_url_list:
            ap.add(url)
        return ap
    except Exception:
        logger.exception("Apprise init failed")
        return None


def _cooldown_key(event_id: str) -> bool:
    now = time.time()
    last = _last_notified.get(event_id, 0)
    if now - last < settings.notification_cooldown:
        return True
    _last_notified[event_id] = now
    return False


async def notify_unknown_visitor(event_id: str, snapshot_path: Optional[str] = None):
    if _cooldown_key(event_id):
        return
    if not settings.notification_url_list:
        return
    ap = _get_apprise()
    if not ap:
        return
    title = "Unknown Visitor at Door"
    body = "Motion detected — visitor not recognised."
    try:
        attach = []
        if snapshot_path and Path(snapshot_path).exists():
            import apprise
            attach = [apprise.AppriseAttachment(snapshot_path)]
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ap.notify(title=title, body=body, attach=attach or None),
        )
    except Exception:
        logger.exception("notify_unknown_visitor failed")


async def notify_known_visitor(
    event_id: str, person_name: str, snapshot_path: Optional[str] = None
):
    if _cooldown_key(event_id):
        return
    if not settings.notification_url_list:
        return
    ap = _get_apprise()
    if not ap:
        return
    title = f"{person_name} at the door"
    body = f"{person_name} was recognised at your front door."
    try:
        attach = []
        if snapshot_path and Path(snapshot_path).exists():
            import apprise
            attach = [apprise.AppriseAttachment(snapshot_path)]
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ap.notify(title=title, body=body, attach=attach or None),
        )
    except Exception:
        logger.exception("notify_known_visitor failed")
