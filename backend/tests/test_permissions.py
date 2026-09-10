import pytest
import uuid
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.models.student import Student
from app.models.student_teacher import StudentTeacher
from app.schemas.student_teacher import (
    StudentPermissions,
    StudentPermissionsUpdate,
)
from app.services.permission_service import (
    DEFAULT_PERMISSIONS,
    get_or_create_student_teacher,
    get_student_effective_permissions,
    check_student_permission,
)

# Test in-memory SQLite database
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
async_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with async_session_factory() as session:
        yield session


@pytest.fixture(autouse=True)
async def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.pop(get_db, None)


async def create_user(role: str, email: str, name: str) -> User:
    async with async_session_factory() as db:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            full_name=name,
            password_hash=hash_password("password123"),
            role=role,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def create_student(user: User, teacher: User) -> Student:
    async with async_session_factory() as db:
        student = Student(
            id=str(uuid.uuid4()),
            user_id=user.id,
            teacher_id=teacher.id,
            name=user.full_name,
            class_grade="10th",
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)
        return student


def auth_headers(user: User) -> dict:
    token = create_access_token(data={"sub": user.id, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_1_default_permissions_read_only():
    """Scenario 1: Default permissions on new student-teacher link are read-only."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    async with async_session_factory() as db:
        st = await get_or_create_student_teacher(db, student.id, teacher.id)
        assert st.permissions is not None
        perms = StudentPermissions.model_validate(st.permissions)
        assert perms.homework.can_edit is False
        assert perms.homework.can_import is False
        assert perms.syllabus.can_edit is False
        assert perms.syllabus.can_import is False
        assert perms.calendar.can_edit is False
        assert perms.tests.can_edit is False
        assert perms.files.can_import is False


@pytest.mark.asyncio
async def test_2_teacher_update_permissions_success():
    """Scenario 2: Teacher A can update permissions for their linked Student S1."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        update_payload = {
            "permissions": {
                "homework": {"can_edit": True, "can_import": False},
                "syllabus": {"can_edit": True, "can_import": True},
            }
        }
        res = await ac.put(
            f"/api/v1/students/{student.id}/permissions",
            json=update_payload,
            headers=auth_headers(teacher),
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["permissions"]["homework"]["can_edit"] is True
        assert data["permissions"]["syllabus"]["can_edit"] is True
        assert data["permissions"]["syllabus"]["can_import"] is True
        assert data["permissions"]["calendar"]["can_edit"] is False


@pytest.mark.asyncio
async def test_3_unlinked_teacher_cannot_update_permissions():
    """Scenario 3: Teacher B (not linked to S1) receives 404/403."""
    teacher_a = await create_user("teacher", "ta@example.com", "Teacher A")
    teacher_b = await create_user("teacher", "tb@example.com", "Teacher B")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher_a)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/v1/students/{student.id}/permissions",
            json={"permissions": {"homework": {"can_edit": True, "can_import": False}}},
            headers=auth_headers(teacher_b),
        )
        assert res.status_code in (403, 404), res.text


@pytest.mark.asyncio
async def test_4_student_cannot_call_update_permissions():
    """Scenario 4: Student S1 cannot call PUT /api/v1/students/{id}/permissions (403)."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/v1/students/{student.id}/permissions",
            json={"permissions": {"homework": {"can_edit": True, "can_import": False}}},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_5_student_cannot_call_get_permissions():
    """Scenario 5: Student S1 cannot call GET /api/v1/students/{id}/permissions (403)."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            f"/api/v1/students/{student.id}/permissions",
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_6_multi_teacher_effective_permissions_logical_or():
    """Scenario 6: Multi-teacher effective permissions (logical OR)."""
    teacher_a = await create_user("teacher", "ta@example.com", "Teacher A")
    teacher_b = await create_user("teacher", "tb@example.com", "Teacher B")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher_a)

    async with async_session_factory() as db:
        st_a = await get_or_create_student_teacher(db, student.id, teacher_a.id)
        st_a.permissions = {"homework": {"can_edit": True, "can_import": False}}
        st_b = await get_or_create_student_teacher(db, student.id, teacher_b.id)
        st_b.permissions = {"syllabus": {"can_edit": True, "can_import": False}}
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/api/v1/portal/permissions",
            headers=auth_headers(s_user),
        )
        assert res.status_code == 200, res.text
        effective = res.json()["effective_permissions"]
        assert effective["homework"]["can_edit"] is True
        assert effective["syllabus"]["can_edit"] is True
        assert effective["tests"]["can_edit"] is False
        assert effective["calendar"]["can_edit"] is False


