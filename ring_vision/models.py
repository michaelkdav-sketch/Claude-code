from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Person:
    id: int
    name: str
    notify: bool
    created_at: str
    photo_count: int = 0


@dataclass
class PersonPhoto:
    id: int
    person_id: int
    photo_path: str
    embedding: Optional[str] = None


@dataclass
class Event:
    id: int
    ring_event_id: str
    device_id: Optional[str]
    kind: Optional[str]
    created_at: str
    snapshot_path: Optional[str]
    person_id: Optional[int]
    confidence: Optional[float]
    label_override: Optional[str]
    person_name: Optional[str] = None

    @property
    def display_label(self) -> str:
        if self.label_override:
            return self.label_override
        if self.person_name:
            return self.person_name
        return "Unknown"

    @property
    def is_known(self) -> bool:
        return self.person_id is not None or self.label_override not in (None, "Unknown")
