"""Add profile fields to researcher_profile

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('researcher_profile', sa.Column('title', sa.Text(), nullable=True))
    op.add_column('researcher_profile', sa.Column('credentials', sa.Text(), nullable=True))
    op.add_column('researcher_profile', sa.Column('organization', sa.Text(), nullable=True))
    op.add_column('researcher_profile', sa.Column('department', sa.Text(), nullable=True))
    op.add_column('researcher_profile', sa.Column('specialty', sa.Text(), nullable=True))
    op.add_column('researcher_profile', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('researcher_profile', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))


def downgrade():
    op.drop_column('researcher_profile', 'onboarding_completed')
    op.drop_column('researcher_profile', 'bio')
    op.drop_column('researcher_profile', 'specialty')
    op.drop_column('researcher_profile', 'department')
    op.drop_column('researcher_profile', 'organization')
    op.drop_column('researcher_profile', 'credentials')
    op.drop_column('researcher_profile', 'title')
