"""add_test_papers

Revision ID: d4e5f6789012
Revises: c3d4e5f67890
Create Date: 2026-08-12 15:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6789012'
down_revision: Union[str, None] = 'c3d4e5f67890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('question_paper_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('question_paper_url', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('answer_paper_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('answer_paper_url', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('tests', schema=None) as batch_op:
        batch_op.drop_column('answer_paper_url')
        batch_op.drop_column('answer_paper_name')
        batch_op.drop_column('question_paper_url')
        batch_op.drop_column('question_paper_name')
