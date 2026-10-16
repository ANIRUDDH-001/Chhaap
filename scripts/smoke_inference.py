"""Measure one real local extraction; never substitutes recorded output for a live call."""

import json
import time
from pathlib import Path

from chhaap.catalogue import catalogue
from chhaap.inference import OllamaProvider
from chhaap.settings import settings

start = time.monotonic()
sources = [
    {
        "id": "source-1",
        "kind": "text",
        "sender": "Riya",
        "text": "500 visiting cards, standard size, 350 GSM paper, both sides colour, matte finish. Delivery Monday.",
    }
]
result = {"model": settings.ollama_model, "sources": sources}
try:
    result["output"] = OllamaProvider().extract(sources, catalogue())
    result["success"] = True
except Exception as error:
    result["success"] = False
    result["error_type"] = type(error).__name__
    result["error"] = str(error)[:300]
result["elapsed_seconds"] = round(time.monotonic() - start, 2)
root = Path(__file__).resolve().parents[1]
(root / "eval").mkdir(exist_ok=True)
(root / "eval" / "live-smoke.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(json.dumps(result, ensure_ascii=False))
