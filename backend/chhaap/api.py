from uuid import UUID
from fastapi import FastAPI,Depends,HTTPException,Request,Response,UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel,Field
from sqlalchemy import select,func

from . import security
from .db import shop_session
from .models import RequestRecord,Source,Job
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


class ExtractRequest(BaseModel):
    expected_revision:int=Field(ge=1)


def job_data(job):return {'id':str(job.id),'status':job.status,'attempts':job.attempts,'error':job.error,'result':job.result}


@app.post('/api/v1/requests/{record_id}/extract',status_code=202)
def extract_request(record_id:UUID,body:ExtractRequest,identity=Depends(security.get_identity)):
    from .requests import check_revision
    with shop_session(identity['shop_id']) as db:
        record=owned(db,RequestRecord,record_id,True);check_revision(record,body.expected_revision)
        existing=db.scalar(select(Job).where(Job.request_id==record.id,Job.source_revision==record.revision,Job.status.in_(['queued','running'])))
        if existing:return job_data(existing)
        if not db.scalar(select(Source.id).where(Source.request_id==record.id).limit(1)):raise HTTPException(422,'Add a message or screenshot first')
        pending=db.scalar(select(func.count()).select_from(Job).where(Job.status.in_(['queued','running'])))
        if pending>=3:raise HTTPException(429,'Three requests are already processing for this shop. Wait for one to finish.')
        job=Job(shop_id=identity['shop_id'],request_id=record.id,source_revision=record.revision);db.add(job);db.flush();return job_data(job)


@app.get('/api/v1/jobs/{job_id}')
def get_job(job_id:UUID,identity=Depends(security.get_identity)):
    with shop_session(identity['shop_id']) as db:return job_data(owned(db,Job,job_id))


@app.get('/api/v1/inference/status')
def inference_status(identity=Depends(security.get_identity)):
    import httpx
    try:
        response=httpx.get(settings.ollama_url+'/api/tags',timeout=2);response.raise_for_status();models=[m['name'] for m in response.json().get('models',[])]
        return {'available':settings.ollama_model in models,'model':settings.ollama_model,'location':'Local model server','models':models}
    except Exception:return {'available':False,'model':settings.ollama_model,'location':'Local model server','models':[]}
