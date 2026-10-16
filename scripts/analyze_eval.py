"""Analyze saved fictional results; never replaces measured model output."""

import json
import re
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1] / "eval"


def baseline(text):
    product = (
        "flyers"
        if re.search(r"flyers?|leaflets?|pamphlets?", text, re.I)
        else "cards"
        if re.search(r"(?:visiting|business)\s+cards?", text, re.I)
        else None
    )
    quantity = re.search(
        r"(\d[\d,]*)\s+(?:(?:visiting|business)\s+)?(?:cards?|flyers?|leaflets?|pamphlets?)\b",
        text,
        re.I,
    )
    paper = re.search(r"(\d+)\s*GSM\b", text, re.I)
    return {
        "product": product,
        "quantity": int(quantity[1].replace(",", "")) if quantity else None,
        "paper": paper[1] if paper else None,
    }


def main():
    cases = {
        c["id"]: c
        for c in json.loads((ROOT / "fixtures.json").read_text(encoding="utf-8"))
    }
    rows = [
        json.loads(line)
        for line in (ROOT / "results.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    groups = {}
    for group in sorted({r["group"] for r in rows}):
        subset = [r for r in rows if r["group"] == group]
        expected = sum(r["expected_count"] for r in subset)
        evidence = [e for r in subset for e in r.get("output", {}).get("evidence", [])]
        groups[group] = {
            "cases": len(subset),
            "correct_fields": sum(r["correct"] for r in subset),
            "expected_fields": expected,
            "complete_annotated_field_cases": sum(
                r["success"]
                and r["correct"] == r["expected_count"]
                and (r["expected_count"] > 0 or not r.get("output", {}).get("lines"))
                for r in subset
            ),
            "failures": sum(not r["success"] for r in subset),
            "median_seconds": median(r["seconds"] for r in subset),
            "verified_text_evidence": sum(bool(e.get("verified")) for e in evidence),
            "evidence_count": len(evidence),
        }
    text_rows = [r for r in rows if r["group"] != "screenshot"]
    baseline_correct = sum(
        sum(
            baseline(cases[r["id"]]["text"]).get(k) == v
            for k, v in cases[r["id"]]["expected"].items()
        )
        for r in text_rows
    )
    expected = sum(r["expected_count"] for r in text_rows)
    unsupported = [r for r in rows if not cases[r["id"]]["expected"]]
    report = {
        "completed": len(rows),
        "unsupported_cases": {
            "cases": len(unsupported),
            "supported_job_suggested": sum(
                bool(r.get("output", {}).get("lines")) for r in unsupported
            ),
        },
        "model_text_fields": {
            "correct": sum(r["correct"] for r in text_rows),
            "expected": expected,
        },
        "expected_cases": 60,
        "groups": groups,
        "text_rule_baseline": {
            "correct_fields": baseline_correct,
            "expected_fields": expected,
            "accuracy": baseline_correct / expected if expected else None,
            "method": "First literal quantity tied to a product word, first GSM stock, explicit English product keywords. No OCR, model or prices.",
        },
        "notes": [
            "Unconfirmed suggestions are an application-enforced invariant, not a model obedience score.",
            "Accuracy covers only the independently annotated fields for each case, not every possible specification.",
            "Complete annotated fields does not mean a request is safe to issue; date and all specifications still require human confirmation.",
            "Verified text evidence counts literal span matches; screenshot evidence is deliberately unverified.",
            "Rendered English screenshot inputs with blur do not represent real-user screenshot diversity.",
            "No real-user corrections, production throughput SLA, or peak-memory claim can be derived from this corpus.",
        ],
    }
    (ROOT / "analysis.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "completed": len(rows),
                "unsupported_cases": {
                    "cases": len(unsupported),
                    "supported_job_suggested": sum(
                        bool(r.get("output", {}).get("lines")) for r in unsupported
                    ),
                },
                "model_text_fields": {
                    "correct": sum(r["correct"] for r in text_rows),
                    "expected": expected,
                },
                "groups": list(groups),
                "baseline": report["text_rule_baseline"],
            }
        )
    )


if __name__ == "__main__":
    main()
