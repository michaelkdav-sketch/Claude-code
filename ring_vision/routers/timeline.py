from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from database import get_db

router = APIRouter(prefix="/timeline")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("", response_class=HTMLResponse)
async def timeline(
    request: Request,
    kind: Optional[str] = None,
    known: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    db = await get_db()
    try:
        filters = []
        params = []

        if kind:
            filters.append("e.kind = ?")
            params.append(kind)
        if known == "known":
            filters.append("(e.person_id IS NOT NULL OR e.label_override IS NOT NULL)")
        elif known == "unknown":
            filters.append("e.person_id IS NULL AND e.label_override IS NULL")
        if date_from:
            filters.append("date(e.created_at) >= ?")
            params.append(date_from)
        if date_to:
            filters.append("date(e.created_at) <= ?")
            params.append(date_to)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""
        async with db.execute(
            f"""SELECT e.*, p.name as person_name
                FROM events e LEFT JOIN people p ON e.person_id = p.id
                {where}
                ORDER BY e.created_at DESC LIMIT 100""",
            params,
        ) as cur:
            events = await cur.fetchall()

        async with db.execute("SELECT id, name FROM people ORDER BY name") as cur:
            people = await cur.fetchall()
    finally:
        await db.close()

    return templates.TemplateResponse(
        "timeline.html",
        {
            "request": request,
            "events": events,
            "people": people,
            "filters": {"kind": kind, "known": known, "date_from": date_from, "date_to": date_to},
        },
    )


@router.post("/{event_id}/relabel", response_class=RedirectResponse)
async def relabel_event(event_id: int, person_id: Optional[str] = Form(None)):
    db = await get_db()
    try:
        if person_id and person_id.isdigit():
            await db.execute(
                "UPDATE events SET person_id = ?, label_override = NULL WHERE id = ?",
                (int(person_id), event_id),
            )
        else:
            label = person_id if person_id else None
            await db.execute(
                "UPDATE events SET person_id = NULL, label_override = ? WHERE id = ?",
                (label, event_id),
            )
        await db.commit()
    finally:
        await db.close()
    return RedirectResponse("/timeline", status_code=303)