@pytest.mark.asyncio
async def test_7_portal_homework_blocked_when_no_permission():
    """Scenario 7: Student with homework.can_edit=False calling POST /portal/homework gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/homework",
            json={"title": "Unauthorized Task", "subject": "Math"},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text
        assert "Permission denied" in res.json()["detail"]


@pytest.mark.asyncio
async def test_8_portal_homework_allowed_when_permitted():
    """Scenario 8: Student with homework.can_edit=True calling POST /portal/homework gets 201."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    async with async_session_factory() as db:
        st = await get_or_create_student_teacher(db, student.id, teacher.id)
        st.permissions = {"homework": {"can_edit": True, "can_import": False}}
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/homework",
            json={"title": "Authorized Task", "subject": "Math"},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 201, res.text
        assert res.json()["title"] == "Authorized Task"


@pytest.mark.asyncio
async def test_9_portal_syllabus_blocked_when_no_permission():
    """Scenario 9: Student with syllabus.can_edit=False calling POST /portal/syllabus gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/syllabus",
            json={"subject": "Science", "chapter": "Physics 1"},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_10_portal_syllabus_import_blocked():
    """Scenario 10: Student with syllabus.can_import=False calling POST /portal/syllabus/import gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/syllabus/import",
            json=[{"subject": "Science", "chapter": "Physics 1"}],
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_11_portal_tests_blocked():
    """Scenario 11: Student with tests.can_edit=False calling POST /portal/tests gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/tests",
            json={
                "subject": "Math",
                "exam_name": "Unit Test 1",
                "exam_type": "school",
                "max_marks": 100,
                "obtained_marks": 90,
            },
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_12_portal_tests_upload_blocked():
    """Scenario 12: Student with tests.can_import=False calling POST /portal/tests/upload gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/tests/upload",
            files={"file": ("test.pdf", b"%PDF-dummy", "application/pdf")},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_13_portal_calendar_blocked():
    """Scenario 13: Student with calendar.can_edit=False calling POST /portal/calendar/events gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/calendar/events",
            json={"event_date": "2026-09-15", "title": "Math Quiz"},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_14_portal_files_upload_blocked():
    """Scenario 14: Student with files.can_import=False calling POST /portal/files/upload gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/files/upload",
            files={"file": ("notes.pdf", b"%PDF-dummy", "application/pdf")},
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_15_strict_pydantic_extra_forbid():
    """Scenario 15: Sending extra/unknown fields to PUT /api/v1/students/{id}/permissions returns 422."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/v1/students/{student.id}/permissions",
            json={"permissions": {"invalid_module": {"can_edit": True}}},
            headers=auth_headers(teacher),
        )
        assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_16_calendar_can_import_rejected():
    """Scenario 16: Sending can_import: True on calendar returns 422 (unsupported action)."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/v1/students/{student.id}/permissions",
            json={"permissions": {"calendar": {"can_edit": True, "can_import": True}}},
            headers=auth_headers(teacher),
        )
        assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_17_files_can_edit_rejected():
    """Scenario 17: Sending can_edit: True on files returns 422 (unsupported action)."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.put(
            f"/api/v1/students/{student.id}/permissions",
            json={"permissions": {"files": {"can_edit": True, "can_import": True}}},
            headers=auth_headers(teacher),
        )
        assert res.status_code == 422, res.text


@pytest.mark.asyncio
async def test_18_portal_syllabus_bulk_blocked_when_no_permission():
    """Scenario 18: Student with syllabus.can_edit=False calling POST /portal/syllabus/bulk gets 403."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    await create_student(s_user, teacher)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/syllabus/bulk",
            json=[
                {"subject": "Science", "chapter": "Physics 1"},
                {"subject": "Science", "chapter": "Physics 2"},
            ],
            headers=auth_headers(s_user),
        )
        assert res.status_code == 403, res.text


@pytest.mark.asyncio
async def test_19_portal_syllabus_bulk_allowed_when_permitted():
    """Scenario 19: Student with syllabus.can_edit=True calling POST /portal/syllabus/bulk gets 201."""
    teacher = await create_user("teacher", "t1@example.com", "Teacher One")
    s_user = await create_user("student", "s1@example.com", "Student One")
    student = await create_student(s_user, teacher)

    async with async_session_factory() as db:
        st = await get_or_create_student_teacher(db, student.id, teacher.id)
        st.permissions = {"syllabus": {"can_edit": True, "can_import": False}}
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/portal/syllabus/bulk",
            json=[
                {"subject": "Mathematics", "chapter": "Real Numbers", "chapter_type": "chapter", "term": "SEM1"},
                {"subject": "Mathematics", "chapter": "Polynomials", "chapter_type": "chapter", "term": "SEM1"},
            ],
            headers=auth_headers(s_user),
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert len(data) == 2
        assert data[0]["chapter"] == "Real Numbers"
        assert data[1]["chapter"] == "Polynomials"

