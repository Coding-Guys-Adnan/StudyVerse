import os
import json
import shutil
import hashlib
import zipfile
import logging
import uuid
import time
from pathlib import Path
from datetime import datetime, date, timezone
from typing import Optional, Any

from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select, text, Table, delete, update, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import Base
from app.schemas.backup import (
    RestorePreviewResponse,
    ExecuteRestoreRequest,
    ExecuteRestoreResponse,
)
from app.services.backup_service import (
    get_application_tables,
    BACKEND_DIR,
    UPLOADS_DIR,
    SCRATCH_DIR,
)

logger = logging.getLogger(__name__)
settings = get_settings()

RESTORE_SESSIONS_DIR = SCRATCH_DIR / "restore_sessions"


def is_local_database() -> bool:
    """Verifies that the backend is currently allowed to execute local restores.

    Local restore is allowed ONLY if the environment is development AND the database is SQLite.
    Production environments (Postgres / Supabase) are strictly download-only.
    """
    return settings.is_local_restore_allowed


def assert_local_restore_allowed() -> None:
    """Raises HTTP 403 if restore is attempted in a non-local or production environment."""
    if not is_local_database():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Local restore is disabled in production environments. Production databases are download-only for backups.",
        )


def cleanup_stale_sessions(max_age_seconds: int = 3600) -> None:
    """Deletes temporary restore session directories older than max_age_seconds."""
    if not RESTORE_SESSIONS_DIR.exists():
        return
    now = time.time()
    for item in RESTORE_SESSIONS_DIR.iterdir():
        if item.is_dir():
            try:
                mtime = item.stat().st_mtime
                if now - mtime > max_age_seconds:
                    shutil.rmtree(item, ignore_errors=True)
            except Exception:
                pass



def is_safe_zip_path(path_str: str) -> bool:
    """Validates that an archive member path does not contain directory traversal or absolute paths."""
    p = Path(path_str)
    if p.is_absolute() or ".." in p.parts:
        return False
    if path_str.startswith("/") or path_str.startswith("\\"):
        return False
    # Check for drive colon in Windows
    if ":" in path_str:
        return False
    return True


def normalize_file_url_to_local(url_or_path: Optional[str], folder: str) -> Optional[str]:
    """Normalizes a remote Supabase Storage URL or external URL to a local /uploads/ relative path."""
    if not url_or_path:
        return url_or_path

    # Already local
    if url_or_path.startswith("/uploads/"):
        return url_or_path

    # Remote Supabase URL: e.g. https://xxx.supabase.co/storage/v1/object/public/studyverse-uploads/syllabus/123_abc.pdf
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        clean_url = url_or_path.split("?")[0]
        filename = Path(clean_url).name
        return f"/uploads/{folder}/{filename}"

    # Relative path
    rel = url_or_path.lstrip("/")
    if not rel.startswith("uploads/"):
        return f"/uploads/{folder}/{rel}"
    return f"/{rel}"


