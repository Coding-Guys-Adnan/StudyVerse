from fastapi import APIRouter, Depends, Query, status, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.user import User
from app.schemas.admin import (
    CreateTeacherRequest,
    UpdateTeacherAdminRequest,
    TeacherAdminResponse,
    UpdateTeacherStatusRequest,
    AdminResetPasswordRequest,
    StudentAdminResponse,
    UpdateStudentAdminRequest,
    UpdateStudentStatusRequest,
    AssignedTeacherInfo,
)
from app.schemas.backup import (
    BackupStatsResponse,
    RestorePreviewResponse,
    ExecuteRestoreRequest,
    ExecuteRestoreResponse,
)
from app.services import admin_service, backup_service, restore_service

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── TEACHER MANAGEMENT ────────────────────────────────

@router.get("/teachers", response_model=list[TeacherAdminResponse])
async def get_all_teachers(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all teachers in the system (Admin only)."""
    return await admin_service.list_admin_teachers(db)


@router.post(
    "/teachers",
    response_model=TeacherAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_new_teacher(
    data: CreateTeacherRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new teacher account (Admin only)."""
    return await admin_service.create_teacher_by_admin(db, data)


@router.put("/teachers/{teacher_id}", response_model=TeacherAdminResponse)
async def update_teacher_details(
    teacher_id: str,
    data: UpdateTeacherAdminRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update teacher name, email, or status (Admin only)."""
    return await admin_service.update_teacher_by_admin(db, teacher_id, data)


@router.patch("/teachers/{teacher_id}/status", response_model=TeacherAdminResponse)
async def update_teacher_active_status(
    teacher_id: str,
    data: UpdateTeacherStatusRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a teacher account (Admin only)."""
    return await admin_service.update_teacher_status(db, teacher_id, data)


@router.delete("/teachers/{teacher_id}")
async def delete_teacher_account(
    teacher_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a teacher account (Admin only)."""
    return await admin_service.delete_teacher_by_admin(db, teacher_id)


@router.post("/teachers/{teacher_id}/reset-password")
async def reset_teacher_password(
    teacher_id: str,
    data: AdminResetPasswordRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset password for a specific teacher account (Admin only)."""
    return await admin_service.admin_reset_user_password(db, teacher_id, data.new_password)


# ─── GENERAL USER PASSWORD RESET ──────────────────────

@router.post("/users/{user_id}/reset-password")
async def admin_reset_password_endpoint(
    user_id: str,
    data: AdminResetPasswordRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset password for any user account (Admin only)."""
    return await admin_service.admin_reset_user_password(db, user_id, data.new_password)


# ─── STUDENT MANAGEMENT ────────────────────────────────

@router.get("/students", response_model=list[StudentAdminResponse])
async def get_all_students(
    search: str | None = Query(None, description="Search by name, email, or phone"),
    class_grade: str | None = Query(None, description="Filter by class/grade"),
    board: str | None = Query(None, description="Filter by educational board"),
    is_active: bool | None = Query(None, description="Filter by account status"),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all student accounts with optional filters (Admin only)."""
    return await admin_service.list_admin_students(
        db, search=search, class_grade=class_grade, board=board, is_active=is_active
    )


@router.put("/students/{student_id}", response_model=StudentAdminResponse)
async def update_student_details(
    student_id: str,
    data: UpdateStudentAdminRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update student profile details and linked user account (Admin only)."""
    return await admin_service.update_student_by_admin(db, student_id, data)


@router.patch("/students/{student_id}/status", response_model=StudentAdminResponse)
async def update_student_active_status(
    student_id: str,
    data: UpdateStudentStatusRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Activate or deactivate a student account (Admin only)."""
    return await admin_service.update_student_status(db, student_id, data)


@router.delete("/students/{student_id}")
async def delete_student_account(
    student_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a student record & user account (Admin only)."""
    return await admin_service.delete_student_by_admin(db, student_id)


@router.post("/students/{student_id}/reset-password")
async def reset_student_password(
    student_id: str,
    data: AdminResetPasswordRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset password or provision login credentials for a student (Admin only)."""
    return await admin_service.admin_reset_student_password(db, student_id, data.new_password)


# ─── STUDENT ↔ TEACHER ASSIGNMENTS ─────────────────────

@router.get("/students/{student_id}/teachers", response_model=list[AssignedTeacherInfo])
async def get_student_assigned_teachers(
    student_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get all assigned teachers for a student (Admin only)."""
    return await admin_service.get_student_teachers(db, student_id)


@router.post("/students/{student_id}/teachers/{teacher_id}", response_model=list[AssignedTeacherInfo])
async def assign_teacher_to_student(
    student_id: str,
    teacher_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Assign a teacher to a student (Admin only)."""
    return await admin_service.add_teacher_to_student(db, student_id, teacher_id)


@router.delete("/students/{student_id}/teachers/{teacher_id}", response_model=list[AssignedTeacherInfo])
async def unassign_teacher_from_student(
    student_id: str,
    teacher_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a teacher assignment from a student (Admin only)."""
    return await admin_service.remove_teacher_from_student(db, student_id, teacher_id)


# ─── DATA BACKUP & EXPORT ──────────────────────────────

@router.get("/backup/stats", response_model=BackupStatsResponse)
async def get_backup_statistics(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve system backup statistics, table record counts, and last backup metadata (Admin only)."""
    return await backup_service.get_backup_stats(db)


@router.get("/backup/download")
async def download_backup_archive(
    type: str = Query("full", regex="^(full|database|files)$", description="Backup type: full, database, or files"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generates and downloads a complete ZIP backup archive (Admin only).

    Cleans up the temporary archive automatically after download.
    """
    zip_path, filename = await backup_service.create_backup_zip(
        db=db,
        admin_user=admin,
        backup_type=type,
    )
    background_tasks.add_task(backup_service.cleanup_temp_backup, zip_path)
    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/backup/upload-preview", response_model=RestorePreviewResponse)
async def upload_backup_for_preview(
    file: UploadFile = File(..., description="Backup ZIP archive to inspect and validate"),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Uploads a backup ZIP archive, verifies checksums & schema compatibility, and returns preflight preview without touching the database (Admin only)."""
    return await restore_service.prepare_and_preview_upload(file=file, db=db)


@router.post("/backup/execute-restore", response_model=ExecuteRestoreResponse)
async def execute_restore_endpoint(
    data: ExecuteRestoreRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Executes atomic database and file restore for a validated session in Merge or Replace mode (Admin only)."""
    return await restore_service.execute_session_restore(
        session_id=data.session_id,
        mode=data.mode,
        confirmation=data.confirmation,
        db=db,
    )



