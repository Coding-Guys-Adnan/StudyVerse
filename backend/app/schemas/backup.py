from pydantic import BaseModel
from typing import Optional


class LastBackupInfo(BaseModel):
    created_at: str
    backup_type: str
    file_size_bytes: int
    admin_id: Optional[str] = None
    total_records: int
    files_count: int


class BackupStatsResponse(BaseModel):
    total_records: int
    total_files: int
    estimated_size_bytes: int
    last_backup_generated: Optional[LastBackupInfo] = None
    tables_summary: dict[str, int]
    schema_revision: Optional[str] = None
    environment: str
    database_type: str
    file_storage: str


class ManifestFileEntry(BaseModel):
    archive_path: str
    sha256: str
    file_size: int
    mime_type: str
    original_filename: str
    source_table: Optional[str] = None
    record_id: Optional[str] = None
    column_name: Optional[str] = None


class BackupManifest(BaseModel):
    application: str = "StudyVerse"
    backup_version: int = 1
    schema_revision: Optional[str] = None
    backup_type: str = "full"
    created_at: str
    environment: str
    database_type: str
    file_storage: str
    tables: dict[str, int]
    total_records: int
    files_count: int
    files: list[ManifestFileEntry]


class RestorePreviewResponse(BaseModel):
    session_id: str
    is_valid: bool
    errors: list[str] = []
    created_at: Optional[str] = None
    backup_version: Optional[int] = None
    source_environment: Optional[str] = None
    source_database_type: Optional[str] = None
    tables_count: int = 0
    total_records: int = 0
    files_count: int = 0
    estimated_size_bytes: int = 0
    integrity_status: str = "valid"
    schema_compatibility: dict[str, object] = {}
    records_to_insert: int = 0
    records_to_update: int = 0
    records_unchanged: int = 0
    conflicts: list[str] = []
    files_to_restore: int = 0
    files_to_replace: int = 0


class ExecuteRestoreRequest(BaseModel):
    session_id: str
    mode: str = "merge"  # "merge" or "replace"
    confirmation: Optional[str] = None


class ExecuteRestoreResponse(BaseModel):
    success: bool
    mode: str
    records_restored: int
    files_restored: int
    safety_backup_path: Optional[str] = None
    message: str

