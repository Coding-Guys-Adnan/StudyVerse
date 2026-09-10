from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_teacher, get_current_user
from app.models.user import User
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentListResponse,
    DashboardStats,
)
from app.schemas.student_teacher import (
    StudentPermissionsUpdate,
    StudentPermissionsResponse,
)
from app.services.student_service import (
    list_students,
    create_student,
    get_student,
    update_student,
    delete_student,
    get_dashboard_stats,
)
from app.services.permission_service import (
    get_teacher_student_permissions,
    update_teacher_student_permissions,
)

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=StudentListResponse)
async def get_students(
    search: str | None = Query(None, description="Search by name, email, or class"),
    class_grade: str | None = Query(None, description="Filter by class/grade"),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List all students for the current teacher, with optional search & filter."""
    return await list_students(db, teacher, search=search, class_grade=class_grade)


@router.post("", response_model=StudentResponse, status_code=201)
async def add_student(
    data: StudentCreate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Add a new student."""
    return await create_student(db, teacher, data)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student_by_id(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific student by ID."""
    return await get_student(db, teacher, student_id)


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student_by_id(
    student_id: str,
    data: StudentUpdate,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update a student's details."""
    return await update_student(db, teacher, student_id, data)


@router.delete("/{student_id}")
async def delete_student_by_id(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a student."""
    return await delete_student(db, teacher, student_id)


@router.get("/{student_id}/permissions", response_model=StudentPermissionsResponse)
async def get_student_permissions(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get permissions granted to a student by the current teacher (or admin)."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin access required",
        )
    return await get_teacher_student_permissions(db, student_id, current_user)


@router.put("/{student_id}/permissions", response_model=StudentPermissionsResponse)
async def update_student_permissions(
    student_id: str,
    data: StudentPermissionsUpdate,
    target_teacher_id: str | None = Query(None, description="Admin only: target teacher ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update permissions granted to a student by the current teacher (or admin)."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin access required",
        )
    return await update_teacher_student_permissions(
        db, student_id, current_user, data.permissions, target_teacher_id
    )


# ─── Dashboard ───────────────────────────────────────────
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard overview stats for the current teacher."""
    return await get_dashboard_stats(db, teacher)
