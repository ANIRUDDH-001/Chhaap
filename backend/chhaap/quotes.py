from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from .models import AuditEvent, Customer, Order, Quote, RateVersion, RequestRecord, Shop, now
from .pricing import price_quote
from .requests import check_revision, customer_data, owned
from .schemas import Adjustments, LineSpec


def active_rates(db):
    return db.scalar(select(RateVersion).order_by(RateVersion.number.desc()).limit(1))


def audit(db, shop, entity, action, detail=None):
    db.add(AuditEvent(shop_id=shop, entity_id=entity, action=action, detail=detail or {}))


class Preview(BaseModel):
    lines: list[LineSpec] = Field(min_length=1, max_length=30)
    adjustments: Adjustments | None = None


class Issue(BaseModel):
    request_id: UUID
    expected_revision: int = Field(ge=1)
    idempotency_key: str = Field(min_length=1, max_length=100)
    adjustments: Adjustments | None = None
    revises_quote_id: UUID | None = None


class QuoteResponse(BaseModel):
    response: str = Field(pattern="^(accepted|declined|cancelled)$")
    expected_revision: int = Field(ge=1)
    note: str = Field(default="", max_length=2000)


def quote_data(db, quote):
    customer = (
        (db.info.get("page_customers", {}).get(quote.customer_id) or db.get(Customer, quote.customer_id))
        if quote.customer_id
        else None
    )
    status = "expired" if quote.status == "issued" and quote.expires_at <= now() else quote.status
    order = (
        db.info["page_quote_orders"].get(quote.id)
        if "page_quote_orders" in db.info
        else db.scalar(select(Order.id).where(Order.quote_id == quote.id))
    )
    return {
        "id": str(quote.id),
        "request_id": str(quote.request_id) if quote.request_id else None,
        "number": quote.number,
        "version": quote.version,
        "revision": quote.revision,
        "status": status,
        "snapshot": quote.snapshot,
        "customer": customer_data(customer) if customer else None,
        "delivery_date": quote.delivery_date,
        "created_at": quote.created_at.isoformat(),
        "expires_at": quote.expires_at.isoformat(),
        "terms": quote.terms,
        "order_id": str(order) if order else None,
    }


def preview(db, body):
    try:
        return price_quote(body.lines, active_rates(db).config, body.adjustments).model_dump(mode="json")
    except ValueError as exc:
        raise HTTPException(422, str(exc))


def issue_quote(db, shop_id, body):
    shop = owned(db, Shop, shop_id, True)
    existing = db.scalar(select(Quote).where(Quote.idempotency_key == body.idempotency_key))
    if existing:
        if (
            existing.request_id != body.request_id
            or existing.snapshot.get("request_revision") != body.expected_revision
            or existing.snapshot.get("issue_action", body.model_dump(mode="json"))
            != body.model_dump(mode="json")
        ):
            raise HTTPException(409, "That action key was already used for another draft version")
        return quote_data(db, existing)
    record = owned(db, RequestRecord, body.request_id, True)
    check_revision(record, body.expected_revision)
    if not record.delivery_date or not record.delivery_confirmed:
        raise HTTPException(422, "Confirm the delivery date before issuing a quote")
    if not record.customer_id:
        raise HTTPException(422, "Choose a customer before issuing a quote")
    try:
        snapshot = price_quote(
            [LineSpec(**line) for line in record.lines],
            active_rates(db).config,
            body.adjustments or Adjustments(**record.adjustments),
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    if not snapshot.ready:
        raise HTTPException(422, "; ".join(snapshot.warnings))
    parent = None
    if body.revises_quote_id:
        parent = owned(db, Quote, body.revises_quote_id, True)
        if parent.status in {"accepted", "superseded", "cancelled"}:
            raise HTTPException(409, "This quote cannot be revised")
        if parent.request_id != record.id:
            raise HTTPException(409, "A revision must use the original request")
    shop.quote_seq += 1
    payload = snapshot.model_dump(mode="json")
    payload["request_revision"] = record.revision
    payload["issue_action"] = body.model_dump(mode="json")
    payload["shop_name"] = shop.name
    payload["customer"] = customer_data(owned(db, Customer, record.customer_id))
    payload["adjustments"] = (body.adjustments or Adjustments(**record.adjustments)).model_dump(mode="json")
    quote = Quote(
        shop_id=shop_id,
        request_id=record.id,
        customer_id=record.customer_id,
        number=parent.number if parent else f"CH-{now().year}-{shop.quote_seq:03}",
        series_id=parent.series_id if parent else uuid4(),
        version=parent.version + 1 if parent else 1,
        snapshot=payload,
        delivery_date=record.delivery_date,
        expires_at=now() + timedelta(days=shop.settings.get("quote_validity_days", 7)),
        idempotency_key=body.idempotency_key,
    )
    if parent:
        parent.status = "superseded"
        parent.revision += 1
    db.add(quote)
    db.flush()
    audit(db, shop_id, quote.id, "quote_issued", {"number": quote.number, "total": snapshot.total})
    return quote_data(db, quote)


def record_response(db, quote, body):
    if quote.status == "accepted" and body.response == "accepted":
        return quote_data(db, quote)
    check_revision(quote, body.expected_revision)
    if quote.status != "issued" or quote.expires_at <= now():
        raise HTTPException(409, "Only a current, unexpired issued quote can receive a response")
    quote.status = body.response
    quote.revision += 1
    if body.response == "accepted":
        order = Order(
            shop_id=quote.shop_id,
            quote_id=quote.id,
            customer_id=quote.customer_id,
            number=quote.number.replace("CH-", "JOB-"),
            due_date=quote.delivery_date,
            snapshot=quote.snapshot,
            total=quote.snapshot["total"],
        )
        db.add(order)
    audit(
        db,
        quote.shop_id,
        quote.id,
        "quote_" + body.response,
        {"note": body.note, "channel": "Recorded by owner; off-platform response"},
    )
    db.flush()
    return quote_data(db, quote)
