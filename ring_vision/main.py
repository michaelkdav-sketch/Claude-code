import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from config import settings
from database import init_db
from providers import ring_provider
from services import event_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await ring_provider.authenticate()
    event_service.start_polling()
    yield
    event_service.stop_polling()


app = FastAPI(title="RingVision", lifespan=lifespan)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount(
    "/storage",
    StaticFiles(directory=str(BASE_DIR / "storage")),
    name="storage",
)

from routers import dashboard, timeline, gallery, live, settings_router  # noqa: E402

app.include_router(dashboard.router)
app.include_router(timeline.router)
app.include_router(gallery.router)
app.include_router(live.router)
app.include_router(settings_router.router)
