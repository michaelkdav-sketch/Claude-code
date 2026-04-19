from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    ring_username: str = ""
    ring_password: str = ""
    poll_interval: int = 15
    recognition_threshold: float = 0.5
    notification_urls: str = ""
    notification_cooldown: int = 300
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    db_path: str = str(BASE_DIR / "ring_vision.db")
    token_path: str = str(BASE_DIR / "storage" / "ring_token.json")
    snapshots_dir: str = str(BASE_DIR / "storage" / "snapshots")
    gallery_dir: str = str(BASE_DIR / "storage" / "gallery")

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"

    @property
    def notification_url_list(self) -> list[str]:
        return [u.strip() for u in self.notification_urls.split(",") if u.strip()]


settings = Settings()
