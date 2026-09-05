from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class StudentCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    parent_phone: Optional[str] = None
    class_grade: Optional[str] = None
    board: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    monthly_fees: Optional[float] = None
    fee_due_day: Optional[int] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    parent_phone: Optional[str] = None
    class_grade: Optional[str] = None
    board: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    monthly_fees: Optional[float] = None
    fee_due_day: Optional[int] = None


class StudentResponse(BaseModel):
    id: str
    teacher_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    parent_phone: Optional[str] = None
    class_grade: Optional[str] = None
    board: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    avatar_url: Optional[str] = None
    monthly_fees: Optional[float] = None
    fee_due_day: Optional[int] = None
    created_at: str

    model_config = {"from_attributes": True}


class StudentListResponse(BaseModel):
    students: list[StudentResponse]
    total: int


class DashboardStats(BaseModel):
    total_students: int
    today_classes: int
    homework_pending: int
    ai_plans_generated: int
