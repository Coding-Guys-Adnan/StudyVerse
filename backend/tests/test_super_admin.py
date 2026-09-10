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

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User

# In-memory SQLite DB
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


async def create_user(role: str, email: str, name: str) -> User:
    async with async_session_factory() as db:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=hash_password("password123"),
            full_name=name,
            role=role,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


def auth_headers(user: User) -> dict:
    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_super_admin_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create super admin and secondary admin
        super_admin = await create_user("admin", "admin@studyverse.com", "Primary Super Admin")
        secondary_admin = await create_user("admin", "secadmin@studyverse.com", "Secondary Admin")
        teacher = await create_user("teacher", "teacher@studyverse.com", "Teacher One")

        # 1. Super Admin lists admins
        resp = await client.get("/api/v1/admin/admins", headers=auth_headers(super_admin))
        assert resp.status_code == 200, resp.text
        admins_data = resp.json()
        assert len(admins_data) == 2
        super_entry = next(a for a in admins_data if a["email"] == "admin@studyverse.com")
        assert super_entry["is_super_admin"] is True
        sec_entry = next(a for a in admins_data if a["email"] == "secadmin@studyverse.com")
        assert sec_entry["is_super_admin"] is False

        # 2. Secondary Admin cannot access /admin/admins (403 Forbidden)
        resp = await client.get("/api/v1/admin/admins", headers=auth_headers(secondary_admin))
        assert resp.status_code == 403

        # Teacher cannot access (403 Forbidden)
        resp = await client.get("/api/v1/admin/admins", headers=auth_headers(teacher))
        assert resp.status_code == 403

        # 3. Super Admin creates a new admin
        create_payload = {
            "email": "newadmin@studyverse.com",
            "password": "Password123!",
            "full_name": "New Admin User",
        }
        resp = await client.post(
            "/api/v1/admin/admins",
            json=create_payload,
            headers=auth_headers(super_admin),
        )
        assert resp.status_code == 201, resp.text
        new_admin = resp.json()
        assert new_admin["email"] == "newadmin@studyverse.com"
        assert new_admin["full_name"] == "New Admin User"
        assert new_admin["is_super_admin"] is False
        new_admin_id = new_admin["id"]

        # Secondary admin cannot create an admin
        resp = await client.post(
            "/api/v1/admin/admins",
            json={"email": "bad@studyverse.com", "password": "123", "full_name": "Bad"},
            headers=auth_headers(secondary_admin),
        )
        assert resp.status_code == 403

        # 4. Super Admin updates secondary admin
        update_payload = {"full_name": "Updated Admin", "is_active": False}
        resp = await client.put(
            f"/api/v1/admin/admins/{new_admin_id}",
            json=update_payload,
            headers=auth_headers(super_admin),
        )
        assert resp.status_code == 200, resp.text
        updated = resp.json()
        assert updated["full_name"] == "Updated Admin"
        assert updated["is_active"] is False

        # 5. Super Admin resets secondary admin's password
        reset_payload = {"new_password": "newSecurePassword123"}
        resp = await client.post(
            f"/api/v1/admin/admins/{new_admin_id}/reset-password",
            json=reset_payload,
            headers=auth_headers(super_admin),
        )
        assert resp.status_code == 200, resp.text

        # 6. Guardrail: Super admin cannot deactivate admin@studyverse.com
        resp = await client.put(
            f"/api/v1/admin/admins/{super_admin.id}",
            json={"is_active": False},
            headers=auth_headers(super_admin),
        )
        assert resp.status_code == 400
        assert "cannot be deactivated" in resp.text

        # 7. Guardrail: Super admin cannot delete admin@studyverse.com
        resp = await client.delete(
            f"/api/v1/admin/admins/{super_admin.id}",
            headers=auth_headers(super_admin),
        )
        assert resp.status_code == 400
        assert "cannot be deleted" in resp.text

        # 8. Super Admin can delete secondary admin
        resp = await client.delete(
            f"/api/v1/admin/admins/{new_admin_id}",
            headers=auth_headers(super_admin),
        )
        assert resp.status_code == 200, resp.text

        # Verify deletion
        resp = await client.get("/api/v1/admin/admins", headers=auth_headers(super_admin))
        assert resp.status_code == 200
        remaining_emails = [a["email"] for a in resp.json()]
        assert "newadmin@studyverse.com" not in remaining_emails
