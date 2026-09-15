from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "LabTrack"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/labtrack"
    )

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"

    # Storage
    UPLOAD_DIR: Path = Path("./uploads")

    # CORS
    CORS_ORIGINS: str | list[str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
