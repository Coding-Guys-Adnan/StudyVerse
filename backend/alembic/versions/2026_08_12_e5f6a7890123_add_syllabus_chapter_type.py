"""add_syllabus_chapter_type

Revision ID: e5f6a7890123
Revises: d4e5f6789012
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7890123'
down_revision: Union[str, None] = 'd4e5f6789012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('syllabus', sa.Column('chapter_type', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('syllabus', 'chapter_type')
