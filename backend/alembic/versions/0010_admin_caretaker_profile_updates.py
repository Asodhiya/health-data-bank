"""Add title to admin_profile; add missing fields to caretaker_profile

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    # admin_profile: add honorific title
    op.add_column('admin_profile', sa.Column('title', sa.Text(), nullable=True))

    # caretaker_profile: add all missing fields
    op.add_column('caretaker_profile', sa.Column('credentials', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('department', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('specialty', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('working_hours_start', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('working_hours_end', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('contact_preference', sa.Text(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('available_days', JSONB(), nullable=True))
    op.add_column('caretaker_profile', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))


def downgrade():
    op.drop_column('caretaker_profile', 'onboarding_completed')
    op.drop_column('caretaker_profile', 'available_days')
    op.drop_column('caretaker_profile', 'contact_preference')
    op.drop_column('caretaker_profile', 'working_hours_end')
    op.drop_column('caretaker_profile', 'working_hours_start')
    op.drop_column('caretaker_profile', 'bio')
    op.drop_column('caretaker_profile', 'specialty')
    op.drop_column('caretaker_profile', 'department')
    op.drop_column('caretaker_profile', 'credentials')
    op.drop_column('admin_profile', 'title')
