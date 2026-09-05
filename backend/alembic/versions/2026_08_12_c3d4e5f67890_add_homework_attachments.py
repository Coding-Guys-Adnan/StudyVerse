"""add_homework_attachments

Revision ID: c3d4e5f67890
Revises: b8f9e0123456
Create Date: 2026-08-12 14:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f67890'
down_revision: Union[str, None] = 'b8f9e0123456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('homework', schema=None) as batch_op:
        batch_op.add_column(sa.Column('attachment_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('attachment_url', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('homework', schema=None) as batch_op:
        batch_op.drop_column('attachment_url')
        batch_op.drop_column('attachment_name')
