import asyncio
from app.core.database import async_session_maker
from app.models.user import User
from app.core.security import hash_password
from sqlalchemy import select

async def seed():
    async with async_session_maker() as db:
        # Teacher
        teacher_email = "mdadnanparwez74@gmail.com"
        result = await db.execute(select(User).where(User.email == teacher_email))
        existing_teacher = result.scalar_one_or_none()
        if not existing_teacher:
            teacher = User(
                email=teacher_email,
                password_hash=hash_password("9874184220"),
                full_name="Adnan Parwez",
                role="teacher"
            )
            db.add(teacher)
            print("Teacher created!")
        else:
            print("Teacher already exists!")

        # Student
        student_email = "khxnadnan55@gmail.com"
        result = await db.execute(select(User).where(User.email == student_email))
        existing_student = result.scalar_one_or_none()
        if not existing_student:
            student = User(
                email=student_email,
                password_hash=hash_password("987654321"),
                full_name="Jesse Pinkman (Student)",
                role="student"
            )
            db.add(student)
            print("Student created!")
        # Super Admin
        admin_email = "admin@studyverse.com"
        result = await db.execute(select(User).where(User.email == admin_email))
        existing_admin = result.scalar_one_or_none()
        if not existing_admin:
            admin = User(
                email=admin_email,
                password_hash=hash_password("admin123"),
                full_name="Primary Super Admin",
                role="admin",
                is_active=True,
            )
            db.add(admin)
            print("Super Admin created!")
        else:
            print("Super Admin already exists!")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(seed())
