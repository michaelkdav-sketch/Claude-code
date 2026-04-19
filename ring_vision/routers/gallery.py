import json
import shutil
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from config import settings
from database import get_db
from services.recognition import embed_image

router = APIRouter(prefix="/gallery")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("", response_class=HTMLResponse)
async def gallery(request: Request):
    db = await get_db()
    try:
        async with db.execute(
            """SELECT p.id, p.name, p.notify, p.created_at,
                      COUNT(pp.id) as photo_count
               FROM people p LEFT JOIN person_photos pp ON p.id = pp.person_id
               GROUP BY p.id ORDER BY p.name"""
        ) as cur:
            people = await cur.fetchall()

        photos_by_person: dict[int, list] = {}
        for person in people:
            async with db.execute(
                "SELECT id, photo_path FROM person_photos WHERE person_id = ? LIMIT 6",
                (person["id"],),
            ) as cur:
                photos_by_person[person["id"]] = await cur.fetchall()
    finally:
        await db.close()

    return templates.TemplateResponse(
        "gallery.html",
        {"request": request, "people": people, "photos_by_person": photos_by_person},
    )


@router.post("/people", response_class=RedirectResponse)
async def create_person(name: str = Form(...), notify: Optional[str] = Form(None)):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO people (name, notify) VALUES (?, ?)",
            (name.strip(), 1 if notify else 0),
        )
        await db.commit()
    finally:
        await db.close()
    return RedirectResponse("/gallery", status_code=303)


@router.post("/people/{person_id}/delete", response_class=RedirectResponse)
async def delete_person(person_id: int):
    db = await get_db()
    try:
        # remove photos from disk
        async with db.execute(
            "SELECT photo_path FROM person_photos WHERE person_id = ?", (person_id,)
        ) as cur:
            photos = await cur.fetchall()
        for photo in photos:
            p = Path(photo["photo_path"])
            if p.exists():
                p.unlink()
        await db.execute("DELETE FROM people WHERE id = ?", (person_id,))
        await db.commit()
    finally:
        await db.close()
    return RedirectResponse("/gallery", status_code=303)


@router.post("/people/{person_id}/upload", response_class=RedirectResponse)
async def upload_photo(person_id: int, file: UploadFile = File(...)):
    gallery_dir = Path(settings.gallery_dir) / str(person_id)
    gallery_dir.mkdir(parents=True, exist_ok=True)
    filename = gallery_dir / f"{int(time.time())}_{file.filename}"
    with open(filename, "wb") as f:
        shutil.copyfileobj(file.file, f)

    embedding = embed_image(str(filename))
    emb_json = json.dumps(embedding) if embedding else None

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO person_photos (person_id, photo_path, embedding) VALUES (?, ?, ?)",
            (person_id, str(filename), emb_json),
        )
        await db.commit()
    finally:
        await db.close()
    return RedirectResponse("/gallery", status_code=303)


@router.post("/people/{person_id}/rebuild", response_class=RedirectResponse)
async def rebuild_embeddings(person_id: int):
    db = await get_db()
    try:
        async with db.execute(
            "SELECT id, photo_path FROM person_photos WHERE person_id = ?", (person_id,)
        ) as cur:
            photos = await cur.fetchall()
        for photo in photos:
            embedding = embed_image(photo["photo_path"])
            emb_json = json.dumps(embedding) if embedding else None
            await db.execute(
                "UPDATE person_photos SET embedding = ? WHERE id = ?",
                (emb_json, photo["id"]),
            )
        await db.commit()
    finally:
        await db.close()
    return RedirectResponse("/gallery", status_code=303)
