"""add_student_and_fee_record_fields

Revision ID: i9j0k1l23456
Revises: h8i9j0k12345
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i9j0k1l23456'
down_revision: Union[str, None] = 'h8i9j0k12345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add student fields: date_of_birth, monthly_fees, fee_due_day
    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.add_column(sa.Column('date_of_birth', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('monthly_fees', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('fee_due_day', sa.Integer(), nullable=True))

    # 2. Add fee_records fields: fee_month, created_at, updated_at, make month/year nullable, and unique constraint
    with op.batch_alter_table('fee_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('fee_month', sa.String(length=7), nullable=True))
        batch_op.add_column(sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
        batch_op.alter_column('month', existing_type=sa.String(length=20), nullable=True)
        batch_op.alter_column('year', existing_type=sa.Integer(), nullable=True)
        batch_op.create_unique_constraint('uq_fee_student_month', ['student_id', 'fee_month'])


def downgrade() -> None:
    with op.batch_alter_table('fee_records', schema=None) as batch_op:
        batch_op.drop_constraint('uq_fee_student_month', type_='unique')
        batch_op.alter_column('year', existing_type=sa.Integer(), nullable=False)
        batch_op.alter_column('month', existing_type=sa.String(length=20), nullable=False)
        batch_op.drop_column('updated_at')
        batch_op.drop_column('created_at')
        batch_op.drop_column('fee_month')

    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.drop_column('fee_due_day')
        batch_op.drop_column('monthly_fees')
        batch_op.drop_column('date_of_birth')
