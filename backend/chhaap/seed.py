from uuid import uuid4
from .catalogue import starter_rates
from .models import Customer,RateVersion,RequestRecord,Source
from .schemas import LineSpec

SAMPLE_MESSAGES=[
    ("Riya","Bhai 500 visiting cards chahiye, dono side colour. Last time wala paper. Monday tak ho jayega?"),
    ("Aman","Haan Riya ji, design ready hai? Aur size standard rakhna hai?"),
    ("Riya","Haan standard size. Design aaj bhej dungi. Matte finish chahiye.")]


def seed_workspace(db,shop_id,sample=True):
    db.add(RateVersion(shop_id=shop_id,number=1,config=starter_rates()))
    if not sample:return
    customers=[]
    for name,business in [("Riya Sharma","Studio Riya"),("Nisha Mehta","The Little Oven"),("Arjun Rao","Rao Fitness")]:
        c=Customer(shop_id=shop_id,name=name,business=business);db.add(c);db.flush();customers.append(c)
    request=RequestRecord(shop_id=shop_id,customer_id=customers[0].id,title="Riya's visiting cards",lines=[LineSpec().model_dump(mode="json")])
    db.add(request);db.flush()
    for i,(sender,text) in enumerate(SAMPLE_MESSAGES):db.add(Source(shop_id=shop_id,request_id=request.id,sender=sender,text=text,position=i))
