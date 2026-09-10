from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete
from fastapi import HTTPException, status
from app.models.user import User
from app.models.student import Student
from app.models.student_teacher import StudentTeacher
from app.models.academic import (
    Attendance,
    DailyPlan,
    CalendarEvent,
    FeeRecord,
    Homework,
    Syllabus,
    Test,
    SyllabusDocument,
    Recommendation,
    AIPlan,
    SyllabusAttachment,
    Announcement,
)
from app.schemas.admin import (
    CreateTeacherRequest,
    UpdateTeacherAdminRequest,
    TeacherAdminResponse,
    UpdateTeacherStatusRequest,
    StudentAdminResponse,
    UpdateStudentAdminRequest,
    UpdateStudentStatusRequest,
    AssignedTeacherInfo,
    CreateAdminRequest,
    UpdateAdminRequest,
    UpdateAdminStatusRequest,
    AdminUserResponse,
)
from app.core.security import hash_password
from app.core.config import get_settings

settings = get_settings()



async def list_admin_teachers(db: AsyncSession) -> list[TeacherAdminResponse]:
    result = await db.execute(
        select(User)
        .where(User.role == "teacher")
        .order_by(User.created_at.desc())
    )
    teachers = result.scalars().all()

    responses = []
    for t in teachers:
        # Count distinct students associated via Student.teacher_id OR StudentTeacher association
        st_count_res = await db.execute(
            select(func.count(func.distinct(Student.id)))
            .outerjoin(StudentTeacher, StudentTeacher.student_id == Student.id)
            .where(
                or_(
                    Student.teacher_id == t.id,
                    StudentTeacher.teacher_id == t.id,
                )
            )
        )
        student_count = st_count_res.scalar() or 0

        responses.append(
            TeacherAdminResponse(
                id=t.id,
                email=t.email,
                full_name=t.full_name,
                role=t.role,
                is_active=t.is_active,
                created_at=t.created_at.isoformat(),
                student_count=student_count,
            )
        )
    return responses


async def create_teacher_by_admin(
    db: AsyncSession, data: CreateTeacherRequest
) -> TeacherAdminResponse:
    # Check if email already registered
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    # Create user strictly with TEACHER role
    teacher_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role="teacher",
        is_active=True,
    )
    db.add(teacher_user)
    await db.flush()
    await db.refresh(teacher_user)

    return TeacherAdminResponse(
        id=teacher_user.id,
        email=teacher_user.email,
        full_name=teacher_user.full_name,
        role=teacher_user.role,
        is_active=teacher_user.is_active,
        created_at=teacher_user.created_at.isoformat(),
        student_count=0,
    )


async def update_teacher_by_admin(
    db: AsyncSession, teacher_id: str, data: UpdateTeacherAdminRequest
) -> TeacherAdminResponse:
    result = await db.execute(
        select(User).where(User.id == teacher_id, User.role == "teacher")
    )
    teacher = result.scalar_one_or_none()

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher account not found.",
        )

    if data.email is not None and data.email != teacher.email:
        email_check = await db.execute(
            select(User).where(User.email == data.email, User.id != teacher_id)
        )
        if email_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )
        teacher.email = data.email

    if data.full_name is not None:
        teacher.full_name = data.full_name

    if data.is_active is not None:
        teacher.is_active = data.is_active

    db.add(teacher)
    await db.flush()
    await db.refresh(teacher)

    st_count_res = await db.execute(
        select(func.count(func.distinct(Student.id)))
        .outerjoin(StudentTeacher, StudentTeacher.student_id == Student.id)
        .where(
            or_(
                Student.teacher_id == teacher.id,
                StudentTeacher.teacher_id == teacher.id,
            )
        )
    )
    student_count = st_count_res.scalar() or 0

    return TeacherAdminResponse(
        id=teacher.id,
        email=teacher.email,
        full_name=teacher.full_name,
        role=teacher.role,
        is_active=teacher.is_active,
        created_at=teacher.created_at.isoformat(),
        student_count=student_count,
    )


