from datetime import date
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel,Field
from sqlalchemy import select

from .models import Customer,RequestRecord,Source,Job
from .schemas import LineSpec


def owned(db,model,record_id,lock=False):
    query=select(model).where(model.id==record_id)
    if lock:query=query.with_for_update()
    result=db.scalar(query)
    if not result:raise HTTPException(404,"This record was not found in your shop")
    return result


def check_revision(record,expected):
    if record.revision!=expected:raise HTTPException(409,"This draft changed in another view. Refresh and review the latest version.")


def customer_data(customer):
    return {"id":str(customer.id),"name":customer.name,"business":customer.business,"phone":customer.phone,"email":customer.email}


def source_data(source):
    return {"id":str(source.id),"kind":source.kind,"text":source.text,"sender":source.sender,"position":source.position,"url":f"/api/v1/media/{source.id}" if source.media_path else None}


def request_data(db,record,detail=True):
    customer=db.get(Customer,record.customer_id) if record.customer_id else None
    result={"id":str(record.id),"title":record.title,"customer":customer_data(customer) if customer else None,"revision":record.revision,"status":record.status,"lines":record.lines,"delivery_date":record.delivery_date,"delivery_confirmed":record.delivery_confirmed,"notes":record.notes,"created_at":record.created_at.isoformat()}
    if detail:
        result["sources"]=[source_data(s) for s in db.scalars(select(Source).where(Source.request_id==record.id).order_by(Source.position))]
        result["extraction"]=record.extraction
        job=db.scalar(select(Job).where(Job.request_id==record.id).order_by(Job.created_at.desc()).limit(1))
        result["job"]={"id":str(job.id),"status":job.status,"error":job.error} if job else None
    return result


class CreateRequest(BaseModel):
    customer_id:UUID|None=None
    customer_name:str=Field(default="Walk-in customer",min_length=1,max_length=150)
    business:str=Field(default="",max_length=200)
    title:str=Field(default="New print request",min_length=1,max_length=200)
    text:str=Field(default="",max_length=20000)


class PatchRequest(BaseModel):
    expected_revision:int=Field(ge=1)
    title:str=Field(min_length=1,max_length=200)
    lines:list[LineSpec]=Field(min_length=1,max_length=30)
    delivery_date:date|None=None
    delivery_confirmed:bool=False
    notes:str=Field(default="",max_length=3000)


class AppendSource(BaseModel):
    expected_revision:int=Field(ge=1)
    text:str=Field(min_length=1,max_length=20000)
    sender:str=Field(default="Customer",max_length=100)


def create_request(db,shop_id,body):
    if body.customer_id:customer=owned(db,Customer,body.customer_id)
    else:
        customer=Customer(shop_id=shop_id,name=body.customer_name,business=body.business);db.add(customer);db.flush()
    record=RequestRecord(shop_id=shop_id,customer_id=customer.id,title=body.title,lines=[LineSpec().model_dump(mode="json")])
    db.add(record);db.flush()
    if body.text:db.add(Source(shop_id=shop_id,request_id=record.id,text=body.text,sender=body.customer_name,position=0));db.flush()
    return request_data(db,record)


def patch_request(db,record,body):
    check_revision(record,body.expected_revision)
    record.title=body.title;record.lines=[line.model_dump(mode="json") for line in body.lines]
    record.delivery_date=body.delivery_date.isoformat() if body.delivery_date else None
    record.delivery_confirmed=body.delivery_confirmed;record.notes=body.notes;record.revision+=1
    record.status="ready" if all(line.confirmed for line in body.lines) and body.delivery_date and body.delivery_confirmed else "needs_review"
    db.flush();return request_data(db,record)


def invalidate(record):
    record.lines=[{**line,"confirmed":False} for line in record.lines]
    record.delivery_confirmed=False;record.status="needs_review";record.revision+=1


def append_source(db,record,body):
    check_revision(record,body.expected_revision)
    sources=list(db.scalars(select(Source).where(Source.request_id==record.id)))
    if sum(len(s.text) for s in sources)+len(body.text)>20000:raise HTTPException(422,"A request can contain at most 20,000 text characters")
    db.add(Source(shop_id=record.shop_id,request_id=record.id,text=body.text,sender=body.sender,position=max([s.position for s in sources],default=-1)+1))
    invalidate(record);db.flush();return request_data(db,record)
