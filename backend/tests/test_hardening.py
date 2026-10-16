from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
from uuid import UUID

import pytest
from test_quotes import issue, reviewed_request

from chhaap.db import shop_session
from chhaap.models import Quote, now


@pytest.mark.parametrize(
    "family,key,value",
    [
        ("finishing", "gloss", -1),
        ("cards", "minimum", -1),
        ("cards", "papers", {"350": 0, "400": -100}),
        ("print_multipliers", "mono", "-2"),
        ("flyers", "sizes", {"A5": "NaN"}),
        ("banners", "per_sqft", -1),
    ],
)
def test_rate_publication_validates_every_price_component(client_factory, family, key, value):
    c, req = reviewed_request(client_factory)
    rates = c.get("/api/v1/rates").json()
    config = deepcopy(rates["config"])
    config[family][key] = value
    assert (
        c.post(
            "/api/v1/rates/publish", json={"expected_version": rates["number"], "config": config}
        ).status_code
        == 422
    )
    assert c.post("/api/v1/rates/preview", json={"config": config, "lines": req["lines"]}).status_code == 422
    assert c.get("/api/v1/rates").json()["number"] == rates["number"]


def test_expired_and_superseded_quotes_cannot_be_accepted(client_factory):
    c, req = reviewed_request(client_factory)
    first = issue(c, req)
    body = {
        "request_id": req["id"],
        "expected_revision": req["revision"],
        "idempotency_key": "revision",
        "revises_quote_id": first["id"],
    }
    second = c.post("/api/v1/quotes/issue", json=body).json()
    response = {"response": "accepted", "expected_revision": first["revision"]}
    assert c.post(f"/api/v1/quotes/{first['id']}/response", json=response).status_code == 409
    shop = UUID(c.get("/api/v1/session").json()["shop"]["id"])
    with shop_session(shop) as db:
        db.get(Quote, UUID(second["id"])).expires_at = now() - timedelta(seconds=1)
    assert c.get(f"/api/v1/quotes/{second['id']}").json()["status"] == "expired"
    assert (
        c.post(
            f"/api/v1/quotes/{second['id']}/response",
            json={"response": "accepted", "expected_revision": second["revision"]},
        ).status_code
        == 409
    )


def test_concurrent_acceptance_creates_one_order(client_factory):
    c, req = reviewed_request(client_factory)
    q = issue(c, req)
    body = {"response": "accepted", "expected_revision": q["revision"]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: c.post(f"/api/v1/quotes/{q['id']}/response", json=body), range(2)))
    assert [r.status_code for r in results] == [200, 200]
    assert len(c.get("/api/v1/orders").json()["items"]) == 1


def test_issue_key_cannot_be_reused_with_other_adjustments(client_factory):
    c, req = reviewed_request(client_factory)
    issue(c, req)
    result = c.post(
        "/api/v1/quotes/issue",
        json={
            "request_id": req["id"],
            "expected_revision": req["revision"],
            "idempotency_key": "issue-1",
            "adjustments": {"delivery": 10000, "reason": "Courier"},
        },
    )
    assert result.status_code == 409
