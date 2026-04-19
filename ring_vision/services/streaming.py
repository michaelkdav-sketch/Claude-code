import asyncio
import logging
import time
from pathlib import Path
from typing import Optional

from providers import ring_provider

logger = logging.getLogger(__name__)

_latest_snapshot: Optional[str] = None
_stream_url: Optional[str] = None
_stream_url_fetched_at: float = 0
_STREAM_URL_TTL = 60  # seconds


async def refresh_snapshot() -> Optional[str]:
    global _latest_snapshot
    try:
        path = await ring_provider.get_snapshot()
        if path:
            _latest_snapshot = path
    except Exception:
        logger.exception("refresh_snapshot failed")
    return _latest_snapshot


async def get_live_stream_url() -> Optional[str]:
    global _stream_url, _stream_url_fetched_at
    now = time.time()
    if _stream_url and (now - _stream_url_fetched_at) < _STREAM_URL_TTL:
        return _stream_url
    try:
        url = await ring_provider.get_stream_url()
        if url:
            _stream_url = url
            _stream_url_fetched_at = now
            return url
    except Exception:
        logger.exception("get_live_stream_url failed")
    return None


def get_latest_snapshot() -> Optional[str]:
    return _latest_snapshot
