from fastapi import APIRouter, Depends, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_teacher
from app.models.user import User
from app.schemas.extended import (
    AIPlanGenerateRequest,
    AIPlanSaveRequest,
    AIPlanResponse,
    RecommendationResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/students/{student_id}", tags=["AI & Recommendations"])

# ─── Recommendations (Phase 6) ─────────────────────────

@router.post("/recommendations/upload", response_model=RecommendationResponse, status_code=status.HTTP_201_CREATED)
async def upload_recommendation(
    student_id: str,
    file: UploadFile = File(...),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Upload counselor/teacher recommendation PDF/DOCX and extract guidelines."""
    return await ai_service.upload_recommendation_doc(db, teacher.id, student_id, file)


@router.get("/recommendations", response_model=list[RecommendationResponse])
async def list_recommendations(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded recommendations for a student."""
    return await ai_service.list_recommendation_docs(db, teacher.id, student_id)


# ─── AI Plans (Phase 6) ────────────────────────────────

@router.post("/ai/generate", response_model=AIPlanResponse)
async def generate_lesson_plan(
    student_id: str,
    data: AIPlanGenerateRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Generate daily lesson plan for student using current data and Gemini AI."""
    return await ai_service.generate_ai_lesson_plan(
        db, teacher.id, student_id, data.custom_instructions
    )


@router.get("/ai/plans", response_model=list[AIPlanResponse])
async def get_all_ai_plans(
    student_id: str,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Get history of AI generated plans for a student."""
    return await ai_service.list_ai_plans(db, teacher.id, student_id)


@router.put("/ai/plans/{plan_id}", response_model=AIPlanResponse)
async def save_edited_ai_plan(
    student_id: str,
    plan_id: str,
    data: AIPlanSaveRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Save modified version of AI generated plan and apply it to Today's Daily Plan."""
    return await ai_service.update_ai_lesson_plan(
        db, teacher.id, student_id, plan_id, data.edited_plan
    )