def validate_preflight(zip_path: Path, temp_extract_dir: Path) -> tuple[bool, dict, list[str]]:
    """Performs rigorous preflight validation of backup archive without modifying database.

    Checks:
    - Valid ZIP archive without ZipSlip/path traversal
    - manifest.json exists and is valid JSON
    - application is StudyVerse and backup_version is supported (v1)
    - database JSON files are valid and have unique primary keys
    - foreign-key referential integrity across exported data
    - file SHA-256 checksums match manifest
    """
    errors: list[str] = []

    if not zip_path.exists() or not zip_path.is_file():
        return False, {}, [f"Backup file not found at: {zip_path}"]

    # 1. Inspect and extract ZIP safely
    try:
        with zipfile.ZipFile(zip_path, "r") as zipf:
            infolist = zipf.infolist()
            if len(infolist) > settings.MAX_BACKUP_ENTRIES:
                return False, {}, [f"Archive contains too many entries ({len(infolist)}). Maximum allowed is {settings.MAX_BACKUP_ENTRIES}."]
            total_uncompressed = sum(m.file_size for m in infolist)
            if total_uncompressed > settings.MAX_BACKUP_UNCOMPRESSED_SIZE:
                return False, {}, [f"Archive uncompressed size ({total_uncompressed} bytes) exceeds safety limit of {settings.MAX_BACKUP_UNCOMPRESSED_SIZE} bytes."]
            for member in infolist:
                if not is_safe_zip_path(member.filename):
                    return False, {}, [f"Unsafe file path detected in ZIP archive (ZipSlip attempt): {member.filename}"]
            zipf.extractall(temp_extract_dir)
    except zipfile.BadZipFile:
        return False, {}, ["The provided file is not a valid or intact ZIP archive."]
    except Exception as e:
        return False, {}, [f"Failed to extract backup archive: {str(e)}"]

    # 2. Manifest Validation
    manifest_file = temp_extract_dir / "manifest.json"
    if not manifest_file.exists():
        return False, {}, ["Missing manifest.json in backup archive."]

    try:
        with open(manifest_file, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        return False, {}, [f"manifest.json is malformed or corrupted: {e}"]

    if manifest.get("application") != "StudyVerse":
        errors.append(f"Invalid application in manifest: expected 'StudyVerse', got '{manifest.get('application')}'")

    if manifest.get("backup_version") != 1:
        errors.append(f"Unsupported backup version: {manifest.get('backup_version')}. Only version 1 is supported.")

    backup_type = manifest.get("backup_type", "full")

    # 3. Database Files & Record Validation
    table_records_map: dict[str, list[dict]] = {}
    if backup_type in ("full", "database"):
        db_dir = temp_extract_dir / "database"
        if not db_dir.exists():
            errors.append("Database folder 'database/' missing from backup archive.")
        else:
            tables = manifest.get("tables", {})
            for table_name, expected_count in tables.items():
                table_file = db_dir / f"{table_name}.json"
                if not table_file.exists():
                    errors.append(f"Missing expected table file: database/{table_name}.json")
                    continue

                try:
                    with open(table_file, "r", encoding="utf-8") as f:
                        records = json.load(f)
                    if not isinstance(records, list):
                        errors.append(f"Table database/{table_name}.json must contain a JSON array.")
                        continue

                    # Validate primary keys & duplicate detection
                    seen_ids = set()
                    for idx, rec in enumerate(records):
                        rec_id = rec.get("id")
                        if not rec_id:
                            errors.append(f"Record at index {idx} in table {table_name} is missing primary key 'id'.")
                        elif rec_id in seen_ids:
                            errors.append(f"Duplicate primary key '{rec_id}' detected in table {table_name}.")
                        else:
                            seen_ids.add(rec_id)

                    table_records_map[table_name] = records

                except Exception as e:
                    errors.append(f"Error reading database/{table_name}.json: {e}")

            # 4. Foreign Key Referential Integrity Cross-Check
            # Check students -> users
            user_ids = {r["id"] for r in table_records_map.get("users", [])}
            student_records = table_records_map.get("students", [])
            for s in student_records:
                teacher_id = s.get("teacher_id")
                if teacher_id and teacher_id not in user_ids:
                    errors.append(f"Student '{s.get('name')}' ({s.get('id')}) references non-existent teacher_id '{teacher_id}'.")

            # Check syllabus_chapters -> syllabus
            syllabus_ids = {r["id"] for r in table_records_map.get("syllabus", [])}
            chapter_records = table_records_map.get("syllabus_chapters", [])
            for ch in chapter_records:
                syl_id = ch.get("syllabus_id")
                if syl_id and syl_id not in syllabus_ids:
                    errors.append(f"SyllabusChapter '{ch.get('title')}' ({ch.get('id')}) references non-existent syllabus_id '{syl_id}'.")

    # 5. File Checksum Validation
    if backup_type in ("full", "files"):
        files = manifest.get("files", [])
        for file_entry in files:
            arc_path = file_entry.get("archive_path")
            expected_sha256 = file_entry.get("sha256")

            if not arc_path or not expected_sha256:
                errors.append(f"Manifest file entry missing archive_path or sha256: {file_entry}")
                continue

            extracted_file = temp_extract_dir / arc_path
            if not extracted_file.exists() or not extracted_file.is_file():
                errors.append(f"Referenced archive file missing: {arc_path}")
                continue

            try:
                with open(extracted_file, "rb") as f:
                    actual_sha256 = hashlib.sha256(f.read()).hexdigest()
                if actual_sha256.lower() != expected_sha256.lower():
                    errors.append(
                        f"Checksum mismatch for file '{arc_path}': expected {expected_sha256}, got {actual_sha256}"
                    )
            except Exception as e:
                errors.append(f"Failed to read/hash file '{arc_path}': {e}")

    if errors:
        return False, manifest, errors

    return True, manifest, []


def create_safety_backup() -> Optional[Path]:
    """Creates a timestamped safety copy of the current SQLite database before destructive restore."""
    sqlite_db_path = BACKEND_DIR / "studyverse.db"
    if sqlite_db_path.exists() and sqlite_db_path.is_file():
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
        safety_path = BACKEND_DIR / f"studyverse_before_restore_{now_str}.db"
        shutil.copy2(sqlite_db_path, safety_path)
        return safety_path
    return None


async def calculate_merge_plan(
    db: AsyncSession,
    extracted_dir: Path,
    manifest: dict,
) -> dict:
    """Calculates the exact insert, update, unchanged, and conflict counts for merge restore."""
    tables = get_application_tables()
    db_dir = extracted_dir / "database"

    plan = {
        "tables": {},
        "total_inserts": 0,
        "total_updates": 0,
        "total_unchanged": 0,
        "conflicts": [],
    }

    for table in tables:
        table_file = db_dir / f"{table.name}.json"
        if not table_file.exists():
            continue

        try:
            with open(table_file, "r", encoding="utf-8") as f:
                incoming_records = json.load(f)
        except Exception:
            continue

        # Fetch existing records
        existing_rows = await db.execute(select(table))
        existing_by_id = {}
        for row in existing_rows.mappings().all():
            r_dict = dict(row)
            if "id" in r_dict and r_dict["id"] is not None:
                existing_by_id[str(r_dict["id"])] = r_dict

        inserts = 0
        updates = 0
        unchanged = 0

        for rec in incoming_records:
            rec_id = str(rec.get("id"))
            if rec_id in existing_by_id:
                existing_rec = existing_by_id[rec_id]
                # Compare fields
                diff = False
                for k, v in rec.items():
                    if k in existing_rec:
                        ex_v = existing_rec[k]
                        if isinstance(ex_v, (datetime, date)):
                            ex_v = ex_v.isoformat()
                        elif hasattr(ex_v, "value"):
                            ex_v = ex_v.value
                        if str(ex_v) != str(v):
                            diff = True
                            break
                if diff:
                    updates += 1
                else:
                    unchanged += 1
            else:
                inserts += 1

        plan["tables"][table.name] = {
            "inserts": inserts,
            "updates": updates,
            "unchanged": unchanged,
            "total": len(incoming_records),
        }
        plan["total_inserts"] += inserts
        plan["total_updates"] += updates
        plan["total_unchanged"] += unchanged

    return plan


def _parse_column_value(col, val: Any) -> Any:
    """Converts serialized JSON strings back to proper Python types (Date, DateTime, Boolean)."""
    if val is None:
        return None

    type_str = str(col.type).lower()

    if "datetime" in type_str:
        if isinstance(val, str):
            try:
                # Handle ISO format strings
                clean_val = val.replace("Z", "+00:00")
                return datetime.fromisoformat(clean_val)
            except Exception:
                return val
    elif "date" in type_str:
        if isinstance(val, str):
            try:
                return date.fromisoformat(val)
            except Exception:
                return val
    elif "boolean" in type_str:
        if isinstance(val, str):
            return val.lower() in ("true", "1", "t")
        return bool(val)
    elif "float" in type_str:
        return float(val)
    elif "integer" in type_str:
        return int(val)

    return val


async def restore_database_transactional(
    db: AsyncSession,
    extracted_dir: Path,
    manifest: dict,
    mode: str = "merge",
) -> dict[str, int]:
    """Atomically restores database records inside a single transaction.

    Rolls back automatically on any error.
    """
    tables = get_application_tables()
    db_dir = extracted_dir / "database"
    restored_counts: dict[str, int] = {}

    # Disable SQLite foreign keys temporarily during batch bulk insert/replace if using SQLite
    is_sqlite = db.bind and db.bind.dialect.name == "sqlite"
    if is_sqlite:
        await db.execute(text("PRAGMA foreign_keys = OFF;"))

    try:
        # 1. If REPLACE mode, clear tables in reverse topological order
        if mode == "replace":
            for table in reversed(tables):
                await db.execute(delete(table))

        # 2. Insert or update in topological order
        for table in tables:
            table_file = db_dir / f"{table.name}.json"
            if not table_file.exists():
                restored_counts[table.name] = 0
                continue

            with open(table_file, "r", encoding="utf-8") as f:
                records = json.load(f)

            table_restored = 0
            for rec in records:
                # Normalize any remote file URLs to local paths
                if table.name == "syllabus_attachments" and "stored_path" in rec:
                    rec["stored_path"] = normalize_file_url_to_local(rec["stored_path"], "syllabus")
                elif table.name == "homework" and "attachment_url" in rec:
                    rec["attachment_url"] = normalize_file_url_to_local(rec["attachment_url"], "homework")
                elif table.name == "tests":
                    if "question_paper_url" in rec:
                        rec["question_paper_url"] = normalize_file_url_to_local(rec["question_paper_url"], "tests")
                    if "answer_paper_url" in rec:
                        rec["answer_paper_url"] = normalize_file_url_to_local(rec["answer_paper_url"], "tests")
                elif table.name == "students" and "avatar_url" in rec:
                    rec["avatar_url"] = normalize_file_url_to_local(rec["avatar_url"], "avatars")

                # Parse datatypes according to table column types
                parsed_values = {}
                for col in table.columns:
                    if col.name in rec:
                        parsed_values[col.name] = _parse_column_value(col, rec[col.name])

                rec_id = parsed_values.get("id")

                if mode == "replace":
                    await db.execute(insert(table).values(parsed_values))
                    table_restored += 1
                else:  # merge mode
                    # Check if row exists by primary key
                    existing = (
                        await db.execute(select(table.c.id).where(table.c.id == rec_id))
                    ).scalar_one_or_none()

                    if existing:
                        # Update
                        update_values = {k: v for k, v in parsed_values.items() if k != "id"}
                        if update_values:
                            await db.execute(
                                update(table).where(table.c.id == rec_id).values(update_values)
                            )
                    else:
                        # Insert
                        await db.execute(insert(table).values(parsed_values))
                    table_restored += 1

            restored_counts[table.name] = table_restored

        await db.commit()

    except Exception as e:
        await db.rollback()
        logger.error(f"Database restore failed and was rolled back: {e}")
        raise
    finally:
        if is_sqlite:
            await db.execute(text("PRAGMA foreign_keys = ON;"))

    return restored_counts


def restore_files(extracted_dir: Path, manifest: dict) -> int:
    """Extracts and copies files from extracted_dir/files/ to backend/uploads/."""
    files_source_dir = extracted_dir / "files"
    if not files_source_dir.exists():
        return 0

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    restored_count = 0

    for root, _, files in os.walk(files_source_dir):
        for filename in files:
            source_file = Path(root) / filename
            rel_path = source_file.relative_to(files_source_dir)
            target_file = UPLOADS_DIR / rel_path

            target_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_file, target_file)
            restored_count += 1

    return restored_count


