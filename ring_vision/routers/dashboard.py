from datetime import date
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from database import get_db
from services.streaming import get_latest_snapshot

router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    db = await get_db()
    try:
        today = date.today().isoformat()
        async with db.execute(
            """SELECT e.*, p.name as person_name
               FROM events e LEFT JOIN people p ON e.person_id = p.id
               WHERE date(e.created_at) = ?
               ORDER BY e.created_at DESC LIMIT 20""",
            (today,),
        ) as cur:
            today_events = await cur.fetchall()

        async with db.execute(
            """SELECT e.*, p.name as person_name
               FROM events e LEFT JOIN people p ON e.person_id = p.id
               WHERE e.person_id IS NULL AND e.label_override IS NULL
               ORDER BY e.created_at DESC LIMIT 5"""
        ) as cur:
            unknowns = await cur.fetchall()
    finally:
        await db.close()

    snap = get_latest_snapshot()
    snap_url = f"/storage/snapshots/{Path(snap).name}" if snap else None

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "today_events": today_events,
            "unknowns": unknowns,
            "snap_url": snap_url,
            "today": today,
        },
    )


@router.get("/dashboard/snapshot-partial", response_class=HTMLResponse)
async def snapshot_partial(request: Request):
    snap = get_latest_snapshot()
    snap_url = f"/storage/snapshots/{Path(snap).name}" if snap else None
    return templates.TemplateResponse(
        "partials/snapshot.html",
        {"request": request, "snap_url": snap_url},
    )
