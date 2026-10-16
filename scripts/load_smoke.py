"""Bounded local smoke, deliberately excluding inference and claims of production scale."""

import json
import statistics
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from sqlalchemy import insert
from chhaap.catalogue import starter_rates
from chhaap.db import shop_session
from chhaap.models import Order, Quote, RequestRecord, now
from chhaap.pricing import price_quote
from chhaap.schemas import LineSpec

BASE = "http://127.0.0.1:8767/api/v1"
with httpx.Client(timeout=30) as setup:
    response = setup.post(BASE + "/session/demo")
    response.raise_for_status()
    shop = UUID(response.json()["shop"]["id"])
    cookies = dict(setup.cookies)
line = LineSpec(paper="350", confirmed=True).model_dump(mode="json")
snapshot = price_quote([LineSpec(**line)], starter_rates()).model_dump(mode="json")
requests = []
quotes = []
orders = []
for index in range(1000):
    rid = uuid4()
    qid = uuid4()
    requests.append(
        dict(
            id=rid,
            shop_id=shop,
            title=f"Fictional load request {index}",
            lines=[line],
            delivery_date="2026-11-01",
            delivery_confirmed=True,
        )
    )
    quotes.append(
        dict(
            id=qid,
            shop_id=shop,
            request_id=rid,
            series_id=uuid4(),
            number=f"LOAD-{index}",
            status="accepted",
            snapshot=snapshot,
            expires_at=now() + timedelta(days=7),
            idempotency_key=f"load-{index}",
        )
    )
    orders.append(
        dict(
            id=uuid4(),
            shop_id=shop,
            quote_id=qid,
            number=f"JOB-LOAD-{index}",
            snapshot=snapshot,
            total=snapshot["total"],
        )
    )
with shop_session(shop) as db:
    db.execute(insert(RequestRecord), requests)
    db.execute(insert(Quote), quotes)
    db.execute(insert(Order), orders)


clients = threading.local()


def run(index):
    if not hasattr(clients, "client"):
        clients.client = httpx.Client(cookies=cookies, timeout=30)
    route = ["/requests", "/reports", "/quotes/preview"][index % 3]
    start = time.perf_counter()
    client = clients.client
    response = (
        client.post(BASE + route, json={"lines": [line]})
        if route.endswith("preview")
        else client.get(BASE + route)
    )
    return {
        "route": route,
        "status": response.status_code,
        "ms": round((time.perf_counter() - start) * 1000, 2),
    }


started = time.perf_counter()
with ThreadPoolExecutor(max_workers=8) as pool:
    rows = list(pool.map(run, range(200)))
elapsed = time.perf_counter() - started
latencies = sorted(r["ms"] for r in rows)
summary = {
    "scope": "Local bounded smoke: 1,000 synthetic requests, quotes and orders; 8 concurrent clients; inference excluded. Not the 100k-record/20-client design target.",
    "requests": len(rows),
    "concurrency": 8,
    "failures": sum(r["status"] != 200 for r in rows),
    "p50_ms": statistics.median(latencies),
    "p95_ms": latencies[int(len(rows) * 0.95) - 1],
    "elapsed_seconds": round(elapsed, 2),
    "requests_per_second": round(len(rows) / elapsed, 2),
    "shop_id": str(shop),
    "results": rows,
}
target = Path(__file__).resolve().parents[1] / "eval" / "load-smoke.json"
target.write_text(json.dumps(summary, indent=2))
print(json.dumps({k: v for k, v in summary.items() if k != "results"}))