async def update_teacher_status(
    db: AsyncSession, teacher_id: str, data: UpdateTeacherStatusRequest
) -> TeacherAdminResponse:
    return await update_teacher_by_admin(
        db, teacher_id, UpdateTeacherAdminRequest(is_active=data.is_active)
    )


async def delete_teacher_by_admin(db: AsyncSession, teacher_id: str) -> dict:
    result = await db.execute(
        select(User).where(User.id == teacher_id, User.role == "teacher")
    )
    teacher = result.scalar_one_or_none()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher account not found.",
        )

    # 1. Unlink primary teacher_id on students
    st_res = await db.execute(select(Student).where(Student.teacher_id == teacher_id))
    for s in st_res.scalars().all():
        s.teacher_id = None
        db.add(s)

    # 2. Delete student_teachers association rows
    await db.execute(delete(StudentTeacher).where(StudentTeacher.teacher_id == teacher_id))

    # 3. Delete announcements created by this teacher
    await db.execute(delete(Announcement).where(Announcement.teacher_id == teacher_id))

    # 4. Delete syllabus attachments uploaded by this teacher
    await db.execute(delete(SyllabusAttachment).where(SyllabusAttachment.uploaded_by == teacher_id))

    # 5. Delete teacher user
    await db.delete(teacher)
    await db.flush()

    return {
        "message": f"Teacher account '{teacher.full_name}' deleted successfully.",
        "id": teacher_id,
    }



async def admin_reset_user_password(
    db: AsyncSession, user_id: str, new_password: str
) -> dict:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.password_hash = hash_password(new_password)
    user.otp_code = None
    user.otp_expiry = None

    db.add(user)
    await db.flush()

    return {
        "message": f"Password for {user.role} '{user.full_name}' updated successfully.",
        "user_id": user.id,
        "email": user.email,
    }


async def _get_student_assigned_teachers(
    db: AsyncSession, student: Student
) -> list[AssignedTeacherInfo]:
    teachers_dict = {}

    # 1. Check StudentTeacher entries
    st_res = await db.execute(
        select(User)
        .join(StudentTeacher, StudentTeacher.teacher_id == User.id)
        .where(StudentTeacher.student_id == student.id, User.role == "teacher")
    )
    for t in st_res.scalars().all():
        teachers_dict[t.id] = AssignedTeacherInfo(
            id=t.id,
            full_name=t.full_name,
            email=t.email,
            is_active=t.is_active,
        )

    # 2. Check student.teacher_id
    if student.teacher_id and student.teacher_id not in teachers_dict:
        t_res = await db.execute(
            select(User).where(User.id == student.teacher_id, User.role == "teacher")
        )
        t = t_res.scalar_one_or_none()
        if t:
            teachers_dict[t.id] = AssignedTeacherInfo(
                id=t.id,
                full_name=t.full_name,
                email=t.email,
                is_active=t.is_active,
            )

    return list(teachers_dict.values())


async def list_admin_students(
    db: AsyncSession,
    search: str | None = None,
    class_grade: str | None = None,
    board: str | None = None,
    is_active: bool | None = None,
) -> list[StudentAdminResponse]:
    query = select(Student).order_by(Student.created_at.desc())

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Student.name.ilike(term),
                Student.email.ilike(term),
                Student.phone.ilike(term),
                Student.parent_phone.ilike(term),
            )
        )

    if class_grade:
        query = query.where(Student.class_grade == class_grade)

    if board:
        query = query.where(Student.board == board)

    result = await db.execute(query)
    students = result.scalars().all()

    responses = []
    for s in students:
        linked_user = None
        student_active = True
        if s.user_id:
            u_res = await db.execute(select(User).where(User.id == s.user_id))
            linked_user = u_res.scalar_one_or_none()
            if linked_user:
                student_active = linked_user.is_active

        if is_active is not None and student_active != is_active:
            continue

        assigned_teachers = await _get_student_assigned_teachers(db, s)
        teacher_name = assigned_teachers[0].full_name if assigned_teachers else None

        responses.append(
            StudentAdminResponse(
                id=s.id,
                user_id=s.user_id,
                email=s.email,
                name=s.name,
                phone=s.phone,
                parent_phone=s.parent_phone,
                class_grade=s.class_grade,
                board=s.board,
                notes=s.notes,
                is_active=student_active,
                teacher_id=s.teacher_id,
                teacher_name=teacher_name,
                assigned_teachers=assigned_teachers,
                created_at=s.created_at.isoformat(),
            )
        )

    return responses


