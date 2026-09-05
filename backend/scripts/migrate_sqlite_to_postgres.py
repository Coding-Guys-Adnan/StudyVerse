"""
Script to migrate existing SQLite data into a remote PostgreSQL database safely.

Usage:
  1. Set TARGET_DATABASE_URL env variable to your PostgreSQL connection string
     (e.g., postgresql+psycopg2://postgres:pass@db.xxx.supabase.co:5432/postgres)
  2. Run: python backend/scripts/migrate_sqlite_to_postgres.py
"""

import os
import sys
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, inspect, select, Table, MetaData
from sqlalchemy.orm import sessionmaker

def migrate():
    sqlite_db_path = backend_dir / "studyverse.db"
    if not sqlite_db_path.exists():
        print(f"[!] SQLite database not found at {sqlite_db_path}. Nothing to migrate.")
        return

    sqlite_url = f"sqlite:///{sqlite_db_path}"
    target_url = os.getenv("TARGET_DATABASE_URL") or os.getenv("DATABASE_URL")

    if not target_url or "sqlite" in target_url:
        print("[!] Please set TARGET_DATABASE_URL environment variable to your PostgreSQL connection string.")
        print("Example: TARGET_DATABASE_URL=postgresql+psycopg2://postgres:password@db.ref.supabase.co:5432/postgres")
        return

    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif target_url.startswith("postgresql://") and "+psycopg2" not in target_url and "+asyncpg" not in target_url:
        target_url = target_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif "+asyncpg" in target_url:
        target_url = target_url.replace("+asyncpg", "+psycopg2", 1)

    print(f"[*] Source Database (SQLite): {sqlite_url}")
    print(f"[*] Target Database (PostgreSQL): {target_url.split('@')[-1] if '@' in target_url else target_url}")

    src_engine = create_engine(sqlite_url)
    target_engine = create_engine(target_url)

    src_meta = MetaData()
    src_meta.reflect(bind=src_engine)

    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)

    # Topological order of tables to preserve Foreign Key integrity
    tables_in_order = [
        "users",
        "students",
        "attendance",
        "daily_plans",
        "calendar_events",
        "fee_records",
        "homeworks",
        "syllabuses",
        "syllabus_chapters",
        "checklist_items",
        "chapter_notes",
        "syllabus_attachments",
        "syllabus_documents",
        "recommendations",
        "ai_plans",
        "announcements",
    ]

    SrcSession = sessionmaker(bind=src_engine)
    TargetSession = sessionmaker(bind=target_engine)

    src_session = SrcSession()
    target_session = TargetSession()

    try:
        for table_name in tables_in_order:
            if table_name not in src_meta.tables or table_name not in target_meta.tables:
                continue

            src_table = src_meta.tables[table_name]
            target_table = target_meta.tables[table_name]

            rows = src_session.execute(select(src_table)).mappings().all()
            if not rows:
                print(f"[-] Table '{table_name}': 0 rows found in SQLite.")
                continue

            migrated_count = 0
            skipped_count = 0

            # Get target primary keys to prevent duplicate key constraint errors
            pk_cols = [c.name for c in target_table.primary_key.columns]

            for row in rows:
                row_dict = dict(row)

                # Check if row already exists in target
                if pk_cols:
                    conditions = [target_table.c[pk] == row_dict[pk] for pk in pk_cols if pk in row_dict]
                    if conditions:
                        existing = target_session.execute(select(target_table).where(*conditions)).first()
                        if existing:
                            skipped_count += 1
                            continue

                target_session.execute(target_table.insert().values(row_dict))
                migrated_count += 1

            target_session.commit()
            print(f"[+] Table '{table_name}': Migrated {migrated_count} rows ({skipped_count} skipped).")

        print("\n[SUCCESS] SQLite to PostgreSQL data migration complete!")

    except Exception as e:
        target_session.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
    finally:
        src_session.close()
        target_session.close()

if __name__ == "__main__":
    migrate()
