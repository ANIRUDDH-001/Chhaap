from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Shop(Base):
    __tablename__ = "shops"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150))
    mode: Mapped[str] = mapped_column(String(20), default="sample")
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    quote_seq: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Owner(Base):
    __tablename__ = "owners"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    shop_id: Mapped[UUID] = mapped_column(ForeignKey("shops.id"))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(Text)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    shop_id: Mapped[UUID] = mapped_column(ForeignKey("shops.id"), index=True)
    owner_id: Mapped[UUID | None] = mapped_column(ForeignKey("owners.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TenantRecord:
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    shop_id: Mapped[UUID] = mapped_column(ForeignKey("shops.id"), index=True)
    revision: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


def scoped(*foreign):
    return (UniqueConstraint("shop_id", "id"), *foreign)


def ref(field, table):
    return ForeignKeyConstraint(["shop_id", field], [f"{table}.shop_id", f"{table}.id"])


class Customer(TenantRecord, Base):
    __tablename__ = "customers"
    __table_args__ = scoped()
    name: Mapped[str] = mapped_column(String(150))
    business: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(254), default="")


class RequestRecord(TenantRecord, Base):
    __tablename__ = "requests"
    __table_args__ = scoped(ref("customer_id", "customers"))
    customer_id: Mapped[UUID | None]
    title: Mapped[str] = mapped_column(String(200), default="New print request")
    lines: Mapped[list] = mapped_column(JSONB, default=list)
    adjustments: Mapped[dict] = mapped_column(JSONB, default=dict)
    delivery_date: Mapped[str | None] = mapped_column(String(10))
    delivery_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="needs_review")
    extraction: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str] = mapped_column(Text, default="")


class Source(TenantRecord, Base):
    __tablename__ = "sources"
    __table_args__ = scoped(ref("request_id", "requests"))
    request_id: Mapped[UUID]
    kind: Mapped[str] = mapped_column(String(20), default="text")
    text: Mapped[str] = mapped_column(Text, default="")
    sender: Mapped[str] = mapped_column(String(100), default="Customer")
    position: Mapped[int] = mapped_column(default=0)
    media_path: Mapped[str | None] = mapped_column(String(300))
    mime: Mapped[str | None] = mapped_column(String(100))


class RateVersion(TenantRecord, Base):
    __tablename__ = "rate_versions"
    __table_args__ = scoped(UniqueConstraint("shop_id", "number"))
    number: Mapped[int] = mapped_column(default=1)
    config: Mapped[dict] = mapped_column(JSONB)


class Quote(TenantRecord, Base):
    __tablename__ = "quotes"
    __table_args__ = scoped(
        ref("request_id", "requests"),
        ref("customer_id", "customers"),
        UniqueConstraint("shop_id", "idempotency_key"),
    )
    request_id: Mapped[UUID | None]
    customer_id: Mapped[UUID | None]
    series_id: Mapped[UUID] = mapped_column(default=uuid4, index=True)
    version: Mapped[int] = mapped_column(default=1)
    number: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(25), default="issued")
    snapshot: Mapped[dict] = mapped_column(JSONB)
    delivery_date: Mapped[str | None] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str] = mapped_column(String(100))
    terms: Mapped[str] = mapped_column(Text, default="Artwork approval required before printing.")


class Order(TenantRecord, Base):
    __tablename__ = "orders"
    __table_args__ = scoped(
        ref("quote_id", "quotes"), ref("customer_id", "customers"), UniqueConstraint("shop_id", "quote_id")
    )
    quote_id: Mapped[UUID]
    customer_id: Mapped[UUID | None]
    number: Mapped[str] = mapped_column(String(30))
    stage: Mapped[str] = mapped_column(String(30), default="proof_pending")
    due_date: Mapped[str | None] = mapped_column(String(10))
    snapshot: Mapped[dict] = mapped_column(JSONB)
    total: Mapped[int] = mapped_column(BigInteger)
    proof_note: Mapped[str] = mapped_column(Text, default="")
    proof_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Payment(TenantRecord, Base):
    __tablename__ = "payments"
    __table_args__ = scoped(ref("order_id", "orders"), UniqueConstraint("shop_id", "idempotency_key"))
    order_id: Mapped[UUID]
    amount: Mapped[int] = mapped_column(BigInteger)
    kind: Mapped[str] = mapped_column(String(20))
    method: Mapped[str] = mapped_column(String(50), default="Cash")
    reference: Mapped[str] = mapped_column(String(200), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    idempotency_key: Mapped[str] = mapped_column(String(100))


class AuditEvent(TenantRecord, Base):
    __tablename__ = "audit_events"
    __table_args__ = scoped()
    entity_id: Mapped[UUID] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)


class Job(TenantRecord, Base):
    __tablename__ = "background_jobs"
    __table_args__ = scoped(ref("request_id", "requests"), Index("ix_jobs_claim", "status", "available_at"))
    request_id: Mapped[UUID]
    source_revision: Mapped[int]
    status: Mapped[str] = mapped_column(String(20), default="queued")
    attempts: Mapped[int] = mapped_column(default=0)
    lease_owner: Mapped[str | None] = mapped_column(String(80))
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    error: Mapped[str | None] = mapped_column(Text)
    result: Mapped[dict | None] = mapped_column(JSONB)
