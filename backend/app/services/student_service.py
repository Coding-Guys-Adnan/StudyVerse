from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from fastapi import HTTPException, status
from app.models.student import Student
from app.models.user import User
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentListResponse,
    DashboardStats,
)


def _student_to_response(student: Student) -> StudentResponse:
    return StudentResponse(
        id=student.id,
        teacher_id=student.teacher_id,
        name=student.name,
        email=student.email,
        phone=student.phone,
        parent_phone=student.parent_phone,
        class_grade=student.class_grade,
        board=student.board,
        date_of_birth=student.date_of_birth,
        notes=student.notes,
        avatar_url=student.avatar_url,
        monthly_fees=student.monthly_fees,
        fee_due_day=student.fee_due_day,
        created_at=student.created_at.isoformat(),
    )


async def list_students(
    db: AsyncSession,
    teacher: User,
    search: str | None = None,
    class_grade: str | None = None,
) -> StudentListResponse:
    query = select(Student).where(Student.teacher_id == teacher.id)

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Student.name.ilike(term),
                Student.email.ilike(term),
                Student.class_grade.ilike(term),
            )
        )

    if class_grade:
        query = query.where(Student.class_grade == class_grade)

    query = query.order_by(Student.name.asc())

    result = await db.execute(query)
    students = result.scalars().all()

    return StudentListResponse(
        students=[_student_to_response(s) for s in students],
        total=len(students),
    )


async def create_student(
    db: AsyncSession, teacher: User, data: StudentCreate
) -> StudentResponse:
    if data.email:
        # Check if student with this email already exists under this teacher
        existing_student = await db.execute(
            select(Student).where(
                Student.email == data.email,
                Student.teacher_id == teacher.id
            )
        )
        if existing_student.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with this email already exists under your account.",
            )

    # Check if a User with this email exists as a student to link them, or create one
    user_id = None
    if data.email:
        user_result = await db.execute(
            select(User).where(User.email == data.email, User.role == "student")
        )
        user = user_result.scalar_one_or_none()
        if user:
            user_id = user.id
        else:
            from app.core.security import hash_password
            temp_password = "studyverse123"
            new_user = User(
                email=data.email,
                password_hash=hash_password(temp_password),
                full_name=data.name,
                role="student",
            )
            db.add(new_user)
            await db.flush()
            user_id = new_user.id

    student = Student(
        teacher_id=teacher.id,
        user_id=user_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        parent_phone=data.parent_phone,
        class_grade=data.class_grade,
        board=data.board,
        date_of_birth=data.date_of_birth,
        notes=data.notes,
        monthly_fees=data.monthly_fees,
        fee_due_day=data.fee_due_day,
    )
    db.add(student)
    await db.flush()
    await db.refresh(student)

    # Automatically create student_teacher association with default permissions
    from app.services.permission_service import get_or_create_student_teacher
    await get_or_create_student_teacher(db, student.id, teacher.id)

    return _student_to_response(student)


async def get_student(
    db: AsyncSession, teacher: User, student_id: str
) -> StudentResponse:
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.teacher_id == teacher.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )
    return _student_to_response(student)


async def update_student(
    db: AsyncSession, teacher: User, student_id: str, data: StudentUpdate
) -> StudentResponse:
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.teacher_id == teacher.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data:
        new_email = update_data["email"]
        if new_email != student.email:
            if new_email:
                # Check for duplicate student email under the same teacher
                existing_student = await db.execute(
                    select(Student).where(
                        Student.email == new_email,
                        Student.teacher_id == teacher.id,
                        Student.id != student_id
                    )
                )
                if existing_student.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="A student with this email already exists under your account.",
                    )
                
                # Check if a User exists with this email and role = student, or create one
                user_result = await db.execute(
                    select(User).where(User.email == new_email, User.role == "student")
                )
                user = user_result.scalar_one_or_none()
                if user:
                    student.user_id = user.id
                else:
                    from app.core.security import hash_password
                    temp_password = "studyverse123"
                    new_user = User(
                        email=new_email,
                        password_hash=hash_password(temp_password),
                        full_name=student.name,
                        role="student",
                    )
                    db.add(new_user)
                    await db.flush()
                    student.user_id = new_user.id
            else:
                student.user_id = None

    for field, value in update_data.items():
        setattr(student, field, value)

    await db.flush()
    await db.refresh(student)
    return _student_to_response(student)


async def delete_student(
    db: AsyncSession, teacher: User, student_id: str
) -> dict:
    result = await db.execute(
        select(Student).where(
            Student.id == student_id,
            Student.teacher_id == teacher.id,
        )
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    await db.delete(student)
    await db.flush()
    return {"message": "Student deleted successfully"}


async def get_dashboard_stats(db: AsyncSession, teacher: User) -> DashboardStats:
    # Student count
    result = await db.execute(
        select(func.count(Student.id)).where(Student.teacher_id == teacher.id)
    )
    total_students = result.scalar() or 0

    # Placeholder stats for now — real values come in later phases
    return DashboardStats(
        total_students=total_students,
        today_classes=0,
        homework_pending=0,
        ai_plans_generated=0,
    )
