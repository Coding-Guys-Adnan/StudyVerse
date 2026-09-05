"""add_syllabus_term

Revision ID: g7h8i9j01234
Revises: f6a789012345
Create Date: 2026-08-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g7h8i9j01234'
down_revision: Union[str, None] = 'f6a789012345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('syllabus', sa.Column('term', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('syllabus', 'term')
