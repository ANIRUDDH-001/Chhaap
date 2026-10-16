from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update

from .db import shop_session
from .models import Customer, Order, Quote, RateVersion, RequestRecord, Shop
from .operations import order_data
from .pricing import price_quote
from .quotes import audit, quote_data
from .requests import check_revision, customer_data, owned, request_data
from .schemas import LineSpec
from .security import get_identity

router = APIRouter(prefix="/api/v1")


@router.post("/settings/cleanup")
def cleanup_sources(identity=Depends(get_identity)):
    from .retention import cleanup_shop

    return cleanup_shop(identity["shop_id"])


class CustomerInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    business: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=254)


@router.post("/customers", status_code=201)
def add_customer(body: CustomerInput, identity=Depends(get_identity)):
    with shop_session(identity["shop_id"]) as db:
        customer = Customer(shop_id=identity["shop_id"], **body.model_dump())
        db.add(customer)
        db.flush()
        return customer_data(customer)


class CustomerEdit(CustomerInput):
    expected_revision: int = Field(ge=1)


@router.patch("/customers/{customer_id}")
def edit_customer(customer_id: UUID, body: CustomerEdit, identity=Depends(get_identity)):
    with shop_session(identity["shop_id"]) as db:
        customer = owned(db, Customer, customer_id, True)
        check_revision(customer, body.expected_revision)
        for k, v in body.model_dump(exclude={"expected_revision"}).items():
            setattr(customer, k, v)
        customer.revision += 1
        db.flush()
        return customer_data(customer)


class MergeCustomers(BaseModel):
    source_id: UUID
    target_id: UUID


@router.post("/customers/merge")
def merge_customers(body: MergeCustomers, identity=Depends(get_identity)):
    with shop_session(identity["shop_id"]) as db:
        for cid in sorted({body.source_id, body.target_id}):
            owned(db, Customer, cid, True)
        if body.source_id == body.target_id:
            raise HTTPException(422, "Choose two different customers")
        for model in [RequestRecord, Quote, Order]:
            db.execute(
                update(model).where(model.customer_id == body.source_id).values(customer_id=body.target_id)
            )
        db.execute(delete(Customer).where(Customer.id == body.source_id))
        audit(
            db,
            identity["shop_id"],
            body.target_id,
            "customer_merged",
            {"previous_customer_id": str(body.source_id)},
        )
        return customer_data(owned(db, Customer, body.target_id))


@router.post("/customers/{customer_id}/repeat", status_code=201)
def repeat_customer(customer_id: UUID, identity=Depends(get_identity)):
    from .schemas import LineSpec

    with shop_session(identity["shop_id"]) as db:
        customer = owned(db, Customer, customer_id)
        previous = db.scalar(
            select(RequestRecord)
            .where(RequestRecord.customer_id == customer_id)
            .order_by(RequestRecord.created_at.desc())
            .limit(1)
        )
        lines = (
            [{**line, "confirmed": False} for line in previous.lines]
            if previous
            else [LineSpec().model_dump(mode="json")]
        )
        record = RequestRecord(
            shop_id=identity["shop_id"],
            customer_id=customer_id,
            title=customer.name + " — repeat request",
            lines=lines,
            notes="Based on request " + str(previous.id) if previous else "",
        )
        db.add(record)
        db.flush()
        return request_data(db, record)


class RateSimulation(BaseModel):
    config: dict
    lines: list[LineSpec] = Field(min_length=1, max_length=30)


@router.post("/rates/preview")
def simulate_rates(body: RateSimulation, identity=Depends(get_identity)):
    from .rates import validate_rates

    try:
        validate_rates(body.config)
        return price_quote(body.lines, body.config).model_dump(mode="json")
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise HTTPException(422, "The proposed rate card could not be calculated: " + str(exc))


class ShopSettings(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    quote_validity_days: int = Field(ge=1, le=90)
    retention_days: int = Field(ge=1, le=365)


@router.patch("/settings")
def save_settings(body: ShopSettings, identity=Depends(get_identity)):
    with shop_session(identity["shop_id"]) as db:
        shop = owned(db, Shop, identity["shop_id"], True)
        shop.name = body.name
        shop.settings = {
            **shop.settings,
            "quote_validity_days": body.quote_validity_days,
            "retention_days": body.retention_days,
        }
        return {"name": shop.name, "settings": shop.settings}


@router.get("/export")
def export_shop(identity=Depends(get_identity)):
    with shop_session(identity["shop_id"]) as db:
        shop = owned(db, Shop, identity["shop_id"])
        return {
            "format": "chhaap-export-v1",
            "shop": {"name": shop.name, "mode": shop.mode, "settings": shop.settings},
            "customers": [customer_data(c) for c in db.scalars(select(Customer))],
            "requests": [request_data(db, r) for r in db.scalars(select(RequestRecord))],
            "quotes": [quote_data(db, q) for q in db.scalars(select(Quote))],
            "orders": [order_data(db, o, True) for o in db.scalars(select(Order))],
            "rates": [{"number": r.number, "config": r.config} for r in db.scalars(select(RateVersion))],
        }
