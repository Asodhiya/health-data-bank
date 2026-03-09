"""Link health_goals to data_elements

Revision ID: 0001
Revises:
Create Date: 2026-03-09

- Adds element_id FK to health_goals → data_elements
- Drops goal_type (replaced by DataElement.label / code)
- Drops unit (replaced by DataElement.unit)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "health_goals",
        sa.Column("element_id", UUID(as_uuid=True), sa.ForeignKey("data_elements.element_id"), nullable=True),
    )
    op.drop_column("health_goals", "goal_type")
    op.drop_column("health_goals", "unit")


def downgrade() -> None:
    op.add_column("health_goals", sa.Column("unit", sa.Text(), nullable=True))
    op.add_column("health_goals", sa.Column("goal_type", sa.Text(), nullable=True))
    op.drop_column("health_goals", "element_id")
