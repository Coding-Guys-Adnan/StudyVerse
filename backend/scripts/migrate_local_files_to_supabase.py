"""
Script to migrate local uploaded files from backend/uploads/ into Supabase Storage
and update database attachment records with their public Supabase Storage URLs.

Usage:
  1. Set environment variables:
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     TARGET_DATABASE_URL=postgresql+psycopg2://postgres:pass@db.ref.supabase.co:5432/postgres
  2. Run: python backend/scripts/migrate_local_files_to_supabase.py
"""

import os
import sys
from pathlib import Path
import httpx

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, select, Table, MetaData

def migrate_files():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    bucket = os.getenv("SUPABASE_BUCKET", "studyverse-uploads")
    db_url = os.getenv("TARGET_DATABASE_URL") or os.getenv("DATABASE_URL")

    if not supabase_url or not supabase_key:
        print("[!] Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.")
        return

    if not db_url:
        print("[!] Please set TARGET_DATABASE_URL or DATABASE_URL environment variable.")
        return

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and "+psycopg2" not in db_url and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif "+asyncpg" in db_url:
        db_url = db_url.replace("+asyncpg", "+psycopg2", 1)
    elif "+aiosqlite" in db_url:
        db_url = db_url.replace("+aiosqlite", "", 1)

    uploads_root = backend_dir / "uploads"
    if not uploads_root.exists():
        print(f"[-] Uploads directory not found at {uploads_root}. Nothing to migrate.")
        return

    print(f"[*] Scanning local files in {uploads_root}...")
    print(f"[*] Target Supabase Storage: {supabase_url} (Bucket: {bucket})")

    engine = create_engine(db_url)
    meta = MetaData()
    meta.reflect(bind=engine)

    if "syllabus_attachments" not in meta.tables:
        print("[!] 'syllabus_attachments' table not found in target database.")
        return

    attachments_table = meta.tables["syllabus_attachments"]

    uploaded_count = 0
    updated_records = 0

    with engine.begin() as conn:
        for root, _, files in os.walk(uploads_root):
            for filename in files:
                file_path = Path(root) / filename
                rel_path = file_path.relative_to(uploads_root).as_posix() # e.g. syllabus/file_123.pdf
                
                # MIME detection
                ext = filename.split(".")[-1].lower() if "." in filename else ""
                mime = "application/octet-stream"
                if ext == "pdf":
                    mime = "application/pdf"
                elif ext in ("jpg", "jpeg"):
                    mime = "image/jpeg"
                elif ext == "png":
                    mime = "image/png"

                object_path = rel_path
                upload_endpoint = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path}"
                headers = {
                    "Authorization": f"Bearer {supabase_key}",
                    "apiKey": supabase_key,
                    "Content-Type": mime,
                    "x-upsert": "true",
                }

                with open(file_path, "rb") as f:
                    file_bytes = f.read()

                resp = httpx.post(upload_endpoint, headers=headers, content=file_bytes)
                if resp.status_code in (200, 201):
                    uploaded_count += 1
                    public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{object_path}"
                    
                    # Update local/remote database matching old local stored_path
                    local_stored_path = f"/uploads/{rel_path}"
                    result = conn.execute(
                        attachments_table.update()
                        .where(attachments_table.c.stored_path == local_stored_path)
                        .values(stored_path=public_url)
                    )
                    updated_records += result.rowcount
                    print(f"[+] Uploaded {rel_path} -> Supabase URL")
                else:
                    print(f"[!] Failed to upload {rel_path}: {resp.status_code} {resp.text}")

    print(f"\n[SUCCESS] File migration complete: {uploaded_count} files uploaded, {updated_records} database records updated.")

if __name__ == "__main__":
    migrate_files()
