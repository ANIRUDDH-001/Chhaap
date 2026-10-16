from contextlib import contextmanager
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from .settings import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    connect_args={"options": "-c timezone=UTC"},
)


@contextmanager
def shop_session(shop_id: UUID | str):
    with Session(engine) as session, session.begin():
        session.execute(text("SELECT set_config('app.shop_id',:shop,true)"), {"shop": str(shop_id)})
        yield session
