"""Persist owner-reviewed quote adjustments on drafts."""

from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade():
    op.execute("ALTER TABLE requests ADD COLUMN IF NOT EXISTS adjustments jsonb NOT NULL DEFAULT '{}'::jsonb")


def downgrade():
    op.drop_column("requests", "adjustments")
