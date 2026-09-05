"""add_syllabus_relational_tables

Revision ID: f6a789012345
Revises: e5f6a7890123
Create Date: 2026-08-13

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f6a789012345'
down_revision: Union[str, None] = 'e5f6a7890123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'syllabus_chapters',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('syllabus_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['syllabus_id'], ['syllabus.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_syllabus_chapters_syllabus_id'), 'syllabus_chapters', ['syllabus_id'], unique=False)

    op.create_table(
        'checklist_items',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('chapter_id', sa.String(length=36), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['chapter_id'], ['syllabus_chapters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_checklist_items_chapter_id'), 'checklist_items', ['chapter_id'], unique=False)

    op.create_table(
        'chapter_notes',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('chapter_id', sa.String(length=36), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['chapter_id'], ['syllabus_chapters.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_chapter_notes_chapter_id'), 'chapter_notes', ['chapter_id'], unique=False)

    op.create_table(
        'syllabus_attachments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('checklist_item_id', sa.String(length=36), nullable=True),
        sa.Column('chapter_note_id', sa.String(length=36), nullable=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('stored_path', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('uploaded_by', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['checklist_item_id'], ['checklist_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['chapter_note_id'], ['chapter_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_syllabus_attachments_checklist_item_id'), 'syllabus_attachments', ['checklist_item_id'], unique=False)
    op.create_index(op.f('ix_syllabus_attachments_chapter_note_id'), 'syllabus_attachments', ['chapter_note_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_syllabus_attachments_chapter_note_id'), table_name='syllabus_attachments')
    op.drop_index(op.f('ix_syllabus_attachments_checklist_item_id'), table_name='syllabus_attachments')
    op.drop_table('syllabus_attachments')

    op.drop_index(op.f('ix_chapter_notes_chapter_id'), table_name='chapter_notes')
    op.drop_table('chapter_notes')

    op.drop_index(op.f('ix_checklist_items_chapter_id'), table_name='checklist_items')
    op.drop_table('checklist_items')

    op.drop_index(op.f('ix_syllabus_chapters_syllabus_id'), table_name='syllabus_chapters')
    op.drop_table('syllabus_chapters')
