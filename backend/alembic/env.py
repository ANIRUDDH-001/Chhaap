from sqlalchemy import create_engine

from alembic import context
from chhaap.models import Base
from chhaap.settings import settings

with create_engine(settings.database_admin_url).connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
