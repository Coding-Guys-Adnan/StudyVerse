from pydantic import BaseModel, EmailStr
from typing import Optional


class CreateTeacherRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UpdateTeacherAdminRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class TeacherAdminResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str = "teacher"
    is_active: bool
    created_at: str
    student_count: int = 0

    model_config = {"from_attributes": True}


class UpdateTeacherStatusRequest(BaseModel):
    is_active: bool


class AdminResetPasswordRequest(BaseModel):
    new_password: str
    confirm_password: Optional[str] = None


class AssignedTeacherInfo(BaseModel):
    id: str
    full_name: str
    email: str
    is_active: bool = True

    model_config = {"from_attributes": True}


class StudentAdminResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    name: str
    phone: Optional[str] = None
    parent_phone: Optional[str] = None
    class_grade: Optional[str] = None
    board: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    assigned_teachers: list[AssignedTeacherInfo] = []
    created_at: str

    model_config = {"from_attributes": True}


class UpdateStudentAdminRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    parent_phone: Optional[str] = None
    class_grade: Optional[str] = None
    board: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class UpdateStudentStatusRequest(BaseModel):
    is_active: bool


