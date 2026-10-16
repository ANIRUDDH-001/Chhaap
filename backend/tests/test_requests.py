from io import BytesIO

from PIL import Image


def open_sample(client_factory):
    c = client_factory()
    c.post("/api/v1/session/demo")
    rid = c.get("/api/v1/requests").json()["items"][0]["id"]
    return c, rid


def test_request_patch_persists_and_rejects_stale_revision(client_factory):
    c, rid = open_sample(client_factory)
    request = c.get(f"/api/v1/requests/{rid}").json()
    assert len(request["sources"]) == 3
    body = {
        "expected_revision": request["revision"],
        "title": "Updated request",
        "lines": request["lines"],
        "delivery_date": "2026-10-19",
        "delivery_confirmed": True,
    }
    result = c.patch(f"/api/v1/requests/{rid}", json=body)
    assert result.status_code == 200, result.text
    assert c.get(f"/api/v1/requests/{rid}").json()["title"] == "Updated request"
    assert c.patch(f"/api/v1/requests/{rid}", json=body).status_code == 409


def test_cross_shop_request_and_customer_ids_are_not_usable(client_factory):
    a, rid = open_sample(client_factory)
    b, _ = open_sample(client_factory)
    assert b.get(f"/api/v1/requests/{rid}").status_code == 404
    customer = a.get(f"/api/v1/requests/{rid}").json()["customer"]["id"]
    assert b.post("/api/v1/requests", json={"customer_id": customer, "text": "500 cards"}).status_code == 404


def test_append_source_invalidates_confirmed_fields(client_factory):
    c, rid = open_sample(client_factory)
    req = c.get(f"/api/v1/requests/{rid}").json()
    result = c.post(
        f"/api/v1/requests/{rid}/sources",
        json={"text": "Actually make it 1000 cards", "expected_revision": req["revision"]},
    )
    assert result.status_code == 201, result.text
    assert result.json()["revision"] == req["revision"] + 1
    assert all(not line["confirmed"] for line in result.json()["lines"])


def test_upload_normalizes_image_and_keeps_access_scoped(client_factory):
    a, rid = open_sample(client_factory)
    b, _ = open_sample(client_factory)
    image = BytesIO()
    Image.new("RGB", (50, 70), "white").save(image, "PNG")
    result = a.post(
        f"/api/v1/requests/{rid}/attachments", files={"file": ("chat.png", image.getvalue(), "image/png")}
    )
    assert result.status_code == 201, result.text
    url = result.json()["sources"][-1]["url"]
    assert a.get(url).status_code == 200
    assert b.get(url).status_code == 404
    assert (
        a.post(
            f"/api/v1/requests/{rid}/attachments", files={"file": ("bad.png", b"not an image", "image/png")}
        ).status_code
        == 422
    )


def test_source_length_limit(client_factory):
    c, _ = open_sample(client_factory)
    assert c.post("/api/v1/requests", json={"customer_name": "Test", "text": "x" * 20001}).status_code == 422
