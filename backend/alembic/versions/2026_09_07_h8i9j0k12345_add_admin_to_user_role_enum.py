"""add_admin_to_user_role_enum

Revision ID: h8i9j0k12345
Revises: g7h8i9j01234
Create Date: 2026-09-07

"""
from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h8i9j0k12345'
down_revision: Union[str, None] = 'g7h8i9j01234'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name if bind is not None else op.get_context().dialect.name
    if dialect_name == "postgresql":
        if context.is_offline_mode():
            op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'")
        else:
            with op.get_context().autocommit_block():
                op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'")


def downgrade() -> None:
    # PostgreSQL does not support dropping individual enum values via ALTER TYPE ... DROP VALUE.
    # Leaving the enum value intact avoids data corruption for rows created with role='admin'.
    pass
