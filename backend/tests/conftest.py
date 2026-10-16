import os
from pathlib import Path

import pytest
from dotenv import dotenv_values

config = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
test_url = os.environ.get("TEST_DATABASE_URL") or config.get("TEST_DATABASE_URL")
admin_url = os.environ.get("DATABASE_ADMIN_URL") or config.get("DATABASE_ADMIN_URL")
if not test_url or not admin_url or not test_url.rsplit("/", 1)[-1].startswith("chhaap_test"):
    raise RuntimeError("Tests require a separate TEST_DATABASE_URL named chhaap_test*")
os.environ["DATABASE_URL"] = test_url
os.environ["DATABASE_ADMIN_URL"] = admin_url.rsplit("/", 1)[0] + "/" + test_url.rsplit("/", 1)[-1]


@pytest.fixture(scope="session")
def db_ready():
    from chhaap.migrate import upgrade

    upgrade()


@pytest.fixture
def client_factory(db_ready):
    from fastapi.testclient import TestClient

    from chhaap.api import app

    clients = []

    def create():
        c = TestClient(app, base_url="http://testserver")
        clients.append(c)
        return c

    yield create
    for c in clients:
        c.close()
