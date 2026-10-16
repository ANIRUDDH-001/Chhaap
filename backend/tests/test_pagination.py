def test_lists_have_scoped_search_and_stable_cursor_pages(client_factory):
    c = client_factory()
    c.post("/api/v1/session/demo")
    for name in ["Cursor Alpha", "Cursor Beta", "Cursor Gamma"]:
        assert c.post("/api/v1/customers", json={"name": name}).status_code == 201
    first = c.get("/api/v1/customers?limit=2&q=Cursor").json()
    assert len(first["items"]) == 2
    assert first["next_cursor"]
    second = c.get(
        "/api/v1/customers", params={"limit": 2, "q": "Cursor", "cursor": first["next_cursor"]}
    ).json()
    assert len(second["items"]) == 1 and second["next_cursor"] is None
    assert {r["id"] for r in first["items"]}.isdisjoint(r["id"] for r in second["items"])
    other = client_factory()
    other.post("/api/v1/session/demo")
    assert other.get("/api/v1/customers?q=Cursor").json()["items"] == []
    assert c.get("/api/v1/customers?cursor=invalid").status_code == 422
