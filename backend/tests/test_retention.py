from datetime import timedelta
from io import BytesIO
from uuid import UUID

from PIL import Image

from chhaap.db import shop_session
from chhaap.models import Source, now


def test_cleanup_removes_expired_raw_sources_but_preserves_business_and_other_shop(client_factory):
    c = client_factory()
    shop = UUID(c.post("/api/v1/session/demo").json()["shop"]["id"])
    request = c.get("/api/v1/requests").json()["items"][0]
    other = client_factory()
    other.post("/api/v1/session/demo")
    other_request = other.get("/api/v1/requests").json()["items"][0]
    image = BytesIO()
    Image.new("RGB", (10, 10), "red").save(image, "PNG")
    uploaded = c.post(
        f"/api/v1/requests/{request['id']}/attachments",
        files={"file": ("sample.png", image.getvalue(), "image/png")},
    ).json()
    image_id = next(s["id"] for s in uploaded["sources"] if s["kind"] == "image")
    with shop_session(shop) as db:
        for s in db.query(Source).all():
            s.created_at = now() - timedelta(days=100)
    result = c.post("/api/v1/settings/cleanup")
    assert result.status_code == 200, result.text
    assert result.json()["removed_sources"] >= 1
    assert c.get(f"/api/v1/media/{image_id}").status_code == 404
    saved = c.get(f"/api/v1/requests/{request['id']}").json()
    assert saved["lines"] == uploaded["lines"]
    assert saved["sources"] == []
    assert len(other.get(f"/api/v1/requests/{other_request['id']}").json()["sources"]) > 0
