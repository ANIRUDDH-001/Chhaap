from uuid import UUID
from fastapi import FastAPI,Depends,HTTPException,Request,Response,UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel,Field
from sqlalchemy import select

from . import security
from .db import shop_session
from .models import RequestRecord,Source
from .requests import CreateRequest,PatchRequest,AppendSource,owned,request_data,create_request,patch_request,append_source,invalidate
from .media import store_image,media_path,MAX_BYTES
from .catalogue import catalogue
from .settings import settings

app=FastAPI(title="Chhaap",version="0.1.0")


@app.middleware("http")
async def mutation_origin(request:Request,call_next):
    origin=request.headers.get("origin")
    if request.method not in ("GET","HEAD","OPTIONS") and origin and origin not in {settings.frontend_origin,str(request.base_url).rstrip('/')}:return Response('{"detail":"This origin is not allowed"}',status_code=403,media_type="application/json")
    return await call_next(request)


class Register(BaseModel):
    email:str=Field(min_length=5,max_length=254,pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password:str=Field(min_length=12,max_length=200)
    name:str=Field(min_length=1,max_length=100)
    shop_name:str=Field(min_length=1,max_length=150)


class Login(BaseModel):
    email:str
    password:str


@app.get('/api/v1/health')
def health():return {"status":"ok","service":"chhaap"}


@app.get('/api/v1/session')
def session(identity=Depends(security.get_identity)):return security.session_info(identity)


@app.post('/api/v1/session/demo')
def demo(request:Request,response:Response):
    token=security.create_workspace();security.set_cookie(response,token)
    return token_info(token)


def token_info(token):
    from sqlalchemy.orm import Session
    from .db import engine
    from .models import AuthSession
    with Session(engine) as db:
        auth=db.get(AuthSession,security.token_hash(token))
        return security.session_info({"shop_id":auth.shop_id,"owner_id":auth.owner_id})


@app.post('/api/v1/auth/register',status_code=201)
def register(body:Register,response:Response):
    token=security.create_workspace(body.shop_name,body.email,body.password,body.name);security.set_cookie(response,token);return token_info(token)


@app.post('/api/v1/auth/login')
def login(body:Login,response:Response):
    token=security.login(body.email,body.password);security.set_cookie(response,token);return token_info(token)


@app.post('/api/v1/auth/logout')
def logout(response:Response,identity=Depends(security.get_identity)):
    security.logout(identity);response.delete_cookie('chhaap_session',path='/');return {"ok":True}


@app.get('/api/v1/requests')
def requests(identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:
        return {"items":[request_data(db,r,False) for r in db.scalars(select(RequestRecord).order_by(RequestRecord.created_at.desc()).limit(100))]}


@app.get('/api/v1/catalogue')
def products(identity=Depends(security.get_identity)):return {"items":catalogue()}


@app.post('/api/v1/requests',status_code=201)
def new_request(body:CreateRequest,identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:return create_request(db,identity['shop_id'],body)


@app.get('/api/v1/requests/{record_id}')
def get_request(record_id:UUID,identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:return request_data(db,owned(db,RequestRecord,record_id))


@app.patch('/api/v1/requests/{record_id}')
def update_request(record_id:UUID,body:PatchRequest,identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:return patch_request(db,owned(db,RequestRecord,record_id,True),body)


@app.post('/api/v1/requests/{record_id}/sources',status_code=201)
def add_source(record_id:UUID,body:AppendSource,identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:return append_source(db,owned(db,RequestRecord,record_id,True),body)


@app.post('/api/v1/requests/{record_id}/attachments',status_code=201)
async def upload_source(record_id:UUID,file:UploadFile,identity=Depends(security.get_identity)):
    data=await file.read(MAX_BYTES+1)
    with shop_session(identity['shop_id']) as db:
        record=owned(db,RequestRecord,record_id,True)
        sources=list(db.scalars(select(Source).where(Source.request_id==record.id)))
        if sum(s.kind=='image' for s in sources)>=5:raise HTTPException(422,"A request can include up to five screenshots")
        key=store_image(identity['shop_id'],data)
        db.add(Source(shop_id=identity['shop_id'],request_id=record.id,kind='image',sender='Screenshot',media_path=key,mime='image/webp',position=max([s.position for s in sources],default=-1)+1))
        invalidate(record);db.flush();return request_data(db,record)


@app.get('/api/v1/media/{source_id}')
def get_media(source_id:UUID,identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:
        source=owned(db,Source,source_id)
        if not source.media_path:raise HTTPException(404,"This source has no screenshot")
        return FileResponse(media_path(source.media_path),media_type='image/webp',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
