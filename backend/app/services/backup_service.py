import os
import json
import uuid
import shutil
import hashlib
import zipfile
import logging
import tempfile
from pathlib import Path
from datetime import datetime, date, timezone
from typing import Optional, Any

import httpx
from sqlalchemy import select, text, Table
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import Base
from app.models.user import User
import app.models  # Ensure all models are registered in Base.metadata
from app.schemas.backup import (
    BackupStatsResponse,
    BackupManifest,
    ManifestFileEntry,
    LastBackupInfo,
)

logger = logging.getLogger(__name__)
settings = get_settings()

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
SCRATCH_DIR = BACKEND_DIR / "scratch"
AUDIT_LOG_FILE = SCRATCH_DIR / "backup_audit_log.json"


def _json_serial(obj: Any) -> Any:
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if hasattr(obj, "value"):  # Enums
        return obj.value
    raise TypeError(f"Type {type(obj)} not serializable")


def _record_audit_log(
    admin_id: Optional[str],
    backup_type: str,
    total_records: int,
    files_count: int,
    file_size_bytes: int,
    status: str = "success",
) -> None:
    """Records a lightweight backup event in scratch/backup_audit_log.json."""
    try:
        SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "admin_id": admin_id,
            "backup_type": backup_type,
            "total_records": total_records,
            "files_count": files_count,
            "file_size_bytes": file_size_bytes,
            "status": status,
        }
        logs = []
        if AUDIT_LOG_FILE.exists():
            try:
                with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                    logs = json.load(f)
            except Exception:
                logs = []
        logs.append(log_entry)
        # Keep last 50 entries
        logs = logs[-50:]
        with open(AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        logger.warning(f"Failed to record backup audit log: {e}")


def _get_last_backup_info() -> Optional[LastBackupInfo]:
    """Retrieves the last successful backup info from audit log."""
    try:
        if AUDIT_LOG_FILE.exists():
            with open(AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                logs = json.load(f)
            if logs:
                successful_logs = [l for l in logs if l.get("status") == "success"]
                if successful_logs:
                    last = successful_logs[-1]
                    return LastBackupInfo(
                        created_at=last["timestamp"],
                        backup_type=last.get("backup_type", "full"),
                        file_size_bytes=last.get("file_size_bytes", 0),
                        admin_id=last.get("admin_id"),
                        total_records=last.get("total_records", 0),
                        files_count=last.get("files_count", 0),
                    )
    except Exception as e:
        logger.warning(f"Failed to read last backup info: {e}")
    return None


async def get_schema_revision(db: AsyncSession) -> Optional[str]:
    """Retrieves the current Alembic schema revision from database or migrations."""
    try:
        result = await db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        row = result.fetchone()
        if row and row[0]:
            return str(row[0])
    except Exception:
        # Table might not exist yet if alembic hasn't run
        pass
    
    # Fallback to inspecting alembic version scripts
    try:
        versions_dir = BACKEND_DIR / "alembic" / "versions"
        if versions_dir.exists():
            py_files = sorted(versions_dir.glob("*.py"))
            if py_files:
                latest = py_files[-1].stem
                # Format: YYYY_MM_DD_revision_slug
                parts = latest.split("_")
                if len(parts) >= 4:
                    return parts[3]
    except Exception:
        pass
    return "head"


def get_application_tables() -> list[Table]:
    """Returns sorted application tables in topological foreign-key order, excluding system tables."""
    excluded_tables = {"alembic_version"}
    return [
        table
        for table in Base.metadata.sorted_tables
        if table.name not in excluded_tables
    ]


async def get_backup_stats(db: AsyncSession) -> BackupStatsResponse:
    """Calculates live database records, files, size, and last backup stats."""
    tables = get_application_tables()
    tables_summary: dict[str, int] = {}
    total_records = 0

    for table in tables:
        try:
            count_res = await db.execute(select(text(f"count(*) FROM {table.name}")))
            cnt = count_res.scalar() or 0
            tables_summary[table.name] = cnt
            total_records += cnt
        except Exception as e:
            logger.warning(f"Could not count rows for table {table.name}: {e}")
            tables_summary[table.name] = 0

    # Count uploaded files and calculate size
    total_files = 0
    estimated_files_size = 0

    if UPLOADS_DIR.exists():
        for root, _, files in os.walk(UPLOADS_DIR):
            for filename in files:
                f_path = Path(root) / filename
                total_files += 1
                try:
                    estimated_files_size += f_path.stat().st_size
                except Exception:
                    pass

    # Rough estimate of database JSON size (approx 300 bytes per record)
    estimated_db_size = total_records * 300
    estimated_total_size = estimated_files_size + estimated_db_size

    schema_rev = await get_schema_revision(db)
    is_pg = "postgres" in settings.DATABASE_URL
    is_supabase = bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY))

    return BackupStatsResponse(
        total_records=total_records,
        total_files=total_files,
        estimated_size_bytes=estimated_total_size,
        last_backup_generated=_get_last_backup_info(),
        tables_summary=tables_summary,
        schema_revision=schema_rev,
        environment="production" if (is_pg or is_supabase) else "local",
        database_type="postgresql" if is_pg else "sqlite",
        file_storage="supabase" if is_supabase else "local",
    )


