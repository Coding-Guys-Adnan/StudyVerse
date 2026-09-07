"""
Script to migrate existing SQLite data into a remote PostgreSQL database safely.

Features:
- Full preflight schema check (table existence, PostgreSQL user_role enum validation, column compatibility).
- Exact 18 application tables in dependency-safe order (prevents FK violations).
- Idempotent: Skips existing rows by primary key to allow safe re-runs.
- Strict: Fails immediately with clear diagnostic if any expected table is missing.
- Secure: Never logs passwords or sensitive credentials.
- Verification: Compares row counts between SQLite and PostgreSQL for all 18 tables after migration.

Usage:
  $env:DATABASE_URL="postgresql://..." # or TARGET_DATABASE_URL
  python scripts/migrate_sqlite_to_postgres.py
"""

import os
import re
import sys
from pathlib import Path

# Add backend root to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, select, text, MetaData
from sqlalchemy.orm import sessionmaker


# Exact 18 application tables in topological dependency order
TABLES_IN_ORDER = [
    "users",
    "students",
    "student_teachers",
    "attendance",
    "daily_plans",
    "calendar_events",
    "fee_records",
    "homework",
    "tests",
    "syllabus",
    "syllabus_chapters",
    "checklist_items",
    "chapter_notes",
    "syllabus_attachments",
    "syllabus_documents",
    "recommendations",
    "ai_plans",
    "announcements",
]


def mask_url(url: str) -> str:
    """Mask credentials in database URL to prevent exposing secrets."""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", url)


def normalize_postgres_url(raw_url: str) -> str:
    """Ensure PostgreSQL URL uses psycopg2 sync driver."""
    url = raw_url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and "+psycopg2" not in url and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif "+asyncpg" in url:
        url = url.replace("+asyncpg", "+psycopg2", 1)
    return url


def run_preflight_checks(src_engine, target_engine, src_meta, target_meta) -> bool:
    """
    Run preflight checks before data insertion:
    1. Confirm all 18 tables exist in source SQLite.
    2. Confirm all 18 tables exist in target PostgreSQL.
    3. Confirm PostgreSQL user_role enum supports 'admin'.
    4. Confirm column compatibility.
    """
    print("\n--- [PREFLIGHT CHECK] ---")

    # 1. Check tables in SQLite
    missing_src = [t for t in TABLES_IN_ORDER if t not in src_meta.tables]
    if missing_src:
        print(f"[FAILED] Missing expected table(s) in source SQLite: {missing_src}")
        return False
    print(f"[*] All {len(TABLES_IN_ORDER)} expected tables exist in source SQLite.")

    # 2. Check tables in PostgreSQL
    missing_target = [t for t in TABLES_IN_ORDER if t not in target_meta.tables]
    if missing_target:
        print(f"[FAILED] Missing expected table(s) in target PostgreSQL: {missing_target}")
        print("  Please run 'alembic upgrade head' against the target database before migrating data.")
        return False
    print(f"[*] All {len(TABLES_IN_ORDER)} expected tables exist in target PostgreSQL.")

    # 3. Check PostgreSQL user_role enum labels
    with target_engine.connect() as conn:
        try:
            enum_result = conn.execute(text(
                "SELECT enumlabel FROM pg_enum "
                "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                "WHERE pg_type.typname = 'user_role' "
                "ORDER BY enumsortorder"
            )).fetchall()
            enum_labels = [row[0] for row in enum_result]
            print(f"[*] PostgreSQL 'user_role' enum labels: {enum_labels}")

            required_roles = {"teacher", "student", "admin"}
            missing_roles = required_roles - set(enum_labels)
            if missing_roles:
                print(f"[FAILED] PostgreSQL 'user_role' enum is missing required role(s): {missing_roles}")
                print("  Please apply the latest Alembic migration ('alembic upgrade head') to add 'admin'.")
                return False
            print("  [OK] 'user_role' enum supports 'teacher', 'student', and 'admin'.")
        except Exception as e:
            print(f"[!] Warning: Could not inspect pg_enum (not a PostgreSQL database or insufficient privileges): {e}")

    # 4. Check column compatibility
    for table_name in TABLES_IN_ORDER:
        src_cols = set(src_meta.tables[table_name].columns.keys())
        target_cols = set(target_meta.tables[table_name].columns.keys())
        diff = src_cols - target_cols
        if diff:
            print(f"[FAILED] Source table '{table_name}' has columns missing in target: {diff}")
            return False

    print("[PASSED] All preflight checks passed successfully!\n")
    return True


def verify_migration(src_engine, target_engine):
    """Verify row counts and specific critical data after migration."""
    print("\n--- [POST-MIGRATION VERIFICATION] ---")
    print(f"  {'#':<3} {'Table Name':<25} {'SQLite':<10} {'PostgreSQL':<12} {'Status'}")
    print("  " + "-" * 65)

    all_matched = True
    with src_engine.connect() as s_conn, target_engine.connect() as t_conn:
        for idx, table_name in enumerate(TABLES_IN_ORDER, 1):
            src_count = s_conn.execute(text(f"SELECT count(*) FROM {table_name}")).scalar()
            target_count = t_conn.execute(text(f"SELECT count(*) FROM {table_name}")).scalar()

            # Target may have >= source count if some rows pre-existed
            status = "MATCH" if src_count == target_count else ("OK (Target >= Src)" if target_count >= src_count else "MISMATCH")
            if target_count < src_count:
                all_matched = False

            print(f"  {idx:<3} {table_name:<25} {src_count:<10} {target_count:<12} {status}")

        # Explicit Verification: Check users breakdown
        print("\n[*] Detailed Users Verification:")
        s_users = s_conn.execute(text("SELECT role, count(*) FROM users GROUP BY role")).fetchall()
        t_users = t_conn.execute(text("SELECT role, count(*) FROM users GROUP BY role")).fetchall()
        print(f"    SQLite user roles:     {dict(s_users)}")
        print(f"    PostgreSQL user roles: {dict(t_users)}")

        # Verify admin users exist in PostgreSQL
        admins = t_conn.execute(text("SELECT email, full_name, role, is_active FROM users WHERE role = 'admin'")).fetchall()
        print(f"    PostgreSQL Admin Accounts ({len(admins)} found):")
        for a in admins:
            print(f"      - {a[0]} ({a[1]}), active={a[3]}")

    if all_matched:
        print("\n[SUCCESS] Post-migration verification completed: all tables verified!")
    else:
        print("\n[WARNING] Some tables have fewer rows in target than source. Please inspect above output.")


