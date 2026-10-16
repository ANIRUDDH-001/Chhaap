def test_readiness_checks_database_without_requiring_model(client_factory):
    c = client_factory()
    r = c.get("/api/v1/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "ready"
