from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from services.streaming import get_latest_snapshot, get_live_stream_url, refresh_snapshot

router = APIRouter(prefix="/live")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("", response_class=HTMLResponse)
async def live_view(request: Request):
    stream_url = await get_live_stream_url()
    snap = get_latest_snapshot()
    snap_url = f"/storage/snapshots/{Path(snap).name}" if snap else None
    return templates.TemplateResponse(
        "live.html",
        {"request": request, "stream_url": stream_url, "snap_url": snap_url},
    )


@router.get("/snapshot")
async def latest_snapshot():
    snap = await refresh_snapshot()
    if snap and Path(snap).exists():
        return FileResponse(snap, media_type="image/jpeg")
    return JSONResponse({"error": "no snapshot available"}, status_code=404)


@router.get("/stream-url")
async def stream_url():
    url = await get_live_stream_url()
    return {"url": url}