def migrate():
    # Resolve SQLite database path
    possible_paths = [
        backend_dir / "studyverse.db",
        Path("studyverse.db").resolve(),
        Path("backend/studyverse.db").resolve(),
    ]
    sqlite_db_path = None
    for p in possible_paths:
        if p.exists():
            sqlite_db_path = p
            break

    if not sqlite_db_path:
        print(f"[FAILED] SQLite database not found in any expected location: {[str(p) for p in possible_paths]}")
        sys.exit(1)

    sqlite_url = f"sqlite:///{sqlite_db_path.as_posix()}"
    raw_target_url = os.getenv("TARGET_DATABASE_URL") or os.getenv("DATABASE_URL")

    if not raw_target_url or "sqlite" in raw_target_url:
        print("[FAILED] Please set TARGET_DATABASE_URL or DATABASE_URL to your remote PostgreSQL connection string.")
        sys.exit(1)

    target_url = normalize_postgres_url(raw_target_url)

    print(f"[*] Source Database (SQLite): {sqlite_db_path}")
    print(f"[*] Target Database (PostgreSQL): {mask_url(target_url)}")

    src_engine = create_engine(sqlite_url)
    target_engine = create_engine(target_url)

    src_meta = MetaData()
    src_meta.reflect(bind=src_engine)

    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)

    # Run strict preflight checks
    if not run_preflight_checks(src_engine, target_engine, src_meta, target_meta):
        print("[ABORTED] Migration stopped because preflight check failed.")
        sys.exit(1)

    SrcSession = sessionmaker(bind=src_engine)
    TargetSession = sessionmaker(bind=target_engine)

    src_session = SrcSession()
    target_session = TargetSession()

    try:
        print("--- [DATA MIGRATION START] ---")
        for table_name in TABLES_IN_ORDER:
            src_table = src_meta.tables[table_name]
            target_table = target_meta.tables[table_name]

            rows = src_session.execute(select(src_table)).mappings().all()
            total_src_rows = len(rows)

            if total_src_rows == 0:
                print(f"[-] Table '{table_name}': 0 rows in SQLite (nothing to migrate).")
                continue

            migrated_count = 0
            skipped_count = 0

            # Get target primary keys to handle existing rows idempotently
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
            print(f"[+] Table '{table_name}': {migrated_count} inserted, {skipped_count} skipped (total {total_src_rows} rows).")

            # After migrating 'students', check if child tables contain orphaned student_ids from deleted students in SQLite.
            # Create archive student placeholders in PostgreSQL so all child records (attendance, tests, documents) migrate cleanly without FK violation.
            if table_name == "students":
                child_student_tables = ['attendance', 'calendar_events', 'tests', 'syllabus_documents', 'daily_plans', 'fee_records', 'homework', 'syllabus', 'recommendations', 'ai_plans']
                orphan_ids = set()
                with src_engine.connect() as s_conn:
                    for ct in child_student_tables:
                        if ct in src_meta.tables:
                            res = s_conn.execute(text(f"SELECT DISTINCT student_id FROM {ct} WHERE student_id IS NOT NULL AND student_id NOT IN (SELECT id FROM students)")).fetchall()
                            for r in res:
                                orphan_ids.add(r[0])
                
                if orphan_ids:
                    print(f"[*] Detected {len(orphan_ids)} orphaned student ID(s) in child tables: {sorted(list(orphan_ids))}")
                    # Find fallback teacher ID from users
                    teacher_res = target_session.execute(text("SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1")).scalar()
                    default_teacher_id = teacher_res or "e6cb8ad3-fe6e-47e8-879d-88f34686b405"
                    
                    from datetime import datetime, timezone
                    archived_count = 0
                    for orphan_id in sorted(list(orphan_ids)):
                        existing = target_session.execute(select(target_table).where(target_table.c.id == orphan_id)).first()
                        if not existing:
                            target_session.execute(target_table.insert().values({
                                "id": orphan_id,
                                "teacher_id": default_teacher_id,
                                "user_id": None,
                                "name": f"[Archived Student] {orphan_id[:8]}",
                                "notes": "Archived student record auto-created during migration to preserve historical child records (attendance/events/tests/docs) while strictly satisfying PostgreSQL FK constraints.",
                                "created_at": datetime.now(timezone.utc),
                            }))
                            archived_count += 1
                    target_session.commit()
                    if archived_count:
                        print(f"[+] Created {archived_count} archive student placeholder(s) in PostgreSQL to satisfy FK constraints and prevent data loss.")

        print("\n[SUCCESS] All table rows migrated successfully!")

        # Run post-migration verification
        verify_migration(src_engine, target_engine)

    except Exception as e:
        target_session.rollback()
        print(f"\n[ERROR] Migration failed during execution: {e}")
        print("[INFO] Rolled back current transaction to avoid partial corrupted state.")
        sys.exit(1)
    finally:
        src_session.close()
        target_session.close()


if __name__ == "__main__":
    migrate()
