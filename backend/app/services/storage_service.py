import os
import uuid
import logging
from fastapi import HTTPException, status
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
}

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_file(filename: str, content_type: str, file_size: int) -> None:
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    mime = (content_type or "").lower()

    if mime not in ALLOWED_MIME_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, JPEG, and PNG files are allowed.",
        )

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed 10MB limit.",
        )


async def upload_file_bytes(
    filename: str,
    contents: bytes,
    content_type: str,
    folder: str = "syllabus",
) -> str:
    """Uploads file bytes either to Supabase Storage (if configured) or local disk.

    Returns the stored_path (Public URL for Supabase, or relative path for local).
    """
    file_size = len(contents)
    validate_file(filename, content_type, file_size)

    supabase_key = (
        settings.SUPABASE_SERVICE_ROLE_KEY
        or settings.SUPABASE_KEY
        or settings.SUPABASE_ANON_KEY
    )

    # 1. Production: Upload to Supabase Storage if configured
    if settings.SUPABASE_URL and supabase_key:
        try:
            import httpx

            file_id = str(uuid.uuid4())
            safe_filename = f"{file_id}_{filename}"
            object_path = f"{folder}/{safe_filename}"

            url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.SUPABASE_BUCKET}/{object_path}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "apiKey": supabase_key,
                "Content-Type": content_type or "application/octet-stream",
                "x-upsert": "true",
            }

            async with httpx.AsyncClient() as client:
                resp = await client.post(url, headers=headers, content=contents)
                if resp.status_code not in (200, 201):
                    logger.error(f"Supabase Storage Upload failed: {resp.status_code} - {resp.text}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to upload file to Supabase Storage.",
                    )

            public_url = (
                f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/"
                f"{settings.SUPABASE_BUCKET}/{object_path}"
            )
            return public_url
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading file to Supabase: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Storage upload error: {str(e)}",
            )

    # 2. Local Fallback: Save to uploads directory on disk
    from pathlib import Path
    backend_dir = Path(__file__).resolve().parent.parent.parent
    uploads_base = backend_dir / "uploads"
    upload_dir = uploads_base / folder
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{filename}"
    file_path = upload_dir / safe_filename

    with open(file_path, "wb") as f:
        f.write(contents)

    return f"/uploads/{folder}/{safe_filename}"


async def delete_file_by_path(stored_path: str) -> None:
    """Deletes a file either from Supabase Storage or local disk."""
    if not stored_path:
        return

    supabase_key = (
        settings.SUPABASE_SERVICE_ROLE_KEY
        or settings.SUPABASE_KEY
        or settings.SUPABASE_ANON_KEY
    )

    # Supabase Storage path
    if stored_path.startswith("http") and settings.SUPABASE_URL and supabase_key:
        try:
            import httpx

            # Extract object path after bucket name
            prefix = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/"
            if stored_path.startswith(prefix):
                object_path = stored_path[len(prefix):]
                delete_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{settings.SUPABASE_BUCKET}/{object_path}"
                headers = {
                    "Authorization": f"Bearer {supabase_key}",
                    "apiKey": supabase_key,
                }
                async with httpx.AsyncClient() as client:
                    await client.delete(delete_url, headers=headers)
        except Exception as e:
            logger.warning(f"Failed to delete file from Supabase: {e}")
        return

    # Local file path
    if stored_path.startswith("/uploads/"):
        from pathlib import Path
        backend_dir = Path(__file__).resolve().parent.parent.parent
        uploads_base = backend_dir / "uploads"
        rel_path = stored_path.replace("/uploads/", "", 1).lstrip("/")
        local_file_path = uploads_base / rel_path
        if local_file_path.exists():
            try:
                local_file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete local file {local_file_path}: {e}")
