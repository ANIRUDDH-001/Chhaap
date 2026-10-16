from uuid import UUID
from fastapi import FastAPI,Depends,HTTPException,Request,Response
from pydantic import BaseModel,Field
from sqlalchemy import select

from . import security
from .db import shop_session
from .models import RequestRecord
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
        return {"items":[{"id":str(r.id),"title":r.title} for r in db.scalars(select(RequestRecord).order_by(RequestRecord.created_at.desc()).limit(100))]}
