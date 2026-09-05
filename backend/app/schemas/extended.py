"""
Schemas for syllabus document upload, recommendations, AI plans, and announcements.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import date


# ─── Syllabus Documents ────────────────────────────────

class SyllabusDocumentResponse(BaseModel):
    id: str
    student_id: str
    file_name: str
    extracted_text: Optional[str] = None
    uploaded_at: str

    model_config = {"from_attributes": True}


class SyllabusDocumentUploadResponse(BaseModel):
    document: SyllabusDocumentResponse
    extracted_chapters: list[dict]  # [{subject, chapter}]


# ─── Recommendations ───────────────────────────────────

class RecommendationResponse(BaseModel):
    id: str
    student_id: str
    file_name: str
    extracted_text: Optional[str] = None
    uploaded_at: str

    model_config = {"from_attributes": True}


# ─── AI Plans ──────────────────────────────────────────

class AIPlanGenerateRequest(BaseModel):
    custom_instructions: Optional[str] = None


class AIPlanSaveRequest(BaseModel):
    edited_plan: str


class AIPlanResponse(BaseModel):
    id: str
    student_id: str
    plan_date: date
    generated_plan: Optional[str] = None
    edited_plan: Optional[str] = None
    prompt_used: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


# ─── Announcements ─────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title: str
    message: Optional[str] = None


class AnnouncementResponse(BaseModel):
    id: str
    teacher_id: str
    title: str
    message: Optional[str] = None
    channel: str
    created_at: str

    model_config = {"from_attributes": True}
