def reviewed_request(client_factory):
    c=client_factory();c.post('/api/v1/session/demo');rid=c.get('/api/v1/requests').json()['items'][0]['id']
    req=c.get(f'/api/v1/requests/{rid}').json();req['lines'][0].update(paper='350',confirmed=True)
    body={k:req[k] for k in ['title','lines']};body.update(expected_revision=req['revision'],delivery_date='2026-10-19',delivery_confirmed=True)
    req=c.patch(f'/api/v1/requests/{rid}',json=body).json()
    return c,req


def issue(c,req,key='issue-1'):
    result=c.post('/api/v1/quotes/issue',json={'request_id':req['id'],'expected_revision':req['revision'],'idempotency_key':key})
    assert result.status_code==201,result.text
    return result.json()


def test_issue_requires_confirmation_and_preserves_snapshot(client_factory):
    c,req=reviewed_request(client_factory)
    preview=c.post('/api/v1/quotes/preview',json={'lines':req['lines']})
    assert preview.status_code==200,preview.text
    assert preview.json()['total']==150000
    q=issue(c,req)
    assert q['snapshot']['total']==150000
    assert issue(c,req)['id']==q['id']
    req['lines'][0]['quantity']=1000
    c.patch(f"/api/v1/requests/{req['id']}",json={**{k:req[k] for k in ['title','lines','delivery_date','delivery_confirmed']},'expected_revision':req['revision']})
    assert c.get(f"/api/v1/quotes/{q['id']}").json()['snapshot']['total']==150000


def test_unreviewed_request_cannot_issue(client_factory):
    c=client_factory();c.post('/api/v1/session/demo');req=c.get('/api/v1/requests').json()['items'][0]
    assert c.post('/api/v1/quotes/issue',json={'request_id':req['id'],'expected_revision':req['revision'],'idempotency_key':'bad'}).status_code==422


def test_acceptance_creates_one_order_and_accepted_quote_cannot_be_revised(client_factory):
    c,req=reviewed_request(client_factory);q=issue(c,req)
    body={'response':'accepted','expected_revision':q['revision'],'note':'Customer confirmed by phone'}
    first=c.post(f"/api/v1/quotes/{q['id']}/response",json=body)
    assert first.status_code==200,first.text
    duplicate=c.post(f"/api/v1/quotes/{q['id']}/response",json=body)
    assert duplicate.status_code==200
    assert len(c.get('/api/v1/orders').json()['items'])==1
    assert c.post(f"/api/v1/quotes/{q['id']}/revise",json={'expected_revision':first.json()['revision']}).status_code==409


def test_rate_changes_do_not_reprice_issued_quotes(client_factory):
    c,req=reviewed_request(client_factory);q=issue(c,req)
    rates=c.get('/api/v1/rates').json();rates['config']['setup']=25000
    result=c.post('/api/v1/rates/publish',json={'expected_version':rates['number'],'config':rates['config']})
    assert result.status_code==201,result.text
    assert c.post('/api/v1/quotes/preview',json={'lines':req['lines']}).json()['total']==160000
    assert c.get(f"/api/v1/quotes/{q['id']}").json()['snapshot']['total']==150000
