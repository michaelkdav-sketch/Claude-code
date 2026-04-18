import json
import os
from datetime import datetime

_TOKEN_FILE = "data/tokens.json"
_CONFIG_FILE = "config.json"
os.makedirs("data", exist_ok=True)


def load_config() -> dict:
    try:
        with open(_CONFIG_FILE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def get_all_tokens() -> list[dict]:
    if not os.path.exists(_TOKEN_FILE):
        return []
    with open(_TOKEN_FILE) as f:
        return json.load(f)


def append_token(access_token: str, item_id: str, institution_name: str) -> None:
    tokens = get_all_tokens()
    if any(t["item_id"] == item_id for t in tokens):
        return
    tokens.append({
        "access_token": access_token,
        "item_id": item_id,
        "institution_name": institution_name,
        "linked_at": datetime.utcnow().isoformat(),
    })
    with open(_TOKEN_FILE, "w") as f:
        json.dump(tokens, f, indent=2)
