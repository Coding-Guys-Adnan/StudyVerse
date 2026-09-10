from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Dict


class ModulePermissions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    can_edit: bool = False
    can_import: bool = False


class CalendarPermissions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    can_edit: bool = False
    can_import: bool = False

    @field_validator("can_import")
    @classmethod
    def validate_no_calendar_import(cls, v: bool) -> bool:
        if v:
            raise ValueError("Calendar import is not supported")
        return False


class FilesPermissions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    can_import: bool = False
    can_edit: bool = False

    @field_validator("can_edit")
    @classmethod
    def validate_no_files_edit(cls, v: bool) -> bool:
        if v:
            raise ValueError("Files editing is not supported")
        return False


class StudentPermissions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    syllabus: ModulePermissions = Field(default_factory=ModulePermissions)
    homework: ModulePermissions = Field(default_factory=ModulePermissions)
    calendar: CalendarPermissions = Field(default_factory=CalendarPermissions)
    tests: ModulePermissions = Field(default_factory=ModulePermissions)
    files: FilesPermissions = Field(default_factory=FilesPermissions)


class StudentPermissionsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permissions: StudentPermissions


class StudentPermissionsResponse(BaseModel):
    student_id: str
    teacher_id: str
    permissions: StudentPermissions


class StudentEffectivePermissionsResponse(BaseModel):
    student_id: str
    effective_permissions: StudentPermissions
    teacher_permissions: Dict[str, StudentPermissions]
