"""Raw-source cleanup; business specifications and issued records remain intact."""

import argparse
import logging
import time
from datetime import timedelta

from sqlalchemy import create_engine, select, update

from .db import shop_session
from .models import Job, RequestRecord, Shop, Source, now
from .settings import settings


def cleanup_shop(shop_id):
    paths = []
    with shop_session(shop_id) as db:
        shop = db.get(Shop, shop_id)
        cutoff = now() - timedelta(days=shop.settings.get("retention_days", 30))
        sources = list(db.scalars(select(Source).where(Source.created_at < cutoff)))
        affected = {s.request_id for s in sources}
        for record_id in sorted(affected):
            record = db.scalar(select(RequestRecord).where(RequestRecord.id == record_id).with_for_update())
            record.extraction = None
            record.revision += 1  # An in-flight extraction must not restore removed source content.
            db.execute(
                update(Job)
                .where(Job.request_id == record_id)
                .values(
                    result=None, status="stale", error="Raw sources expired under the shop retention policy."
                )
            )
        for source in sources:
            if source.media_path:
                paths.append(source.media_path)
            db.delete(source)
    root = settings.data_dir.resolve()
    for key in paths:
        path = (root / key).resolve()
        # Only generated files belonging to this tenant may be removed.
        if path.is_relative_to(root / str(shop_id)):
            path.unlink(missing_ok=True)
    return {"removed_sources": len(sources), "affected_requests": len(affected)}


def cleanup_all():
    admin = create_engine(settings.database_admin_url)
    try:
        with admin.connect() as db:
            ids = list(db.scalars(select(Shop.id)))
        for shop_id in ids:
            cleanup_shop(shop_id)
    finally:
        admin.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true", help="Run once daily as an operations process")
    args = parser.parse_args()
    while True:
        try:
            cleanup_all()
        except Exception:
            logging.error("Raw-source retention cleanup failed; check database and storage availability")
            if not args.loop:
                raise SystemExit(1)
        if not args.loop:
            break
        time.sleep(86400)
