from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from config import settings
from providers import ring_provider

router = APIRouter(prefix="/settings")
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))


@router.get("", response_class=HTMLResponse)
async def settings_page(request: Request):
    status = await ring_provider.get_connection_status()
    return templates.TemplateResponse(
        "settings.html",
        {"request": request, "settings": settings, "ring_status": status},
    )


@router.post("/save", response_class=RedirectResponse)
async def save_settings(
    ring_username: str = Form(""),
    ring_password: str = Form(""),
    poll_interval: int = Form(15),
    recognition_threshold: float = Form(0.5),
    notification_urls: str = Form(""),
    notification_cooldown: int = Form(300),
):
    env_path = Path(__file__).parent.parent / ".env"
    lines = [
        f"RING_USERNAME={ring_username}",
        f"RING_PASSWORD={ring_password}",
        f"POLL_INTERVAL={poll_interval}",
        f"RECOGNITION_THRESHOLD={recognition_threshold}",
        f"NOTIFICATION_URLS={notification_urls}",
        f"NOTIFICATION_COOLDOWN={notification_cooldown}",
    ]
    env_path.write_text("\n".join(lines) + "\n")
    # update live settings object
    settings.ring_username = ring_username
    settings.ring_password = ring_password
    settings.poll_interval = poll_interval
    settings.recognition_threshold = recognition_threshold
    settings.notification_urls = notification_urls
    settings.notification_cooldown = notification_cooldown
    return RedirectResponse("/settings?saved=1", status_code=303)


@router.post("/reconnect", response_class=RedirectResponse)
async def reconnect():
    await ring_provider.authenticate()
    return RedirectResponse("/settings?reconnected=1", status_code=303)
