from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, cast, func, select

from .models import AuditEvent, Customer, Order, Payment, Quote, RequestRecord, now
from .quotes import audit
from .requests import check_revision, customer_data

STAGES = ["proof_pending", "approved_for_print", "printing", "finishing", "ready", "delivered"]


def payment_data(p):
    return {
        "id": str(p.id),
        "kind": p.kind,
        "amount": p.amount,
        "method": p.method,
        "reference": p.reference,
        "note": p.note,
        "created_at": p.created_at.isoformat(),
    }


def order_data(db, order, detail=False):
    payments = (
        list(db.scalars(select(Payment).where(Payment.order_id == order.id).order_by(Payment.created_at)))
        if detail or "page_payments" not in db.info
        else []
    )
    received = (
        db.info["page_payments"].get(order.id, 0)
        if not detail and "page_payments" in db.info
        else sum(p.amount for p in payments)
    )
    customer = (
        (db.info.get("page_customers", {}).get(order.customer_id) or db.get(Customer, order.customer_id))
        if order.customer_id
        else None
    )
    result = {
        "id": str(order.id),
        "number": order.number,
        "revision": order.revision,
        "stage": order.stage,
        "customer": customer_data(customer) if customer else None,
        "due_date": order.due_date,
        "total": order.total,
        "received": received,
        "balance": order.total - received,
        "snapshot": order.snapshot,
        "proof_note": order.proof_note,
        "quote_id": str(order.quote_id),
        "created_at": order.created_at.isoformat(),
    }
    if detail:
        result["payments"] = [payment_data(p) for p in payments]
        result["history"] = [
            {"action": e.action, "detail": e.detail, "created_at": e.created_at.isoformat()}
            for e in db.scalars(
                select(AuditEvent).where(AuditEvent.entity_id == order.id).order_by(AuditEvent.created_at)
            )
        ]
    return result


class Transition(BaseModel):
    stage: str
    expected_revision: int = Field(ge=1)
    note: str = Field(default="", max_length=2000)


class RecordPayment(BaseModel):
    kind: str = Field(pattern="^(receipt|refund|reversal)$")
    amount: int = Field(gt=0, le=100000000)
    method: str = Field(default="Cash", max_length=50)
    reference: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=1000)
    idempotency_key: str = Field(min_length=1, max_length=100)


def transition_order(db, order, body):
    check_revision(order, body.expected_revision)
    if order.stage in {"cancelled", "delivered"}:
        raise HTTPException(409, "This job is already closed")
    if body.stage == "cancelled":
        if not body.note.strip():
            raise HTTPException(422, "Add a cancellation reason")
    elif (
        order.stage not in STAGES
        or STAGES.index(order.stage) + 1 >= len(STAGES)
        or body.stage != STAGES[STAGES.index(order.stage) + 1]
    ):
        raise HTTPException(409, "Move the job through each production stage in order")
    if body.stage == "approved_for_print":
        if not body.note.strip():
            raise HTTPException(422, "Record who approved the artwork before printing")
        order.proof_note = body.note
        order.proof_approved_at = now()
    if body.stage == "printing" and not order.proof_approved_at:
        raise HTTPException(409, "Approve the artwork first")
    order.stage = body.stage
    order.revision += 1
    audit(db, order.shop_id, order.id, "job_" + body.stage, {"note": body.note})
    db.flush()
    return order_data(db, order, True)


def record_payment(db, order, body):
    existing = db.scalar(select(Payment).where(Payment.idempotency_key == body.idempotency_key))
    signed = body.amount if body.kind == "receipt" else -body.amount
    if existing:
        if existing.order_id != order.id or existing.amount != signed or existing.kind != body.kind:
            raise HTTPException(409, "This action key already records a different payment")
        return order_data(db, order, True)
    received = sum(db.scalars(select(Payment.amount).where(Payment.order_id == order.id)))
    if body.kind != "receipt" and body.amount > received:
        raise HTTPException(422, "Refund or reversal exceeds the recorded amount received")
    if body.kind == "reversal" and not body.note.strip():
        raise HTTPException(422, "Add a correction reason")
    payment = Payment(
        shop_id=order.shop_id,
        order_id=order.id,
        amount=signed,
        kind=body.kind,
        method=body.method,
        reference=body.reference,
        note=body.note,
        idempotency_key=body.idempotency_key,
    )
    db.add(payment)
    order.revision += 1
    audit(db, order.shop_id, order.id, "payment_" + body.kind, {"amount": signed})
    db.flush()
    return order_data(db, order, True)


def reports(db):
    # Aggregate in PostgreSQL; never load the whole ledger into application memory.
    def count(model):
        return db.scalar(select(func.count()).select_from(model))

    paid = (
        select(Payment.order_id.label("order_id"), func.sum(Payment.amount).label("received"))
        .group_by(Payment.order_id)
        .subquery()
    )
    outstanding = db.scalar(
        select(func.coalesce(func.sum(func.greatest(0, Order.total - func.coalesce(paid.c.received, 0))), 0))
        .select_from(Order)
        .outerjoin(paid, Order.id == paid.c.order_id)
        .where(Order.stage != "cancelled")
    )
    quote_value = db.scalar(
        select(func.coalesce(func.sum(cast(Quote.snapshot["total"].astext, BigInteger)), 0)).where(
            Quote.status.not_in(["superseded", "cancelled", "declined"])
        )
    )
    return {
        "issued_quote_value": quote_value,
        "issued_quotes": db.scalar(
            select(func.count()).select_from(Quote).where(Quote.status.not_in(["superseded", "cancelled"]))
        ),
        "accepted_order_value": db.scalar(
            select(func.coalesce(func.sum(Order.total), 0)).where(Order.stage != "cancelled")
        ),
        "received": db.scalar(select(func.coalesce(func.sum(Payment.amount), 0))),
        "outstanding": outstanding,
        "stages": dict(db.execute(select(Order.stage, func.count()).group_by(Order.stage)).all()),
        "requests": count(RequestRecord),
        "requests_to_review": db.scalar(
            select(func.count()).select_from(RequestRecord).where(RequestRecord.status != "ready")
        ),
        "active_orders": db.scalar(
            select(func.count()).select_from(Order).where(Order.stage.not_in(["delivered", "cancelled"]))
        ),
        "customers": count(Customer),
        "orders": count(Order),
    }