async def update_student_by_admin(
    db: AsyncSession, student_id: str, data: UpdateStudentAdminRequest
) -> StudentAdminResponse:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    if data.name is not None:
        student.name = data.name
    if data.phone is not None:
        student.phone = data.phone
    if data.parent_phone is not None:
        student.parent_phone = data.parent_phone
    if data.class_grade is not None:
        student.class_grade = data.class_grade
    if data.board is not None:
        student.board = data.board
    if data.notes is not None:
        student.notes = data.notes

    if data.email is not None and data.email != student.email:
        student.email = data.email

    # Linked User account update
    if student.user_id:
        u_res = await db.execute(select(User).where(User.id == student.user_id))
        user = u_res.scalar_one_or_none()
        if user:
            if data.name is not None:
                user.full_name = data.name
            if data.email is not None and data.email != user.email:
                email_check = await db.execute(
                    select(User).where(
                        User.email == data.email, User.id != user.id
                    )
                )
                if email_check.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="A user account with this email address already exists.",
                    )
                user.email = data.email
            if data.is_active is not None:
                user.is_active = data.is_active
            db.add(user)

    db.add(student)
    await db.flush()
    await db.refresh(student)

    assigned_teachers = await _get_student_assigned_teachers(db, student)
    teacher_name = assigned_teachers[0].full_name if assigned_teachers else None
    student_active = True
    if student.user_id:
        u_res = await db.execute(select(User).where(User.id == student.user_id))
        u = u_res.scalar_one_or_none()
        if u:
            student_active = u.is_active

    return StudentAdminResponse(
        id=student.id,
        user_id=student.user_id,
        email=student.email,
        name=student.name,
        phone=student.phone,
        parent_phone=student.parent_phone,
        class_grade=student.class_grade,
        board=student.board,
        notes=student.notes,
        is_active=student_active,
        teacher_id=student.teacher_id,
        teacher_name=teacher_name,
        assigned_teachers=assigned_teachers,
        created_at=student.created_at.isoformat(),
    )


async def update_student_status(
    db: AsyncSession, student_id: str, data: UpdateStudentStatusRequest
) -> StudentAdminResponse:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    if student.user_id:
        u_res = await db.execute(select(User).where(User.id == student.user_id))
        user = u_res.scalar_one_or_none()
        if user:
            user.is_active = data.is_active
            db.add(user)
            await db.flush()
    elif data.is_active and student.email:
        # Create a linked user account if student has an email and is being activated
        u_res = await db.execute(
            select(User).where(User.email == student.email, User.role == "student")
        )
        existing_user = u_res.scalar_one_or_none()
        if existing_user:
            existing_user.is_active = True
            student.user_id = existing_user.id
            db.add(existing_user)
        else:
            new_user = User(
                email=student.email,
                password_hash=hash_password("studyverse123"),
                full_name=student.name,
                role="student",
                is_active=True,
            )
            db.add(new_user)
            await db.flush()
            student.user_id = new_user.id

        db.add(student)
        await db.flush()

    return await update_student_by_admin(
        db, student_id, UpdateStudentAdminRequest(is_active=data.is_active)
    )


async def delete_student_by_admin(db: AsyncSession, student_id: str) -> dict:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    user_id = student.user_id

    # Clean up all child table records for student
    await db.execute(delete(StudentTeacher).where(StudentTeacher.student_id == student_id))
    await db.execute(delete(Attendance).where(Attendance.student_id == student_id))
    await db.execute(delete(DailyPlan).where(DailyPlan.student_id == student_id))
    await db.execute(delete(CalendarEvent).where(CalendarEvent.student_id == student_id))
    await db.execute(delete(FeeRecord).where(FeeRecord.student_id == student_id))
    await db.execute(delete(Homework).where(Homework.student_id == student_id))
    await db.execute(delete(Syllabus).where(Syllabus.student_id == student_id))
    await db.execute(delete(Test).where(Test.student_id == student_id))
    await db.execute(delete(SyllabusDocument).where(SyllabusDocument.student_id == student_id))
    await db.execute(delete(Recommendation).where(Recommendation.student_id == student_id))
    await db.execute(delete(AIPlan).where(AIPlan.student_id == student_id))

    # Delete Student record
    await db.delete(student)
    await db.flush()

    # If linked user exists, delete User record
    if user_id:
        u_res = await db.execute(select(User).where(User.id == user_id))
        user = u_res.scalar_one_or_none()
        if user:
            await db.delete(user)
            await db.flush()

    return {
        "message": f"Student '{student.name}' deleted successfully.",
        "id": student_id,
    }



