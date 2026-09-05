"""add_admin_role_is_active_and_student_teachers

Revision ID: b8f9e0123456
Revises: 79c5a8ff31ec
Create Date: 2026-08-12 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8f9e0123456'
down_revision: Union[str, None] = '79c5a8ff31ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add is_active to users
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))

    # 2. Create student_teachers junction table
    op.create_table(
        'student_teachers',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('student_id', sa.String(length=36), nullable=False),
        sa.Column('teacher_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'teacher_id', name='uq_student_teacher')
    )
    with op.batch_alter_table('student_teachers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_student_teachers_student_id'), ['student_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_student_teachers_teacher_id'), ['teacher_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('student_teachers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_student_teachers_teacher_id'))
        batch_op.drop_index(batch_op.f('ix_student_teachers_student_id'))

    op.drop_table('student_teachers')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('is_active')
