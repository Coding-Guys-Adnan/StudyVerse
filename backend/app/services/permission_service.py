import copy
from typing import Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.student_teacher import StudentTeacher
from app.models.student import Student
from app.models.user import User
from app.schemas.student_teacher import (
    StudentPermissions,
    StudentPermissionsResponse,
    StudentEffectivePermissionsResponse,
)

DEFAULT_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "syllabus": {"can_edit": False, "can_import": False},
    "homework": {"can_edit": False, "can_import": False},
    "calendar": {"can_edit": False, "can_import": False},
    "tests": {"can_edit": False, "can_import": False},
    "files": {"can_edit": False, "can_import": False},
}


def normalize_permissions_dict(raw: Any) -> dict:
    """Safely normalizes raw JSON data into a valid StudentPermissions dictionary."""
    if not isinstance(raw, dict):
        raw = {}
    try:
        validated = StudentPermissions.model_validate(raw)
        return validated.model_dump()
    except Exception:
        # If schema validation fails due to legacy or corrupted structure, merge safely
        res = copy.deepcopy(DEFAULT_PERMISSIONS)
        for mod, actions in DEFAULT_PERMISSIONS.items():
            mod_data = raw.get(mod, {})
            if isinstance(mod_data, dict):
                for act in actions.keys():
                    res[mod][act] = bool(mod_data.get(act, False))
        return res


async def get_or_create_student_teacher(
    db: AsyncSession, student_id: str, teacher_id: str
) -> StudentTeacher:
    """Retrieve or create a student_teachers association row with default permissions."""
    result = await db.execute(
        select(StudentTeacher).where(
            StudentTeacher.student_id == student_id,
            StudentTeacher.teacher_id == teacher_id,
        )
    )
    st = result.scalar_one_or_none()
    if st:
        if st.permissions is None:
            st.permissions = copy.deepcopy(DEFAULT_PERMISSIONS)
            await db.flush()
        return st

    # Verify student exists
    student_res = await db.execute(select(Student).where(Student.id == student_id))
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    st = StudentTeacher(
        student_id=student_id,
        teacher_id=teacher_id,
        permissions=copy.deepcopy(DEFAULT_PERMISSIONS),
    )
    db.add(st)
    await db.flush()
    await db.refresh(st)
    return st


async def get_student_effective_permissions(
    db: AsyncSession, student_id: str
) -> Tuple[StudentPermissions, Dict[str, StudentPermissions]]:
    """
    Computes effective permissions for a student by computing the logical OR
    across all assigned teachers in the student_teachers association table.
    """
    # 1. Fetch all assigned student_teachers rows
    result = await db.execute(
        select(StudentTeacher).where(StudentTeacher.student_id == student_id)
    )
    st_records = list(result.scalars().all())

    # 2. Check primary legacy student.teacher_id if no record exists
    if not st_records:
        student_res = await db.execute(select(Student).where(Student.id == student_id))
        student = student_res.scalar_one_or_none()
        if student and student.teacher_id:
            st = await get_or_create_student_teacher(db, student_id, student.teacher_id)
            st_records.append(st)

    teacher_perms: Dict[str, StudentPermissions] = {}
    effective_dict = copy.deepcopy(DEFAULT_PERMISSIONS)

    for st in st_records:
        clean_dict = normalize_permissions_dict(st.permissions)
        typed_perm = StudentPermissions.model_validate(clean_dict)
        teacher_perms[st.teacher_id] = typed_perm

        # Logical OR across teachers
        for module_name, actions in clean_dict.items():
            if module_name in effective_dict:
                for action_name, is_allowed in actions.items():
                    if is_allowed:
                        effective_dict[module_name][action_name] = True

    effective_typed = StudentPermissions.model_validate(effective_dict)
    return effective_typed, teacher_perms


async def check_student_permission(
    db: AsyncSession,
    student: Student,
    module: str,
    action: str,
    teacher_id: str | None = None,
) -> bool:
    """
    Checks if a student has permission for a specific module and action.
    If teacher_id is provided, checks that specific teacher relationship.
    Otherwise, checks the student's effective permissions.
    """
    if teacher_id:
        st_res = await db.execute(
            select(StudentTeacher).where(
                StudentTeacher.student_id == student.id,
                StudentTeacher.teacher_id == teacher_id,
            )
        )
        st = st_res.scalar_one_or_none()
        if not st:
            return False
        clean_dict = normalize_permissions_dict(st.permissions)
        return bool(clean_dict.get(module, {}).get(action, False))

    effective_perms, _ = await get_student_effective_permissions(db, student.id)
    mod_obj = getattr(effective_perms, module, None)
    if mod_obj is None:
        return False
    return bool(getattr(mod_obj, action, False))


async def require_student_permission(
    db: AsyncSession,
    student: Student,
    module: str,
    action: str,
    teacher_id: str | None = None,
) -> None:
    """
    Enforces student permission. Raises HTTP 403 Forbidden if not allowed.
    """
    allowed = await check_student_permission(db, student, module, action, teacher_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: Student does not have '{action}' access for '{module}'. Ask your teacher to grant access.",
        )


async def get_teacher_student_permissions(
    db: AsyncSession,
    student_id: str,
    teacher_user: User,
) -> StudentPermissionsResponse:
    """
    Retrieves the permissions granted by a specific teacher (or allows admin to read).
    """
    # Verify student exists
    student_res = await db.execute(select(Student).where(Student.id == student_id))
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    # If teacher, verify assignment
    if teacher_user.role == "teacher":
        st_res = await db.execute(
            select(StudentTeacher).where(
                StudentTeacher.student_id == student_id,
                StudentTeacher.teacher_id == teacher_user.id,
            )
        )
        st = st_res.scalar_one_or_none()
        if not st and student.teacher_id != teacher_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this student",
            )
        target_teacher_id = teacher_user.id
    elif teacher_user.role == "admin":
        target_teacher_id = student.teacher_id or teacher_user.id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    st = await get_or_create_student_teacher(db, student_id, target_teacher_id)
    clean_dict = normalize_permissions_dict(st.permissions)
    return StudentPermissionsResponse(
        student_id=student_id,
        teacher_id=target_teacher_id,
        permissions=StudentPermissions.model_validate(clean_dict),
    )


async def update_teacher_student_permissions(
    db: AsyncSession,
    student_id: str,
    teacher_user: User,
    permissions_data: StudentPermissions,
    target_teacher_id: str | None = None,
) -> StudentPermissionsResponse:
    """
    Updates the permissions granted by a specific teacher to a student.
    """
    student_res = await db.execute(select(Student).where(Student.id == student_id))
    student = student_res.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    if teacher_user.role == "teacher":
        actual_teacher_id = teacher_user.id
        # Verify assignment
        st_res = await db.execute(
            select(StudentTeacher).where(
                StudentTeacher.student_id == student_id,
                StudentTeacher.teacher_id == actual_teacher_id,
            )
        )
        st = st_res.scalar_one_or_none()
        if not st and student.teacher_id != actual_teacher_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not assigned to this student",
            )
    elif teacher_user.role == "admin":
        actual_teacher_id = target_teacher_id or student.teacher_id or teacher_user.id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    st = await get_or_create_student_teacher(db, student_id, actual_teacher_id)
    st.permissions = permissions_data.model_dump()
    await db.flush()
    await db.refresh(st)

    return StudentPermissionsResponse(
        student_id=student_id,
        teacher_id=actual_teacher_id,
        permissions=StudentPermissions.model_validate(st.permissions),
    )
