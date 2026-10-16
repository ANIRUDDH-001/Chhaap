import os
from pathlib import Path

import pytest
from dotenv import dotenv_values

config=dotenv_values(Path(__file__).resolve().parents[2]/'.env')
if config.get('TEST_DATABASE_URL'):
    os.environ['DATABASE_URL']=config['TEST_DATABASE_URL']
    os.environ['DATABASE_ADMIN_URL']=config['DATABASE_ADMIN_URL'].rsplit('/',1)[0]+'/chhaap_test'


@pytest.fixture(scope='session')
def db_ready():
    from chhaap.migrate import upgrade
    upgrade()


@pytest.fixture
def client_factory(db_ready):
    from fastapi.testclient import TestClient
    from chhaap.api import app
    clients=[]
    def create():
        c=TestClient(app,base_url='http://testserver');clients.append(c);return c
    yield create
    for c in clients:c.close()