async def admin_reset_student_password(
    db: AsyncSession, student_id: str, new_password: str
) -> dict:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    if student.user_id:
        u_res = await db.execute(select(User).where(User.id == student.user_id))
        user = u_res.scalar_one_or_none()
        if user:
            user.password_hash = hash_password(new_password)
            user.otp_code = None
            user.otp_expiry = None
            db.add(user)
            await db.flush()
            return {"message": f"Password reset successfully for {student.name}."}

    # Create linked user account if not exists
    student_email = student.email or f"student_{student.id[:8]}@studyverse.com"
    u_res = await db.execute(select(User).where(User.email == student_email))
    existing_user = u_res.scalar_one_or_none()

    if existing_user:
        existing_user.password_hash = hash_password(new_password)
        existing_user.otp_code = None
        existing_user.otp_expiry = None
        student.user_id = existing_user.id
        db.add(existing_user)
    else:
        new_user = User(
            email=student_email,
            password_hash=hash_password(new_password),
            full_name=student.name,
            role="student",
            is_active=True,
        )
        db.add(new_user)
        await db.flush()
        student.user_id = new_user.id
        if not student.email:
            student.email = student_email

    db.add(student)
    await db.flush()
    return {"message": f"User account created and password reset successfully for {student.name}."}


async def get_student_teachers(
    db: AsyncSession, student_id: str
) -> list[AssignedTeacherInfo]:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    return await _get_student_assigned_teachers(db, student)


async def add_teacher_to_student(
    db: AsyncSession, student_id: str, teacher_id: str
) -> list[AssignedTeacherInfo]:
    st_res = await db.execute(select(Student).where(Student.id == student_id))
    student = st_res.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    t_res = await db.execute(
        select(User).where(User.id == teacher_id, User.role == "teacher")
    )
    teacher = t_res.scalar_one_or_none()

    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher account not found.",
        )

    # Check if already assigned in StudentTeacher
    assoc_check = await db.execute(
        select(StudentTeacher).where(
            StudentTeacher.student_id == student_id,
            StudentTeacher.teacher_id == teacher_id,
        )
    )
    if not assoc_check.scalar_one_or_none():
        new_assoc = StudentTeacher(student_id=student_id, teacher_id=teacher_id)
        db.add(new_assoc)

    if not student.teacher_id:
        student.teacher_id = teacher_id
        db.add(student)

    await db.flush()
    return await _get_student_assigned_teachers(db, student)


async def remove_teacher_from_student(
    db: AsyncSession, student_id: str, teacher_id: str
) -> list[AssignedTeacherInfo]:
    st_res = await db.execute(select(Student).where(Student.id == student_id))
    student = st_res.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found.",
        )

    assoc_res = await db.execute(
        select(StudentTeacher).where(
            StudentTeacher.student_id == student_id,
            StudentTeacher.teacher_id == teacher_id,
        )
    )
    assoc = assoc_res.scalar_one_or_none()
    if assoc:
        await db.delete(assoc)

    await db.flush()

    remaining_teachers = await _get_student_assigned_teachers(db, student)
    if student.teacher_id == teacher_id:
        if remaining_teachers:
            student.teacher_id = remaining_teachers[0].id
            db.add(student)
            await db.flush()

    return remaining_teachers


# ─── ADMINISTRATOR MANAGEMENT (SUPER ADMIN) ───────────