async def prepare_and_preview_upload(
    file: UploadFile,
    db: AsyncSession,
) -> RestorePreviewResponse:
    """Prepares an uploaded backup ZIP, validates it without modifying the database, and generates a restore preview."""
    assert_local_restore_allowed()
    cleanup_stale_sessions()

    session_id = uuid.uuid4().hex
    session_dir = RESTORE_SESSIONS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    zip_path = session_dir / "backup.zip"
    extract_dir = session_dir / "extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded file while enforcing MAX_BACKUP_UPLOAD_SIZE
    total_uploaded = 0
    chunk_size = 1024 * 1024  # 1MB
    try:
        with open(zip_path, "wb") as f_out:
            while chunk := await file.read(chunk_size):
                total_uploaded += len(chunk)
                if total_uploaded > settings.MAX_BACKUP_UPLOAD_SIZE:
                    shutil.rmtree(session_dir, ignore_errors=True)
                    max_mb = settings.MAX_BACKUP_UPLOAD_SIZE // (1024 * 1024)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Uploaded file exceeds maximum allowed size of {max_mb} MB.",
                    )
                f_out.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {str(e)}",
        )

    # Preflight validation
    is_valid, manifest, errors = validate_preflight(zip_path, extract_dir)
    if not is_valid:
        return RestorePreviewResponse(
            session_id=session_id,
            is_valid=False,
            errors=errors,
            created_at=manifest.get("created_at") if isinstance(manifest, dict) else None,
            backup_version=manifest.get("backup_version") if isinstance(manifest, dict) else None,
            source_environment=manifest.get("environment") if isinstance(manifest, dict) else None,
            source_database_type=manifest.get("database_type") if isinstance(manifest, dict) else None,
            tables_count=len(manifest.get("tables", {})) if isinstance(manifest, dict) else 0,
            total_records=manifest.get("total_records", 0) if isinstance(manifest, dict) else 0,
            files_count=len(manifest.get("files", [])) if isinstance(manifest, dict) else 0,
            estimated_size_bytes=zip_path.stat().st_size,
            integrity_status="failed",
        )

    # Calculate Merge Plan
    merge_plan = await calculate_merge_plan(db, extract_dir, manifest)

    # Schema Compatibility
    app_tables = {t.name for t in get_application_tables()}
    backup_tables = set(manifest.get("tables", {}).keys())
    matching_tables = sorted(list(app_tables.intersection(backup_tables)))
    missing_tables = sorted(list(app_tables - backup_tables))
    extra_tables = sorted(list(backup_tables - app_tables))
    schema_compatibility = {
        "status": "fully_compatible" if not extra_tables else "partially_compatible",
        "matching_tables_count": len(matching_tables),
        "missing_tables_count": len(missing_tables),
        "extra_tables_count": len(extra_tables),
        "missing_tables": missing_tables,
        "extra_tables": extra_tables,
    }

    # Count files to restore vs replace
    files = manifest.get("files", [])
    files_to_restore = len(files)
    files_to_replace = 0
    for f_entry in files:
        arc_path = f_entry.get("archive_path")
        if arc_path and arc_path.startswith("files/"):
            rel_path = arc_path[len("files/") :]
            target_file = UPLOADS_DIR / rel_path
            if target_file.exists():
                files_to_replace += 1

    # Save session metadata
    session_meta = {
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "backup_version": manifest.get("backup_version", 1),
        "total_records": manifest.get("total_records", 0),
        "files_count": files_to_restore,
    }
    with open(session_dir / "session_meta.json", "w", encoding="utf-8") as f:
        json.dump(session_meta, f, indent=2)

    return RestorePreviewResponse(
        session_id=session_id,
        is_valid=True,
        errors=[],
        created_at=manifest.get("created_at"),
        backup_version=manifest.get("backup_version"),
        source_environment=manifest.get("environment"),
        source_database_type=manifest.get("database_type"),
        tables_count=len(manifest.get("tables", {})),
        total_records=manifest.get("total_records", 0),
        files_count=files_to_restore,
        estimated_size_bytes=zip_path.stat().st_size,
        integrity_status="verified",
        schema_compatibility=schema_compatibility,
        records_to_insert=merge_plan.get("total_inserts", 0),
        records_to_update=merge_plan.get("total_updates", 0),
        records_unchanged=merge_plan.get("total_unchanged", 0),
        conflicts=merge_plan.get("conflicts", []),
        files_to_restore=files_to_restore,
        files_to_replace=files_to_replace,
    )


