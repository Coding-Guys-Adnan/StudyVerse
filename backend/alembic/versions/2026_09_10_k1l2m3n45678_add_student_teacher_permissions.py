"""add_student_teacher_permissions

Revision ID: k1l2m3n45678
Revises: i9j0k1l23456
Create Date: 2026-09-10

"""
import json
import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k1l2m3n45678'
down_revision: Union[str, None] = 'i9j0k1l23456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_PERMISSIONS = {
    "syllabus": {"can_edit": False, "can_import": False},
    "homework": {"can_edit": False, "can_import": False},
    "calendar": {"can_edit": False, "can_import": False},
    "tests": {"can_edit": False, "can_import": False},
    "files": {"can_edit": False, "can_import": False},
}


def upgrade() -> None:
    # 1. Add permissions column to student_teachers table
    with op.batch_alter_table('student_teachers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('permissions', sa.JSON(), nullable=True))

    conn = op.get_bind()
    default_json_str = json.dumps(DEFAULT_PERMISSIONS)

    # 2. Backfill existing student_teachers rows with safe read-only default
    try:
        if conn.dialect.name == "postgresql":
            conn.execute(
                sa.text("UPDATE student_teachers SET permissions = CAST(:perms AS json) WHERE permissions IS NULL"),
                {"perms": default_json_str}
            )
        else:
            conn.execute(
                sa.text("UPDATE student_teachers SET permissions = :perms WHERE permissions IS NULL"),
                {"perms": default_json_str}
            )
    except Exception as e:
        print(f"Notice during permissions backfill: {e}")

    # 3. Backfill any existing students who have teacher_id but no student_teachers row
    try:
        missing_pairs = conn.execute(
            sa.text("""
                SELECT s.id AS student_id, s.teacher_id AS teacher_id
                FROM students s
                WHERE s.teacher_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM student_teachers st
                      WHERE st.student_id = s.id AND st.teacher_id = s.teacher_id
                  )
            """)
        ).fetchall()

        for row in missing_pairs:
            conn.execute(
                sa.text("""
                    INSERT INTO student_teachers (id, student_id, teacher_id, created_at, permissions)
                    VALUES (:id, :student_id, :teacher_id, CURRENT_TIMESTAMP, :perms)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "student_id": row[0],
                    "teacher_id": row[1],
                    "perms": default_json_str,
                }
            )
    except Exception as e:
        # Non-fatal if dialect differences occur during insert backfill
        print(f"Notice during backfill: {e}")


def downgrade() -> None:
    with op.batch_alter_table('student_teachers', schema=None) as batch_op:
        batch_op.drop_column('permissions')
