from datetime import timedelta
from hashlib import sha256
import secrets
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError,InvalidHashError
from fastapi import HTTPException,Request
from sqlalchemy import select,delete
from sqlalchemy.orm import Session

from .db import engine,shop_session
from .models import AuthSession,Owner,Shop,now
from .settings import settings

hasher=PasswordHasher()


def token_hash(token):return sha256(token.encode()).hexdigest()


def get_identity(request:Request):
    token=request.cookies.get("chhaap_session","")
    if not token:raise HTTPException(401,"Sign in or open a sample shop")
    with Session(engine) as db:
        auth=db.get(AuthSession,token_hash(token))
        if not auth or auth.expires_at<=now():raise HTTPException(401,"Your session expired. Sign in again.")
        return {"shop_id":auth.shop_id,"owner_id":auth.owner_id,"token_hash":auth.token_hash}


def set_cookie(response,token):
    response.set_cookie("chhaap_session",token,httponly=True,secure=settings.cookie_secure,samesite="lax",max_age=86400*7,path="/")


def session_for(db,shop_id,owner_id=None):
    token=secrets.token_urlsafe(40)
    db.add(AuthSession(token_hash=token_hash(token),shop_id=shop_id,owner_id=owner_id,expires_at=now()+timedelta(days=7)))
    return token


def session_info(identity):
    with shop_session(identity['shop_id']) as db:
        shop=db.get(Shop,identity['shop_id'])
        if not shop:raise HTTPException(401,"Workspace no longer exists")
        owner=db.get(Owner,identity['owner_id']) if identity.get('owner_id') else None
        return {"shop":{"id":str(shop.id),"name":shop.name,"mode":shop.mode,"settings":shop.settings},"user":{"name":owner.name if owner else "Aman Kumar","role":"owner"}}


def create_workspace(name="Aman Printworks",email=None,password=None,owner_name=None):
    shop_id=uuid4()
    with shop_session(shop_id) as db:
        shop=Shop(id=shop_id,name=name,mode="private" if email else "sample",settings={"timezone":"Asia/Kolkata","currency":"INR","quote_validity_days":7,"retention_days":30})
        db.add(shop);db.flush();owner=None
        if email:
            if db.scalar(select(Owner).where(Owner.email==email.lower())):raise HTTPException(409,"An account with this email already exists")
            owner=Owner(shop_id=shop_id,email=email.lower(),name=owner_name,password_hash=hasher.hash(password));db.add(owner);db.flush()
        from .seed import seed_workspace
        seed_workspace(db,shop_id,sample=not email)
        token=session_for(db,shop_id,owner.id if owner else None)
    return token


def login(email,password):
    with Session(engine) as db,db.begin():
        owner=db.scalar(select(Owner).where(Owner.email==email.lower()))
        try:valid=owner and hasher.verify(owner.password_hash,password)
        except (VerifyMismatchError,InvalidHashError):valid=False
        if not valid:raise HTTPException(401,"Email or password is incorrect")
        return session_for(db,owner.shop_id,owner.id)


def logout(identity):
    with Session(engine) as db,db.begin():db.execute(delete(AuthSession).where(AuthSession.token_hash==identity['token_hash']))