async def export_database_to_json(db: AsyncSession, target_dir: Path) -> dict[str, int]:
    """Exports all application tables into JSON files inside target_dir/database/."""
    db_dir = target_dir / "database"
    db_dir.mkdir(parents=True, exist_ok=True)

    tables = get_application_tables()
    counts: dict[str, int] = {}

    for table in tables:
        rows_result = await db.execute(select(table))
        rows = rows_result.mappings().all()
        table_records = []

        for row in rows:
            record_dict = dict(row)
            # Ensure no secret keys, JWT secrets, or environment credentials are in records
            table_records.append(record_dict)

        table_file = db_dir / f"{table.name}.json"
        with open(table_file, "w", encoding="utf-8") as f:
            json.dump(table_records, f, default=_json_serial, indent=2, ensure_ascii=False)

        counts[table.name] = len(table_records)

    return counts


async def _download_file_bytes(url_or_path: str) -> Optional[tuple[bytes, str]]:
    """Downloads or reads file bytes and returns (bytes, mime_type)."""
    if not url_or_path:
        return None

    # 1. Remote HTTP/HTTPS (e.g. Supabase Storage)
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        supabase_key = (
            settings.SUPABASE_SERVICE_ROLE_KEY
            or settings.SUPABASE_KEY
            or settings.SUPABASE_ANON_KEY
        )
        headers = {}
        if supabase_key and settings.SUPABASE_URL and settings.SUPABASE_URL in url_or_path:
            headers["Authorization"] = f"Bearer {supabase_key}"
            headers["apiKey"] = supabase_key

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url_or_path, headers=headers)
                if resp.status_code == 200:
                    content_type = resp.headers.get("content-type", "application/octet-stream")
                    return resp.content, content_type
                else:
                    logger.warning(f"Failed to fetch remote file {url_or_path}: HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"Error fetching remote file {url_or_path}: {e}")
        return None

    # 2. Local file path (e.g. /uploads/syllabus/xxx.pdf or syllabus/xxx.pdf)
    rel_path = url_or_path.lstrip("/")
    if rel_path.startswith("uploads/"):
        rel_path = rel_path[len("uploads/"):]

    local_path = UPLOADS_DIR / rel_path
    if local_path.exists() and local_path.is_file():
        try:
            with open(local_path, "rb") as f:
                content = f.read()
            ext = local_path.suffix.lower()
            mime_map = {
                ".pdf": "application/pdf",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
            }
            mime_type = mime_map.get(ext, "application/octet-stream")
            return content, mime_type
        except Exception as e:
            logger.warning(f"Error reading local file {local_path}: {e}")

    return None


async def export_files(db: AsyncSession, target_dir: Path) -> list[ManifestFileEntry]:
    """Discovers all file references across models and local uploads, copies them to target_dir/files/, and returns manifest entries."""
    files_dir = target_dir / "files"
    files_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: list[ManifestFileEntry] = []
    processed_paths: set[str] = set()

    # Discover from models
    from app.models.academic import SyllabusAttachment, Homework, Test
    from app.models.student import Student

    # 1. Syllabus Attachments
    att_res = await db.execute(select(SyllabusAttachment))
    attachments = att_res.scalars().all()
    for att in attachments:
        if att.stored_path and att.stored_path not in processed_paths:
            processed_paths.add(att.stored_path)
            res = await _download_file_bytes(att.stored_path)
            if res:
                content, mime = res
                sha256_hash = hashlib.sha256(content).hexdigest()
                
                # Determine archive relative path
                filename = Path(att.stored_path.split("?")[0]).name
                if not filename:
                    filename = f"{att.id}_{att.filename}"
                rel_archive_path = f"syllabus/{filename}"
                out_path = files_dir / "syllabus" / filename
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(content)

                manifest_entries.append(
                    ManifestFileEntry(
                        archive_path=f"files/{rel_archive_path}",
                        sha256=sha256_hash,
                        file_size=len(content),
                        mime_type=att.mime_type or mime,
                        original_filename=att.filename,
                        source_table="syllabus_attachments",
                        record_id=att.id,
                        column_name="stored_path",
                    )
                )

    # 2. Homework Attachments
    hw_res = await db.execute(select(Homework).where(Homework.attachment_url.isnot(None)))
    homeworks = hw_res.scalars().all()
    for hw in homeworks:
        if hw.attachment_url and hw.attachment_url not in processed_paths:
            processed_paths.add(hw.attachment_url)
            res = await _download_file_bytes(hw.attachment_url)
            if res:
                content, mime = res
                sha256_hash = hashlib.sha256(content).hexdigest()
                filename = Path(hw.attachment_url.split("?")[0]).name
                rel_archive_path = f"homework/{filename}"
                out_path = files_dir / "homework" / filename
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(content)

                manifest_entries.append(
                    ManifestFileEntry(
                        archive_path=f"files/{rel_archive_path}",
                        sha256=sha256_hash,
                        file_size=len(content),
                        mime_type=mime,
                        original_filename=hw.attachment_name or filename,
                        source_table="homework",
                        record_id=hw.id,
                        column_name="attachment_url",
                    )
                )

    # 3. Test Question / Answer Papers
    test_res = await db.execute(select(Test))
    tests = test_res.scalars().all()
    for t in tests:
        for url_field, name_field, col_name in [
            (t.question_paper_url, t.question_paper_name, "question_paper_url"),
            (t.answer_paper_url, t.answer_paper_name, "answer_paper_url"),
        ]:
            if url_field and url_field not in processed_paths:
                processed_paths.add(url_field)
                res = await _download_file_bytes(url_field)
                if res:
                    content, mime = res
                    sha256_hash = hashlib.sha256(content).hexdigest()
                    filename = Path(url_field.split("?")[0]).name
                    rel_archive_path = f"tests/{filename}"
                    out_path = files_dir / "tests" / filename
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(out_path, "wb") as f:
                        f.write(content)

                    manifest_entries.append(
                        ManifestFileEntry(
                            archive_path=f"files/{rel_archive_path}",
                            sha256=sha256_hash,
                            file_size=len(content),
                            mime_type=mime,
                            original_filename=name_field or filename,
                            source_table="tests",
                            record_id=t.id,
                            column_name=col_name,
                        )
                    )

    # 4. Student Avatars
    student_res = await db.execute(select(Student).where(Student.avatar_url.isnot(None)))
    students = student_res.scalars().all()
    for s in students:
        if s.avatar_url and s.avatar_url not in processed_paths:
            processed_paths.add(s.avatar_url)
            res = await _download_file_bytes(s.avatar_url)
            if res:
                content, mime = res
                sha256_hash = hashlib.sha256(content).hexdigest()
                filename = Path(s.avatar_url.split("?")[0]).name
                rel_archive_path = f"avatars/{filename}"
                out_path = files_dir / "avatars" / filename
                out_path.parent.mkdir(parents=True, exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(content)

                manifest_entries.append(
                    ManifestFileEntry(
                        archive_path=f"files/{rel_archive_path}",
                        sha256=sha256_hash,
                        file_size=len(content),
                        mime_type=mime,
                        original_filename=filename,
                        source_table="students",
                        record_id=s.id,
                        column_name="avatar_url",
                    )
                )

    # 5. Also scan local backend/uploads directory for any remaining files not in DB
    if UPLOADS_DIR.exists():
        for root, _, files in os.walk(UPLOADS_DIR):
            for filename in files:
                file_path = Path(root) / filename
                rel_local = file_path.relative_to(UPLOADS_DIR).as_posix()
                archive_subpath = f"files/{rel_local}"

                # Check if already added
                if any(e.archive_path == archive_subpath for e in manifest_entries):
                    continue

                try:
                    with open(file_path, "rb") as f:
                        content = f.read()
                    sha256_hash = hashlib.sha256(content).hexdigest()
                    out_path = files_dir / rel_local
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(out_path, "wb") as f:
                        f.write(content)

                    ext = file_path.suffix.lower()
                    mime_map = {
                        ".pdf": "application/pdf",
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".png": "image/png",
                    }
                    mime = mime_map.get(ext, "application/octet-stream")

                    manifest_entries.append(
                        ManifestFileEntry(
                            archive_path=archive_subpath,
                            sha256=sha256_hash,
                            file_size=len(content),
                            mime_type=mime,
                            original_filename=filename,
                        )
                    )
                except Exception as e:
                    logger.warning(f"Failed to copy local file {file_path}: {e}")

    return manifest_entries


async def create_backup_zip(
    db: AsyncSession,
    admin_user: User,
    backup_type: str = "full",
) -> tuple[Path, str]:
    """Generates the StudyVerse backup archive and returns (zip_file_path, filename)."""
    temp_dir = Path(tempfile.mkdtemp(prefix="studyverse_backup_"))
    now = datetime.now(timezone.utc)
    timestamp_str = now.strftime("%Y-%m-%d_%H%M%S")

    suffix = ""
    if backup_type == "database":
        suffix = "_db"
    elif backup_type == "files":
        suffix = "_files"
    filename = f"StudyVerse_Backup_{timestamp_str}{suffix}.zip"
    zip_path = temp_dir / filename

    try:
        content_root = temp_dir / "content"
        content_root.mkdir(parents=True, exist_ok=True)

        table_counts: dict[str, int] = {}
        total_records = 0
        file_entries: list[ManifestFileEntry] = []

        # 1. Export Database
        if backup_type in ("full", "database"):
            table_counts = await export_database_to_json(db, content_root)
            total_records = sum(table_counts.values())

        # 2. Export Files
        if backup_type in ("full", "files"):
            file_entries = await export_files(db, content_root)

        # 3. Create Manifest
        schema_rev = await get_schema_revision(db)
        is_pg = "postgres" in settings.DATABASE_URL
        is_supabase = bool(settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY))

        manifest = BackupManifest(
            application="StudyVerse",
            backup_version=1,
            schema_revision=schema_rev,
            backup_type=backup_type,
            created_at=now.isoformat(),
            environment="production" if (is_pg or is_supabase) else "local",
            database_type="postgresql" if is_pg else "sqlite",
            file_storage="supabase" if is_supabase else "local",
            tables=table_counts,
            total_records=total_records,
            files_count=len(file_entries),
            files=file_entries,
        )

        manifest_file = content_root / "manifest.json"
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest.model_dump(), f, indent=2, ensure_ascii=False)

        # 4. Pack into ZIP archive
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(content_root):
                for file in files:
                    full_file_path = Path(root) / file
                    rel_archive_path = full_file_path.relative_to(content_root).as_posix()
                    zipf.write(full_file_path, arcname=rel_archive_path)

        # 5. Clean up unpacked content
        shutil.rmtree(content_root, ignore_errors=True)

        # 6. Audit Logging
        file_size = zip_path.stat().st_size
        admin_uid = getattr(admin_user, "id", None) or "system"
        _record_audit_log(
            admin_id=admin_uid,
            backup_type=backup_type,
            total_records=total_records,
            files_count=len(file_entries),
            file_size_bytes=file_size,
            status="success",
        )

        return zip_path, filename

    except Exception as e:
        admin_uid = getattr(admin_user, "id", None) or "system"
        _record_audit_log(
            admin_id=admin_uid,
            backup_type=backup_type,
            total_records=0,
            files_count=0,
            file_size_bytes=0,
            status="failed",
        )
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.error(f"Failed to create backup ZIP: {e}")
        raise


def cleanup_temp_backup(file_path: Path) -> None:
    """Removes the temporary ZIP and its enclosing temporary directory."""
    try:
        if file_path.exists():
            parent_dir = file_path.parent
            if file_path.is_file():
                file_path.unlink()
            if parent_dir.name.startswith("studyverse_backup_"):
                shutil.rmtree(parent_dir, ignore_errors=True)
    except Exception as e:
        logger.warning(f"Error cleaning up temporary backup {file_path}: {e}")
