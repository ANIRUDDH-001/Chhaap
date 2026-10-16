"""Resumable real-model evaluation. Records every result and reports failures honestly."""

import argparse
import json
import statistics
import time
from pathlib import Path

import httpx
from chhaap.catalogue import catalogue
from chhaap.inference import OllamaProvider
from chhaap.settings import settings

ROOT = Path(__file__).resolve().parents[1]
EVAL = ROOT / "eval"


def summarize(rows):
    expected = sum(r.get("expected_count", 0) for r in rows)
    correct = sum(r.get("correct", 0) for r in rows)
    missing = [r for r in rows if r.get("missing_expected")]
    conflicts = [r for r in rows if r.get("conflict_expected")]
    durations = [r["seconds"] for r in rows]
    return {
        "completed": len(rows),
        "total_cases": 60,
        "correct_fields": correct,
        "expected_fields": expected,
        "field_accuracy": round(correct / expected, 4) if expected else None,
        "missing_detection": sum(r.get("missing_detected", False) for r in missing)
        / len(missing)
        if missing
        else None,
        "conflict_detection": sum(r.get("conflict_detected", False) for r in conflicts)
        / len(conflicts)
        if conflicts
        else None,
        "model_failures": sum(not r["success"] for r in rows),
        "all_outputs_unconfirmed": all(r.get("all_unconfirmed", True) for r in rows),
        "median_seconds": round(statistics.median(durations), 2) if durations else None,
        "max_seconds": max(durations, default=0),
        "model": settings.ollama_model,
        "scope": "Fictional cases only; this is not a real-user study.",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=60)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    cases = json.loads((EVAL / "fixtures.json").read_text(encoding="utf-8"))
    output = EVAL / "results.jsonl"
    rows = (
        [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines()]
        if args.resume and output.exists()
        else []
    )
    if not args.resume:
        output.write_text("", encoding="utf-8")
    completed = {r["id"] for r in rows}
    try:
        tags = httpx.get(settings.ollama_url + "/api/tags", timeout=5).json()
        digest = next(
            m["digest"] for m in tags["models"] if m["name"] == settings.ollama_model
        )
    except Exception:
        digest = "unavailable"
    provider = OllamaProvider()
    for case in cases[: args.limit]:
        if case["id"] in completed:
            continue
        source = {
            "id": "eval-source",
            "kind": "text",
            "sender": "Fictional customer",
            "text": case["text"],
        }
        temp_key = None
        if case.get("image"):
            # Use the same private media read path as production, with a dedicated evaluation key.
            source["kind"] = "image"
            source["text"] = "Read the attached fictional customer conversation."
            temp_key = "evaluation/" + case["id"] + ".png"
            path = settings.data_dir / temp_key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((EVAL / case["image"]).read_bytes())
            source["media_path"] = temp_key
        row = {
            "id": case["id"],
            "group": case["group"],
            "expected": case["expected"],
            "expected_count": len(case["expected"]),
            "missing_expected": case.get("missing"),
            "conflict_expected": case.get("conflict", False),
            "model": settings.ollama_model,
            "digest": digest,
        }
        start = time.monotonic()
        try:
            result = provider.extract([source], catalogue())
            line = result["lines"][0] if result["lines"] else {}
            row.update(
                success=True,
                output=result,
                correct=sum(line.get(k) == v for k, v in case["expected"].items()),
                all_unconfirmed=all(not l["confirmed"] for l in result["lines"]),
                conflict_detected=bool(result["conflicts"]),
            )
            missing = case.get("missing")
            row["missing_detected"] = (
                any(
                    missing in x.lower()
                    or (missing == "delivery" and "date" in x.lower())
                    for x in result["missing"]
                )
                if missing
                else False
            )
        except Exception as error:
            row.update(
                success=False,
                correct=0,
                error_type=type(error).__name__,
                error=str(error)[:200],
            )
        row["seconds"] = round(time.monotonic() - start, 2)
        rows.append(row)
        with output.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
        (EVAL / "summary.json").write_text(
            json.dumps(summarize(rows), indent=2), encoding="utf-8"
        )
        if temp_key:
            (settings.data_dir / temp_key).unlink(missing_ok=True)
        print(
            f"{len(rows)}/60 {case['id']}: {row['correct']}/{row['expected_count']} fields, {row['seconds']}s",
            flush=True,
        )
    print(json.dumps(summarize(rows)), flush=True)


if __name__ == "__main__":
    main()
