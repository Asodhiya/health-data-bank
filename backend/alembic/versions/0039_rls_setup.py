"""Add app schema helper functions for RLS session context

Revision ID: 0039
Revises: 0038
Create Date: 2026-04-11
"""

from alembic import op


revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS app")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid AS $$
          SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
        $$ LANGUAGE sql STABLE
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app.current_user_role() RETURNS text AS $$
          SELECT nullif(current_setting('app.current_user_role', true), '')
        $$ LANGUAGE sql STABLE
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS app.current_user_role()")
    op.execute("DROP FUNCTION IF EXISTS app.current_user_id()")
    op.execute("DROP SCHEMA IF EXISTS app")
