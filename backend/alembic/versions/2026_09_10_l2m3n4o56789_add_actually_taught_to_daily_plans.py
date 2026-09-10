"""add_actually_taught_to_daily_plans

Revision ID: l2m3n4o56789
Revises: k1l2m3n45678
Create Date: 2026-09-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l2m3n4o56789'
down_revision: Union[str, None] = 'k1l2m3n45678'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('daily_plans')]
    if 'actually_taught' not in cols:
        with op.batch_alter_table('daily_plans', schema=None) as batch_op:
            batch_op.add_column(sa.Column('actually_taught', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('daily_plans', schema=None) as batch_op:
        batch_op.drop_column('actually_taught')
