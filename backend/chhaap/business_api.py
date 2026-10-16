from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel,Field
from sqlalchemy import select

from .db import shop_session
from .models import Customer,Order,Quote,RateVersion,RequestRecord,Shop
from .operations import Transition,RecordPayment,order_data,transition_order,record_payment,reports
from .quotes import Preview,Issue,QuoteResponse,active_rates,preview,issue_quote,quote_data,record_response
from .requests import owned,customer_data,check_revision,request_data
from .security import get_identity

router=APIRouter(prefix='/api/v1')


@router.get('/rates')
def rates(identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:
        rows=list(db.scalars(select(RateVersion).order_by(RateVersion.number.desc())))
        return {'number':rows[0].number,'config':rows[0].config,'history':[{'number':r.number,'created_at':r.created_at.isoformat()} for r in rows]}


class PublishRates(BaseModel):
    expected_version:int=Field(ge=1)
    config:dict


@router.post('/rates/publish',status_code=201)
def publish_rates(body:PublishRates,identity=Depends(get_identity)):
    from .catalogue import starter_rates
    from .schemas import LineSpec
    from .pricing import price_quote
    with shop_session(identity['shop_id']) as db:
        owned(db,Shop,identity['shop_id'],True);current=active_rates(db)
        if current.number!=body.expected_version:raise HTTPException(409,'The rate card changed. Reload before publishing.')
        config=body.config
        try:
            # Validate every supported pricing family and bounded configurable numbers.
            import json
            if len(json.dumps(config))>20000:raise ValueError('Rate card is too large')
            for key in ['setup','tax_percent','deposit_percent']:
                if not isinstance(config[key],(int,float)) or config[key]<0 or config[key]>(100 if 'percent' in key else 10000000):raise ValueError('Invalid '+key)
            for product in ['cards','flyers']:
                tiers=config[product]['tiers']
                if not tiers or tiers[0][0]!=1 or len(tiers)>20 or any(not isinstance(v,int) or v<0 or v>10000000 for t in tiers for v in t) or any(t[0]<1 for t in tiers):raise ValueError('Invalid quantity tiers')
                if len({t[0] for t in tiers})!=len(tiers):raise ValueError('Duplicate tier quantities')
            for line in [LineSpec(product='cards',paper='350'),LineSpec(product='flyers',paper='130',size='A5'),LineSpec(product='banners',width=2,height=3)]:
                snap=price_quote([line],config)
                if snap.total<0:raise ValueError('Rates cannot produce a negative price')
        except (KeyError,TypeError,ValueError,IndexError) as exc:raise HTTPException(422,'Invalid rate card: '+str(exc))
        config={**config,'version':str(current.number+1)};row=RateVersion(shop_id=identity['shop_id'],number=current.number+1,config=config);db.add(row);db.flush()
        return {'number':row.number,'config':row.config}


@router.post('/quotes/preview')
def price_preview(body:Preview,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return preview(db,body)


@router.post('/quotes/issue',status_code=201)
def issue(body:Issue,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return issue_quote(db,identity['shop_id'],body)


@router.get('/quotes')
def quotes(identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return {'items':[quote_data(db,q) for q in db.scalars(select(Quote).order_by(Quote.created_at.desc()).limit(100))]}


@router.get('/quotes/{quote_id}')
def get_quote(quote_id:UUID,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return quote_data(db,owned(db,Quote,quote_id))


@router.post('/quotes/{quote_id}/response')
def respond(quote_id:UUID,body:QuoteResponse,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return record_response(db,owned(db,Quote,quote_id,True),body)


class Revision(BaseModel):expected_revision:int=Field(ge=1)


@router.post('/quotes/{quote_id}/revise')
def revise(quote_id:UUID,body:Revision,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:
        quote=owned(db,Quote,quote_id,True);check_revision(quote,body.expected_revision)
        if quote.status in {'accepted','superseded','cancelled'}:raise HTTPException(409,'Accepted or closed quotations cannot be edited')
        return {'request_id':str(quote.request_id),'revises_quote_id':str(quote.id)}


@router.get('/orders')
def orders(identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return {'items':[order_data(db,o) for o in db.scalars(select(Order).order_by(Order.created_at.desc()).limit(100))]}


@router.get('/orders/{order_id}')
def get_order(order_id:UUID,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return order_data(db,owned(db,Order,order_id),True)


@router.post('/orders/{order_id}/transition')
def transition(order_id:UUID,body:Transition,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return transition_order(db,owned(db,Order,order_id,True),body)


@router.post('/orders/{order_id}/payments',status_code=201)
def payment(order_id:UUID,body:RecordPayment,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return record_payment(db,owned(db,Order,order_id,True),body)


@router.get('/customers')
def customers(identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return {'items':[customer_data(c) for c in db.scalars(select(Customer).order_by(Customer.name).limit(100))]}


@router.get('/customers/{customer_id}')
def get_customer(customer_id:UUID,identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:
        customer=owned(db,Customer,customer_id)
        return {**customer_data(customer),'quotes':[quote_data(db,q) for q in db.scalars(select(Quote).where(Quote.customer_id==customer_id).order_by(Quote.created_at.desc()))],'orders':[order_data(db,o) for o in db.scalars(select(Order).where(Order.customer_id==customer_id).order_by(Order.created_at.desc()))]}


@router.get('/reports')
def report(identity=Depends(get_identity)):
    with shop_session(identity['shop_id']) as db:return reports(db)
