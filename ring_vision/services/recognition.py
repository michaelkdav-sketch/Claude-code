import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

_app = None


def _get_app():
    global _app
    if _app is None:
        try:
            import insightface
            _app = insightface.app.FaceAnalysis(
                name="buffalo_sc",
                providers=["CPUExecutionProvider"],
            )
            _app.prepare(ctx_id=-1, det_size=(320, 320))
            logger.info("InsightFace loaded")
        except Exception:
            logger.exception("InsightFace init failed — recognition disabled")
            _app = False
    return _app if _app else None


def embed_image(image_path: str) -> Optional[list[float]]:
    app = _get_app()
    if not app:
        return None
    try:
        import cv2
        img = cv2.imread(image_path)
        if img is None:
            return None
        faces = app.get(img)
        if not faces:
            return None
        best = max(faces, key=lambda f: f.det_score)
        return best.embedding.tolist()
    except Exception:
        logger.exception("embed_image failed for %s", image_path)
        return None


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


async def match_face(
    embedding: list[float],
    gallery: list[dict],
    threshold: float = 0.5,
) -> tuple[Optional[int], float]:
    """Return (person_id, confidence) or (None, 0.0) if no match."""
    if not embedding or not gallery:
        return None, 0.0

    best_id: Optional[int] = None
    best_score = 0.0

    for row in gallery:
        raw = row.get("embedding")
        if not raw:
            continue
        try:
            ref_emb = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            continue
        score = _cosine_similarity(embedding, ref_emb)
        if score > best_score:
            best_score = score
            best_id = row["person_id"]

    if best_score >= threshold:
        return best_id, round(best_score, 4)
    return None, round(best_score, 4)
