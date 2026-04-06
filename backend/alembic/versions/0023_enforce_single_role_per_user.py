"""Enforce single role link per user in user_roles.

Revision ID: 0023
Revises: 0022
Create Date: 2026-04-06
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cleanup legacy duplicates first: keep one role row per user.
    # We keep the row with the smallest role_id for deterministic behavior.
    op.execute(
        """
        DELETE FROM user_roles ur
        USING user_roles keep
        WHERE ur.user_id = keep.user_id
          AND ur.role_id > keep.role_id
        """
    )

    op.create_unique_constraint(
        "uq_user_roles_user_id",
        "user_roles",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_user_roles_user_id", "user_roles", type_="unique")

