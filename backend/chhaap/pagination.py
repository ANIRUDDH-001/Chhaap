import base64
import json
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, Query
from sqlalchemy import func, or_, select, tuple_

from .models import Customer, Order, Payment, Quote, RequestRecord, now


def page_params(
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None, max_length=300),
    q: str = Query("", max_length=100),
    status: str = Query("", max_length=30),
    queue: bool = Query(False),
):
    return {"limit": limit, "cursor": cursor, "q": q, "status": status, "queue": queue}


def page(db, model, serialize, params, columns):
    statement = select(model)
    if model != Customer:
        statement = statement.outerjoin(Customer, model.customer_id == Customer.id)
    if params.get("queue"):
        if model == RequestRecord:
            statement = statement.where(RequestRecord.status != "ready")
        elif model == Order:
            statement = statement.where(Order.stage.not_in(["delivered", "cancelled"]))
    if params["q"]:
        term = params["q"].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(or_(*(column.ilike("%" + term + "%", escape="\\") for column in columns)))
    if params["status"] and model == Order:
        status = params["status"]
        statement = (
            statement.where(Order.stage.not_in(["delivered", "cancelled"]))
            if status == "active"
            else statement.where(Order.stage.in_(["delivered", "cancelled"]))
            if status == "closed"
            else statement.where(Order.stage == status)
        )
    elif params["status"] and hasattr(model, "status"):
        status = params["status"]
        if model == Quote and status == "expired":
            statement = statement.where(Quote.status == "issued", Quote.expires_at <= now())
        elif model == Quote and status == "issued":
            statement = statement.where(Quote.status == "issued", Quote.expires_at > now())
        else:
            statement = statement.where(model.status == status)
    if params["cursor"]:
        try:
            timestamp, ident = json.loads(base64.urlsafe_b64decode(params["cursor"]))
            date = datetime.fromisoformat(timestamp)
            if date.tzinfo is None:
                raise ValueError("Timezone required")
            statement = statement.where(tuple_(model.created_at, model.id) < tuple_(date, UUID(ident)))
        except (ValueError, TypeError, UnicodeError, json.JSONDecodeError):
            raise HTTPException(422, "Invalid page cursor") from None
    rows = list(
        db.scalars(statement.order_by(model.created_at.desc(), model.id.desc()).limit(params["limit"] + 1))
    )
    visible = rows[: params["limit"]]
    customer_ids = {row.customer_id for row in visible if getattr(row, "customer_id", None)}
    db.info["page_customers"] = (
        {c.id: c for c in db.scalars(select(Customer).where(Customer.id.in_(customer_ids)))}
        if customer_ids
        else {}
    )
    if model == Quote:
        db.info["page_quote_orders"] = dict(
            db.execute(
                select(Order.quote_id, Order.id).where(Order.quote_id.in_([r.id for r in visible]))
            ).all()
        )
    if model == Order:
        db.info["page_payments"] = dict(
            db.execute(
                select(Payment.order_id, func.sum(Payment.amount))
                .where(Payment.order_id.in_([r.id for r in visible]))
                .group_by(Payment.order_id)
            ).all()
        )
    cursor = None
    if len(rows) > params["limit"]:
        last = visible[-1]
        cursor = base64.urlsafe_b64encode(
            json.dumps([last.created_at.isoformat(), str(last.id)]).encode()
        ).decode()
    return {"items": [serialize(row) for row in visible], "next_cursor": cursor}
