def test_sample_workspaces_are_independent(client_factory):
    a,b=client_factory(),client_factory()
    sa=a.post('/api/v1/session/demo').json();sb=b.post('/api/v1/session/demo').json()
    assert sa['shop']['id']!=sb['shop']['id']
    assert a.get('/api/v1/session').json()['shop']['id']==sa['shop']['id']
    assert a.get('/api/v1/requests').json()['items'][0]['id']!=b.get('/api/v1/requests').json()['items'][0]['id']


def test_logout_invalidates_session(client_factory):
    client=client_factory();client.post('/api/v1/session/demo')
    assert client.post('/api/v1/auth/logout').status_code==200
    assert client.get('/api/v1/session').status_code==401


def test_registration_and_login(client_factory):
    import uuid
    client=client_factory();email=f'{uuid.uuid4()}@example.test'
    body={'email':email,'password':'print-counter-123','name':'Test Owner','shop_name':'Test Printworks'}
    assert client.post('/api/v1/auth/register',json=body).status_code==201
    client.post('/api/v1/auth/logout')
    assert client.post('/api/v1/auth/login',json={'email':email,'password':'wrong'}).status_code==401
    assert client.post('/api/v1/auth/login',json={'email':email,'password':body['password']}).status_code==200
    assert client.get('/api/v1/session').json()['shop']['mode']=='private'


def test_mutations_reject_foreign_origins(client_factory):
    client=client_factory();client.post('/api/v1/session/demo')
    assert client.post('/api/v1/auth/logout',headers={'Origin':'https://unrelated.test'}).status_code==403


def test_runtime_role_sees_no_business_rows_without_tenant():
    from chhaap.db import engine
    from sqlalchemy import text
    with engine.connect() as db:
        role=db.execute(text('SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname=current_user')).one()
        assert tuple(role)==(False,False)
        assert db.execute(text('SELECT count(*) FROM requests')).scalar()==0
