def test_source_order_persists_and_requires_current_revision(client_factory):
    c = client_factory()
    c.post("/api/v1/session/demo")
    req = c.get("/api/v1/requests").json()["items"][0]
    detail = c.get("/api/v1/requests/" + req["id"]).json()
    original = [s["id"] for s in detail["sources"]]
    changed = c.patch(
        "/api/v1/requests/" + req["id"] + "/source-order",
        json={"expected_revision": detail["revision"], "source_ids": list(reversed(original))},
    )
    assert changed.status_code == 200, changed.text
    assert [s["id"] for s in changed.json()["sources"]] == list(reversed(original))
    assert changed.json()["delivery_confirmed"] is False
    assert (
        c.patch(
            "/api/v1/requests/" + req["id"] + "/source-order",
            json={"expected_revision": detail["revision"], "source_ids": original},
        ).status_code
        == 409
    )
    assert (
        c.patch(
            "/api/v1/requests/" + req["id"] + "/source-order",
            json={"expected_revision": changed.json()["revision"], "source_ids": original[:1]},
        ).status_code
        == 422
    )
