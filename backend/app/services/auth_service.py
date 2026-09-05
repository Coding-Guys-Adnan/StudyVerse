import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest
)
from app.core.security import hash_password, verify_password, create_access_token
from app.services.mail_service import send_otp_email


async def register_user(db: AsyncSession, data: RegisterRequest) -> UserResponse:
    # Rule 4: Must select at least one teacher
    if not data.teacher_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must select at least one active teacher to register.",
        )

    # Remove duplicates preserving order
    unique_teacher_ids = list(dict.fromkeys(data.teacher_ids))

    # Rule 5, 6, 7: Server-side validation of every selected teacher ID
    teachers_result = await db.execute(
        select(User).where(
            User.id.in_(unique_teacher_ids),
            User.role == "teacher",
            User.is_active == True,
        )
    )
    valid_teachers = teachers_result.scalars().all()
    valid_teacher_map = {t.id: t for t in valid_teachers}

    if len(valid_teachers) != len(unique_teacher_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more selected teachers are invalid, inactive, or unavailable.",
        )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Rule 1: Public registration creates STUDENT account
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role="student",
    )

    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Link or create Student record
    from app.models.student import Student
    from app.models.student_teacher import StudentTeacher

    student_result = await db.execute(
        select(Student).where(Student.email == user.email)
    )
    student = student_result.scalar_one_or_none()
    
    # Rule 8: Primary teacher_id stored as first selected teacher
    primary_teacher_id = unique_teacher_ids[0]

    if student:
        student.user_id = user.id
        student.teacher_id = primary_teacher_id
    else:
        student = Student(
            teacher_id=primary_teacher_id,
            user_id=user.id,
            name=user.full_name,
            email=user.email,
        )
        db.add(student)
    
    await db.flush()
    await db.refresh(student)

    # Rule 9 & 10: Store all selected teachers in student_teachers junction table without duplicates
    for tid in unique_teacher_ids:
        st_exists = await db.execute(
            select(StudentTeacher).where(
                StudentTeacher.student_id == student.id,
                StudentTeacher.teacher_id == tid,
            )
        )
        if not st_exists.scalar_one_or_none():
            db.add(StudentTeacher(student_id=student.id, teacher_id=tid))

    await db.flush()

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )


async def login_user(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        data={"sub": user.id, "role": user.role}
    )

    return TokenResponse(access_token=access_token)


async def get_user_profile(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        created_at=user.created_at.isoformat(),
    )


async def request_password_reset(db: AsyncSession, data: ForgotPasswordRequest):
    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user:
        # Generate 6-digit numeric OTP
        otp_code = f"{random.randint(100000, 999999):06d}"
        user.otp_code = otp_code
        user.otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        db.add(user)
        await db.flush()
        await db.commit()

        # Send email asynchronously
        await send_otp_email(user.email, otp_code)
    
    return {"message": "If the email is registered, a password reset OTP has been sent."}


async def reset_password(db: AsyncSession, data: ResetPasswordRequest):
    # Find user by email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.otp_code or user.otp_code != data.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    # Check expiry
    otp_expiry = user.otp_expiry
    if otp_expiry is not None and otp_expiry.tzinfo is None:
        otp_expiry = otp_expiry.replace(tzinfo=timezone.utc)

    current_time = datetime.now(timezone.utc)
    if otp_expiry is None or otp_expiry < current_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP",
        )

    # Reset password
    user.password_hash = hash_password(data.new_password)
    user.otp_code = None
    user.otp_expiry = None

    db.add(user)
    await db.flush()
    await db.commit()

    return {"message": "Password reset successfully"}
