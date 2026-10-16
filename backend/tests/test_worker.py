from uuid import UUID

from chhaap.db import shop_session
from chhaap.models import Job


def enqueue(client_factory):
    c = client_factory()
    shop = c.post("/api/v1/session/demo").json()["shop"]["id"]
    req = c.get("/api/v1/requests").json()["items"][0]
    result = c.post(f"/api/v1/requests/{req['id']}/extract", json={"expected_revision": req["revision"]})
    assert result.status_code == 202, result.text
    return c, UUID(shop), req, result.json()


def test_worker_completion_cannot_overwrite_a_newer_draft(client_factory):
    from chhaap.worker import claim_job, complete_job

    c, shop, req, job = enqueue(client_factory)
    claim = claim_job("test-stale")
    # Another shop's pending job may be older; only use the matching descriptor.
    while claim and str(claim["id"]) != job["id"]:
        complete_job(claim, {"lines": [], "missing": ["review"], "evidence": []})
        claim = claim_job("test-stale")
    assert claim
    detail = c.get(f"/api/v1/requests/{req['id']}").json()
    c.patch(
        f"/api/v1/requests/{req['id']}",
        json={
            **{k: detail[k] for k in ["title", "lines", "delivery_date", "delivery_confirmed"]},
            "expected_revision": detail["revision"],
            "title": "Newer saved draft",
        },
    )
    complete_job(
        claim,
        {"lines": [{"product": "cards", "quantity": 900, "confirmed": False}], "missing": [], "evidence": []},
    )
    final = c.get(f"/api/v1/requests/{req['id']}").json()
    assert final["title"] == "Newer saved draft"
    assert final["lines"][0]["quantity"] == 500
    assert c.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "stale"


def test_enqueue_is_bounded_and_scoped(client_factory):
    c, shop, req, job = enqueue(client_factory)
    again = c.post(f"/api/v1/requests/{req['id']}/extract", json={"expected_revision": req["revision"]})
    assert again.json()["id"] == job["id"]
    other = client_factory()
    other.post("/api/v1/session/demo")
    assert other.get(f"/api/v1/jobs/{job['id']}").status_code == 404


def take_job(job_id, worker):
    from chhaap.worker import claim_job, complete_job

    claim = claim_job(worker)
    while claim and str(claim["id"]) != job_id:
        complete_job(claim, {"lines": [], "missing": [], "evidence": []})
        claim = claim_job(worker)
    assert claim
    return claim


def test_expired_lease_is_reclaimed_and_old_worker_cannot_complete(client_factory):
    from datetime import timedelta

    from chhaap.models import now
    from chhaap.worker import claim_job, complete_job, fail_job

    c, shop, req, job = enqueue(client_factory)
    old = take_job(job["id"], "old-worker")
    with shop_session(shop) as db:
        db.get(Job, UUID(job["id"])).lease_until = now() - timedelta(seconds=1)
    new = claim_job("new-worker")
    assert new and str(new["id"]) == job["id"]
    assert complete_job(old, {"lines": []}) is False
    fail_job(new, "Temporary outage", transient=True)
    with shop_session(shop) as db:
        row = db.get(Job, UUID(job["id"]))
        assert row.status == "queued" and row.attempts == 2
        row.available_at = now() - timedelta(seconds=1)
    final = claim_job("last-worker")
    fail_job(final, "Temporary outage", transient=True)
    assert c.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "failed"
    assert claim_job("no-fourth-attempt") is None


def test_worker_logs_never_include_model_content(client_factory, caplog):
    from chhaap.worker import run_once

    c, shop, req, job = enqueue(client_factory)
    # Make this job the oldest, then release it for the real run_once path.
    take_job(job["id"], "prepare")
    with shop_session(shop) as db:
        row = db.get(Job, UUID(job["id"]))
        row.status = "queued"
        row.lease_until = None

    class BrokenProvider:
        def extract(self, sources, catalogue):
            raise ValueError("PRIVATE CUSTOMER MESSAGE 999888777")

    assert run_once(BrokenProvider(), "privacy-check")
    assert "PRIVATE CUSTOMER" not in caplog.text
    assert c.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "failed"
