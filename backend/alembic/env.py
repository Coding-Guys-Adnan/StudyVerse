from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Import our models and config
from app.core.config import get_settings
from app.core.database import Base
from app.models.user import User  # noqa: F401
from app.models.student import Student  # noqa: F401
from app.models.academic import (
    Attendance, DailyPlan, CalendarEvent, FeeRecord, Homework, Syllabus, Test,
    SyllabusDocument, Recommendation, AIPlan, Announcement
)  # noqa: F401

config = context.config
settings = get_settings()

# Build sync URL from the async DATABASE_URL
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and "+psycopg2" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
elif "+asyncpg" in db_url:
    db_url = db_url.replace("+asyncpg", "+psycopg2")
elif "+aiosqlite" in db_url:
    db_url = db_url.replace("+aiosqlite", "")

config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=(connection.dialect.name == "sqlite"),
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