async def list_admin_users(db: AsyncSession) -> list[AdminUserResponse]:
    """List all administrator accounts in the system."""
    result = await db.execute(
        select(User)
        .where(User.role == "admin")
        .order_by(User.created_at.asc())
    )
    admins = result.scalars().all()
    super_email = settings.SUPER_ADMIN_EMAIL.lower()

    return [
        AdminUserResponse(
            id=admin.id,
            email=admin.email,
            full_name=admin.full_name,
            role=admin.role,
            is_active=admin.is_active,
            is_super_admin=(admin.email.lower() == super_email),
            created_at=admin.created_at.isoformat() if admin.created_at else "",
        )
        for admin in admins
    ]


async def create_admin_by_super_admin(
    db: AsyncSession, data: CreateAdminRequest
) -> AdminUserResponse:
    """Create a new administrator account (Super Admin only)."""
    clean_email = data.email.lower().strip()

    existing = await db.execute(select(User).where(User.email == clean_email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user account with this email address already exists.",
        )

    new_admin = User(
        email=clean_email,
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        role="admin",
        is_active=True,
    )
    db.add(new_admin)
    await db.flush()
    await db.refresh(new_admin)

    super_email = settings.SUPER_ADMIN_EMAIL.lower()
    return AdminUserResponse(
        id=new_admin.id,
        email=new_admin.email,
        full_name=new_admin.full_name,
        role=new_admin.role,
        is_active=new_admin.is_active,
        is_super_admin=(new_admin.email.lower() == super_email),
        created_at=new_admin.created_at.isoformat() if new_admin.created_at else "",
    )


async def update_admin_by_super_admin(
    db: AsyncSession, admin_id: str, data: UpdateAdminRequest
) -> AdminUserResponse:
    """Update administrator account details or status (Super Admin only)."""
    result = await db.execute(select(User).where(User.id == admin_id, User.role == "admin"))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Administrator account not found.",
        )

    super_email = settings.SUPER_ADMIN_EMAIL.lower()
    is_target_super_admin = (admin.email.lower() == super_email)

    if is_target_super_admin and data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary Super Admin account cannot be deactivated.",
        )

    if data.email is not None:
        clean_email = data.email.lower().strip()
        if clean_email != admin.email.lower():
            if is_target_super_admin:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Primary Super Admin email address cannot be modified.",
                )
            # Check uniqueness
            dup_res = await db.execute(
                select(User).where(User.email == clean_email, User.id != admin.id)
            )
            if dup_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A user account with this email address already exists.",
                )
            admin.email = clean_email

    if data.full_name is not None:
        admin.full_name = data.full_name.strip()

    if data.is_active is not None:
        admin.is_active = data.is_active

    db.add(admin)
    await db.flush()
    await db.refresh(admin)

    return AdminUserResponse(
        id=admin.id,
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role,
        is_active=admin.is_active,
        is_super_admin=(admin.email.lower() == super_email),
        created_at=admin.created_at.isoformat() if admin.created_at else "",
    )


async def delete_admin_by_super_admin(
    db: AsyncSession, admin_id: str, current_admin: User
) -> dict:
    """Permanently delete an administrator account (Super Admin only)."""
    result = await db.execute(select(User).where(User.id == admin_id, User.role == "admin"))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Administrator account not found.",
        )

    super_email = settings.SUPER_ADMIN_EMAIL.lower()
    if admin.email.lower() == super_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primary Super Admin account cannot be deleted.",
        )

    if admin.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account.",
        )

    admin_name = admin.full_name
    admin_email = admin.email
    await db.delete(admin)
    await db.flush()

    return {
        "message": f"Administrator '{admin_name}' ({admin_email}) deleted successfully.",
        "id": admin_id,
    }


async def reset_admin_password_by_super_admin(
    db: AsyncSession, admin_id: str, new_password: str
) -> dict:
    """Reset password for an administrator account (Super Admin only)."""
    result = await db.execute(select(User).where(User.id == admin_id, User.role == "admin"))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Administrator account not found.",
        )

    admin.password_hash = hash_password(new_password)
    admin.otp_code = None
    admin.otp_expiry = None
    db.add(admin)
    await db.flush()

    return {"message": f"Password reset successfully for administrator {admin.full_name}."}



