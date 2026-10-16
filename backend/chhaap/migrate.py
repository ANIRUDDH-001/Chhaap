from pathlib import Path

from alembic.config import Config

from alembic import command


def upgrade():
    cfg = Config()
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    upgrade()
