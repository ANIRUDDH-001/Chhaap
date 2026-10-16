import logging
import threading
import time
from datetime import timedelta
from uuid import uuid4

import httpx
from sqlalchemy import select, text

from .catalogue import catalogue
from .db import engine, shop_session
from .inference import OllamaProvider
from .models import Job, RequestRecord, Source, now

log = logging.getLogger("chhaap.worker")


def claim_job(worker):
    with engine.begin() as db:
        row = (
            db.execute(text("SELECT * FROM public.claim_chhaap_job(:worker)"), {"worker": worker})
            .mappings()
            .first()
        )
        return {"id": row["job_id"], "shop_id": row["tenant_id"], "worker": worker} if row else None


def complete_job(claim, result):
    with shop_session(claim["shop_id"]) as db:
        job = db.scalar(select(Job).where(Job.id == claim["id"]).with_for_update())
        if (
            not job
            or job.status != "running"
            or job.lease_owner != claim["worker"]
            or job.lease_until <= now()
        ):
            return False
        record = db.scalar(select(RequestRecord).where(RequestRecord.id == job.request_id).with_for_update())
        if not record or record.revision != job.source_revision:
            job.status = "stale"
            job.error = (
                "The draft changed while this extraction ran. Extract again to use the latest messages."
            )
            return False
        job.result = result
        job.status = "completed"
        job.lease_until = None
        record.extraction = result
        record.status = "needs_review"
        # Suggestions live separately; only the person reviewing may apply them to the draft.
        return True


def fail_job(claim, error, transient=False):
    with shop_session(claim["shop_id"]) as db:
        job = db.scalar(select(Job).where(Job.id == claim["id"]).with_for_update())
        if not job or job.status != "running" or job.lease_owner != claim["worker"]:
            return
        job.error = error
        job.lease_until = None
        if transient and job.attempts < 3:
            job.status = "queued"
            job.available_at = now() + timedelta(seconds=2**job.attempts * 3)
        else:
            job.status = "failed"


def heartbeat(claim, stop):
    while not stop.wait(20):
        with shop_session(claim["shop_id"]) as db:
            job = db.scalar(select(Job).where(Job.id == claim["id"]).with_for_update())
            if not job or job.status != "running" or job.lease_owner != claim["worker"]:
                return
            job.lease_until = now() + timedelta(seconds=240)


def run_once(provider=None, worker=None):
    claim = claim_job(worker or str(uuid4()))
    if not claim:
        return False
    with shop_session(claim["shop_id"]) as db:
        job = db.get(Job, claim["id"])
        sources = [
            {"id": str(s.id), "kind": s.kind, "text": s.text, "sender": s.sender, "media_path": s.media_path}
            for s in db.scalars(
                select(Source).where(Source.request_id == job.request_id).order_by(Source.position)
            )
        ]
    stop = threading.Event()
    thread = threading.Thread(target=heartbeat, args=(claim, stop), daemon=True)
    thread.start()
    try:
        complete_job(claim, (provider or OllamaProvider()).extract(sources, catalogue()))
    except (httpx.ConnectError, httpx.TimeoutException):
        fail_job(claim, "The local model is unavailable or timed out. Manual quoting still works.", True)
    except httpx.HTTPStatusError as exc:
        fail_job(
            claim,
            "The model runtime could not process this request. Check its status and retry.",
            exc.response.status_code >= 500,
        )
    except Exception:
        # Provider exceptions may contain verbatim private input or model output.
        log.error("Extraction validation failed for job %s", claim["id"])
        fail_job(claim, "The model output could not be validated. Review the original request manually.")
    finally:
        stop.set()
        thread.join(timeout=1)
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    worker = str(uuid4())
    log.info("Chhaap worker ready")
    while True:
        if not run_once(worker=worker):
            time.sleep(2)
