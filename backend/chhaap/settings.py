from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    database_url: str = ""
    database_admin_url: str = ""
    test_database_url: str = ""
    ollama_url: str = "http://127.0.0.1:11435"
    ollama_model: str = "gemma4:e4b"
    frontend_origin: str = "http://localhost:5175"
    cookie_secure: bool = False
    data_dir: Path = ROOT / ".data" / "media"
    inference_timeout: int = 180


settings = Settings()
