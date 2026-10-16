from test_quotes import reviewed_request,issue


def test_customer_create_repeat_and_export_are_real_records(client_factory):
    c,req=reviewed_request(client_factory);q=issue(c,req)
    customer=c.post('/api/v1/customers',json={'name':'Test New Customer','business':'Local Studio','phone':'12345','email':''})
    assert customer.status_code==201,customer.text
    repeated=c.post(f"/api/v1/customers/{req['customer']['id']}/repeat")
    assert repeated.status_code==201,repeated.text
    data=repeated.json();assert data['delivery_date'] is None
    assert all(not line['confirmed'] for line in data['lines'])
    exported=c.get('/api/v1/export')
    assert exported.status_code==200
    assert any(row['id']==q['id'] for row in exported.json()['quotes'])
    assert not any('password' in key for key in exported.json())


def test_rate_simulation_does_not_publish(client_factory):
    c,req=reviewed_request(client_factory);rates=c.get('/api/v1/rates').json()
    changed={**rates['config'],'setup':25000}
    simulation=c.post('/api/v1/rates/preview',json={'config':changed,'lines':req['lines']})
    assert simulation.status_code==200,simulation.text
    assert simulation.json()['total']==160000
    assert c.get('/api/v1/rates').json()['number']==rates['number']


def test_settings_persist_and_do_not_change_old_quote(client_factory):
    c,req=reviewed_request(client_factory);q=issue(c,req)
    result=c.patch('/api/v1/settings',json={'name':'Updated Printworks','quote_validity_days':14,'retention_days':7})
    assert result.status_code==200,result.text
    assert c.get('/api/v1/session').json()['shop']['name']=='Updated Printworks'
    assert c.get(f"/api/v1/quotes/{q['id']}").json()['expires_at']==q['expires_at']


def test_duplicate_customer_merge_stays_inside_shop(client_factory):
    c,req=reviewed_request(client_factory)
    dup=c.post('/api/v1/customers',json={'name':'Riya Duplicate'}).json()
    merged=c.post('/api/v1/customers/merge',json={'source_id':dup['id'],'target_id':req['customer']['id']})
    assert merged.status_code==200,merged.text
    assert all(row['id']!=dup['id'] for row in c.get('/api/v1/customers').json()['items'])
    b=client_factory();b.post('/api/v1/session/demo')
    assert b.post('/api/v1/customers/merge',json={'source_id':req['customer']['id'],'target_id':req['customer']['id']}).status_code==404
