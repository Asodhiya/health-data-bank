"""admin profile onboarding columns

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-24

"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('admin_profile', sa.Column('role_title', sa.Text(), nullable=True))
    op.add_column('admin_profile', sa.Column('department', sa.Text(), nullable=True))
    op.add_column('admin_profile', sa.Column('organization', sa.Text(), nullable=True))
    op.add_column('admin_profile', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('admin_profile', sa.Column('contact_preference', sa.Text(), nullable=False, server_default='email'))
    op.add_column('admin_profile', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))


def downgrade():
    op.drop_column('admin_profile', 'onboarding_completed')
    op.drop_column('admin_profile', 'contact_preference')
    op.drop_column('admin_profile', 'bio')
    op.drop_column('admin_profile', 'organization')
    op.drop_column('admin_profile', 'department')
    op.drop_column('admin_profile', 'role_title')
