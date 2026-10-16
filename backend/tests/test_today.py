from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import insert
from test_quotes import issue, reviewed_request

from chhaap.db import shop_session
from chhaap.models import Order, Quote, RequestRecord, now


def test_today_counts_and_queues_include_older_active_work_after_fifty_closed_records(client_factory):
    c, req = reviewed_request(client_factory)
    q = issue(c, req)
    c.post(
        "/api/v1/quotes/" + q["id"] + "/response",
        json={"response": "accepted", "expected_revision": q["revision"]},
    )
    original_order = c.get("/api/v1/orders").json()["items"][0]
    shop = UUID(c.get("/api/v1/session").json()["shop"]["id"])
    with shop_session(shop) as db:
        db.get(RequestRecord, UUID(req["id"])).status = "needs_review"
        requests = []
        quotes = []
        orders = []
        for index in range(55):
            rid = uuid4()
            qid = uuid4()
            created = now() + timedelta(seconds=index + 1)
            requests.append(
                dict(
                    id=rid,
                    shop_id=shop,
                    title="Newer ready request",
                    status="ready",
                    lines=req["lines"],
                    created_at=created,
                )
            )
            quotes.append(
                dict(
                    id=qid,
                    shop_id=shop,
                    request_id=rid,
                    number=f"CLOSED-{index}",
                    status="accepted",
                    snapshot=q["snapshot"],
                    expires_at=now() + timedelta(days=7),
                    idempotency_key=f"closed-{index}",
                    created_at=created,
                )
            )
            orders.append(
                dict(
                    shop_id=shop,
                    quote_id=qid,
                    number=f"CLOSED-{index}",
                    stage="delivered",
                    snapshot=q["snapshot"],
                    total=150000,
                    created_at=created,
                )
            )
        db.execute(insert(RequestRecord), requests)
        db.execute(insert(Quote), quotes)
        db.execute(insert(Order), orders)
    report = c.get("/api/v1/reports").json()
    assert report["requests_to_review"] == 1
    assert report["active_orders"] == 1
    assert c.get("/api/v1/requests?queue=true").json()["items"][0]["id"] == req["id"]
    assert c.get("/api/v1/orders?queue=true").json()["items"][0]["id"] == original_order["id"]
    assert len(c.get("/api/v1/orders?status=active").json()["items"]) == 1
