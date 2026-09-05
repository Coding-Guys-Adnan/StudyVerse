from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Environment mode (development / production)
    ENVIRONMENT: str = "development"

    # Database — defaults to local SQLite, override with PostgreSQL via .env
    DATABASE_URL: str = "sqlite+aiosqlite:///./studyverse.db"

    # Backup & Restore Limits
    MAX_BACKUP_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100 MB max upload
    MAX_BACKUP_UNCOMPRESSED_SIZE: int = 250 * 1024 * 1024  # 250 MB max uncompressed
    MAX_BACKUP_ENTRIES: int = 5000  # Max archive files/entries

    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-this"

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    FRONTEND_URL: str = "http://localhost:3005"

    # Supabase Storage & Database
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "studyverse-uploads"

    # Gemini (Phase 6+)
    GEMINI_API_KEY: str = ""

    # SMTP (for Password Reset Email)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@studyverse.com"
    SMTP_FROM_NAME: str = "StudyVerse"

    @property
    def get_async_database_url(self) -> str:
        url = self.DATABASE_URL
        if "sqlite" in url and "./studyverse.db" in url:
            base_dir = Path(__file__).resolve().parent.parent.parent
            db_path = (base_dir / "studyverse.db").as_posix()
            url = f"sqlite+aiosqlite:///{db_path}"
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.FRONTEND_URL:
            return ["http://localhost:3005"]
        return [origin.strip() for origin in self.FRONTEND_URL.split(",") if origin.strip()]

    @property
    def is_local_restore_allowed(self) -> bool:
        """Local restore is allowed ONLY if BOTH environment is development AND database is sqlite."""
        is_dev = self.ENVIRONMENT.strip().lower() == "development"
        is_sqlite = "sqlite" in self.DATABASE_URL.lower()
        return is_dev and is_sqlite

    model_config = {


        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
