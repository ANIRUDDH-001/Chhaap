from chhaap.models import Job,RequestRecord
from chhaap.db import shop_session
from uuid import UUID


def enqueue(client_factory):
    c=client_factory();shop=c.post('/api/v1/session/demo').json()['shop']['id']
    req=c.get('/api/v1/requests').json()['items'][0]
    result=c.post(f"/api/v1/requests/{req['id']}/extract",json={'expected_revision':req['revision']})
    assert result.status_code==202,result.text
    return c,UUID(shop),req,result.json()


def test_worker_completion_cannot_overwrite_a_newer_draft(client_factory):
    from chhaap.worker import claim_job,complete_job
    c,shop,req,job=enqueue(client_factory)
    claim=claim_job('test-stale')
    # Another shop's pending job may be older; only use the matching descriptor.
    while claim and str(claim['id'])!=job['id']:
        complete_job(claim,{'lines':[],'missing':['review'],'evidence':[]});claim=claim_job('test-stale')
    assert claim
    detail=c.get(f"/api/v1/requests/{req['id']}").json()
    c.patch(f"/api/v1/requests/{req['id']}",json={**{k:detail[k] for k in ['title','lines','delivery_date','delivery_confirmed']},'expected_revision':detail['revision'],'title':'Newer saved draft'})
    complete_job(claim,{'lines':[{'product':'cards','quantity':900,'confirmed':False}],'missing':[],'evidence':[]})
    final=c.get(f"/api/v1/requests/{req['id']}").json()
    assert final['title']=='Newer saved draft'
    assert final['lines'][0]['quantity']==500
    assert c.get(f"/api/v1/jobs/{job['id']}").json()['status']=='stale'


def test_enqueue_is_bounded_and_scoped(client_factory):
    c,shop,req,job=enqueue(client_factory)
    again=c.post(f"/api/v1/requests/{req['id']}/extract",json={'expected_revision':req['revision']})
    assert again.json()['id']==job['id']
    other=client_factory();other.post('/api/v1/session/demo')
    assert other.get(f"/api/v1/jobs/{job['id']}").status_code==404

