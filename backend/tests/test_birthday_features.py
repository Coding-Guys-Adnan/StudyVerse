import pytest
import uuid
import sys
from datetime import date, datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.models.student import Student
from app.models.academic import Announcement
from app.services.announcement_service import check_and_create_birthday_announcements

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
async_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest.fixture(autouse=True)
async def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_birthday_auto_announcements_and_calendar():
    today = datetime.now(timezone.utc).date()

    async with async_session_factory() as db:
        # Create teacher
        teacher = User(
            id=str(uuid.uuid4()),
            email="teacher@studyverse.test",
            password_hash=hash_password("password123"),
            full_name="Teacher Smith",
            role="teacher",
            is_active=True,
        )
        db.add(teacher)

        # Create student 1 (birthday today)
        user_s1 = User(
            id=str(uuid.uuid4()),
            email="s1@studyverse.test",
            password_hash=hash_password("password123"),
            full_name="Alice Wonder",
            role="student",
            is_active=True,
        )
        db.add(user_s1)

        # Create student 2 (classmate)
        user_s2 = User(
            id=str(uuid.uuid4()),
            email="s2@studyverse.test",
            password_hash=hash_password("password123"),
            full_name="Bob Builder",
            role="student",
            is_active=True,
        )
        db.add(user_s2)

        student_1 = Student(
            id=str(uuid.uuid4()),
            teacher_id=teacher.id,
            user_id=user_s1.id,
            name="Alice Wonder",
            date_of_birth=date(2010, today.month, today.day),
        )
        db.add(student_1)

        student_2 = Student(
            id=str(uuid.uuid4()),
            teacher_id=teacher.id,
            user_id=user_s2.id,
            name="Bob Builder",
            date_of_birth=date(2011, today.month, (today.day % 28) + 1),
        )
        db.add(student_2)
        await db.commit()

        # 1. Test check_and_create_birthday_announcements creates announcement
        created = await check_and_create_birthday_announcements(db)
        assert len(created) == 1
        assert "Alice Wonder" in created[0].title

        # 2. Test idempotency (calling again should not duplicate)
        created_again = await check_and_create_birthday_announcements(db)
        assert len(created_again) == 0

    # 3. Test Student 2 (Bob) can see Alice's birthday in their calendar!
    token_s2 = create_access_token({"sub": user_s2.id, "email": user_s2.email, "role": "student"})
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            f"/api/v1/portal/calendar?year={today.year}&month={today.month}",
            headers={"Authorization": f"Bearer {token_s2}"},
        )
        assert res.status_code == 200
        cal_data = res.json()
        today_key = today.isoformat()
        day_info = cal_data["days"].get(today_key)
        assert day_info is not None

        # Alice's birthday event should appear in Bob's calendar events for today
        event_titles = [e["title"] for e in day_info["events"]]
        assert any("Alice Wonder's Birthday" in t for t in event_titles)
