"""Initial tenant-scoped shop schema."""

from alembic import op
from chhaap.models import Base

revision = "0001"
down_revision = None


def upgrade():
    Base.metadata.create_all(op.get_bind())
    op.execute("GRANT USAGE ON SCHEMA public TO chhaap_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO chhaap_app")
    for table in Base.metadata.sorted_tables:
        if table.name in ("owners", "auth_sessions"):
            continue
        name = table.name
        predicate = "id" if name == "shops" else "shop_id"
        op.execute(f'ALTER TABLE "{name}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{name}" FORCE ROW LEVEL SECURITY')
        op.execute(
            f"CREATE POLICY shop_isolation ON \"{name}\" USING ({predicate}::text = current_setting('app.shop_id',true)) WITH CHECK ({predicate}::text = current_setting('app.shop_id',true))"
        )


def downgrade():
    Base.metadata.drop_all(op.get_bind())
