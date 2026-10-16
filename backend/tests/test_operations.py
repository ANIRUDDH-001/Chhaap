from test_quotes import reviewed_request,issue


def accepted_order(client_factory):
    c,req=reviewed_request(client_factory);q=issue(c,req)
    c.post(f"/api/v1/quotes/{q['id']}/response",json={'response':'accepted','expected_revision':q['revision'],'note':'Sample acceptance'})
    return c,c.get('/api/v1/orders').json()['items'][0]


def test_printing_requires_proof_approval(client_factory):
    c,order=accepted_order(client_factory)
    assert c.post(f"/api/v1/orders/{order['id']}/transition",json={'stage':'printing','expected_revision':order['revision']}).status_code==409
    result=c.post(f"/api/v1/orders/{order['id']}/transition",json={'stage':'approved_for_print','expected_revision':order['revision'],'note':'Artwork checked with customer'})
    assert result.status_code==200,result.text
    assert result.json()['stage']=='approved_for_print'


def test_payment_idempotency_refunds_and_overpayment_credit(client_factory):
    c,order=accepted_order(client_factory);url=f"/api/v1/orders/{order['id']}/payments"
    body={'kind':'receipt','amount':160000,'method':'Cash','idempotency_key':'receipt-1'}
    first=c.post(url,json=body);assert first.status_code==201,first.text
    c.post(url,json=body)
    current=c.get(f"/api/v1/orders/{order['id']}").json()
    assert current['received']==160000
    assert current['balance']==-10000
    assert len(current['payments'])==1
    assert c.post(url,json={'kind':'refund','amount':170000,'idempotency_key':'refund-bad'}).status_code==422
    assert c.post(url,json={'kind':'refund','amount':10000,'idempotency_key':'refund-1'}).status_code==201
    assert c.get(f"/api/v1/orders/{order['id']}").json()['balance']==0


def test_reports_do_not_count_quotes_as_receipts(client_factory):
    c,order=accepted_order(client_factory)
    result=c.get('/api/v1/reports').json()
    assert result['issued_quote_value']==150000
    assert result['received']==0
    assert result['outstanding']==150000


def test_order_and_payment_access_is_tenant_scoped(client_factory):
    a,order=accepted_order(client_factory);b=client_factory();b.post('/api/v1/session/demo')
    assert b.get(f"/api/v1/orders/{order['id']}").status_code==404
    assert b.post(f"/api/v1/orders/{order['id']}/payments",json={'kind':'receipt','amount':100,'idempotency_key':'guess'}).status_code==404