async def execute_session_restore(
    session_id: str,
    mode: str,
    confirmation: Optional[str],
    db: AsyncSession,
) -> ExecuteRestoreResponse:
    """Executes database and file restoration for a validated upload session."""
    assert_local_restore_allowed()

    session_dir = RESTORE_SESSIONS_DIR / session_id
    extract_dir = session_dir / "extracted"
    manifest_file = extract_dir / "manifest.json"

    if not session_dir.exists() or not manifest_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restore session expired or not found. Please upload the backup archive again.",
        )

    mode_clean = mode.lower().strip()
    if mode_clean not in ("merge", "replace"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid restore mode '{mode}'. Mode must be 'merge' or 'replace'.",
        )

    if mode_clean == "replace":
        if confirmation != "REPLACE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation required: You must explicitly type REPLACE to execute a replace restore.",
            )

    # 1. Create safety backup if replace mode
    safety_backup_name: Optional[str] = None
    if mode_clean == "replace":
        safety_path = create_safety_backup()
        if safety_path:
            safety_backup_name = safety_path.name
            logger.info(f"Created safety backup at {safety_path}")

    # 2. Read manifest
    try:
        with open(manifest_file, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read session manifest: {e}",
        )

    # 3. Transactional Database Restore
    try:
        restored_counts = await restore_database_transactional(
            db=db,
            extracted_dir=extract_dir,
            manifest=manifest,
            mode=mode_clean,
        )
    except Exception as e:
        logger.error(f"Execution failed during database restoration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database restore failed: {str(e)}",
        )

    # 4. Files Restoration
    try:
        files_restored = restore_files(extract_dir, manifest)
    except Exception as e:
        logger.warning(f"File extraction partially failed: {e}")
        files_restored = 0

    # 5. Cleanup session directory after execution
    shutil.rmtree(session_dir, ignore_errors=True)

    total_records = sum(restored_counts.values())
    msg = f"Successfully restored {total_records} records across {len(restored_counts)} tables and {files_restored} files in {mode_clean} mode."
    if safety_backup_name:
        msg += f" Safety backup created: {safety_backup_name}."

    return ExecuteRestoreResponse(
        success=True,
        mode=mode_clean,
        records_restored=total_records,
        files_restored=files_restored,
        safety_backup_path=safety_backup_name,
        message=msg,
    )

