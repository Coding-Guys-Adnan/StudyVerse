from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest
)
from app.services.auth_service import (
    register_user, login_user, get_user_profile,
    request_password_reset, reset_password
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new teacher or student account."""
    return await register_user(db, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and receive a JWT access token."""
    return await login_user(db, data)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return await get_user_profile(current_user)


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Request a password reset OTP sent to the user's email."""
    return await request_password_reset(db, data)


@router.post("/reset-password")
async def execute_reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset user password using the OTP received via email."""
    return await reset_password(db, data)
