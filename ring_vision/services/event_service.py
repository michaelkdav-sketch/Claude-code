import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

from config import settings
from database import get_db
from providers import ring_provider
from services import recognition, notifications

logger = logging.getLogger(__name__)

_poll_task: Optional[asyncio.Task] = None


async def _load_gallery(db: aiosqlite.Connection) -> list[dict]:
    async with db.execute(
        "SELECT person_id, embedding FROM person_photos WHERE embedding IS NOT NULL"
    ) as cur:
        rows = await cur.fetchall()
    return [{"person_id": r["person_id"], "embedding": r["embedding"]} for r in rows]


async def _process_event(db: aiosqlite.Connection, event: dict):
    ring_event_id = event["ring_event_id"]

    # dedup check
    async with db.execute(
        "SELECT id FROM events WHERE ring_event_id = ?", (ring_event_id,)
    ) as cur:
        if await cur.fetchone():
            return

    snapshot_path: Optional[str] = None
    recording_id = event.get("recording_id")
    if recording_id:
        snapshot_path = await ring_provider.get_snapshot_for_event(recording_id)

    person_id: Optional[int] = None
    confidence: Optional[float] = None

    if snapshot_path:
        embedding = recognition.embed_image(snapshot_path)
        if embedding:
            gallery = await _load_gallery(db)
            person_id, confidence = await recognition.match_face(
                embedding, gallery, settings.recognition_threshold
            )

    created_at = str(event.get("created_at", datetime.now(timezone.utc).isoformat()))

    await db.execute(
        """INSERT OR IGNORE INTO events
           (ring_event_id, device_id, kind, created_at, snapshot_path, person_id, confidence)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            ring_event_id,
            event.get("device_id"),
            event.get("kind"),
            created_at,
            snapshot_path,
            person_id,
            confidence,
        ),
    )
    await db.commit()

    # notifications
    if person_id is not None:
        async with db.execute("SELECT name, notify FROM people WHERE id = ?", (person_id,)) as cur:
            person = await cur.fetchone()
        if person and person["notify"]:
            await notifications.notify_known_visitor(ring_event_id, person["name"], snapshot_path)
    else:
        await notifications.notify_unknown_visitor(ring_event_id, snapshot_path)


async def poll_loop():
    logger.info("Starting Ring polling loop (interval=%ss)", settings.poll_interval)
    while True:
        try:
            if ring_provider.is_connected():
                db = await get_db()
                try:
                    events = await ring_provider.get_events(limit=20)
                    for event in events:
                        await _process_event(db, event)
                finally:
                    await db.close()
        except Exception:
            logger.exception("Poll loop error")
        await asyncio.sleep(settings.poll_interval)


def start_polling():
    global _poll_task
    loop = asyncio.get_event_loop()
    _poll_task = loop.create_task(poll_loop())


def stop_polling():
    if _poll_task:
        _poll_task.cancel()
