"""Change submission_answers PK to composite (submission_id, field_id)

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-23

- Drops answer_id column and its PK
- Makes field_id NOT NULL
- Adds composite PK (submission_id, field_id)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove duplicate (submission_id, field_id) rows before enforcing uniqueness.
    # Keeps the row with the lowest answer_id (arbitrary but deterministic).
    op.execute("""
        DELETE FROM submission_answers
        WHERE answer_id NOT IN (
            SELECT MIN(answer_id::text)::uuid
            FROM submission_answers
            GROUP BY submission_id, field_id
        )
    """)

    # Drop old surrogate PK
    op.drop_constraint("submission_answers_pkey", "submission_answers", type_="primary")
    op.drop_column("submission_answers", "answer_id")

    # field_id must be NOT NULL for a PK
    op.alter_column("submission_answers", "field_id", nullable=False)

    # Add composite PK
    op.create_primary_key(
        "pk_submission_answers",
        "submission_answers",
        ["submission_id", "field_id"],
    )


def downgrade() -> None:
    op.drop_constraint("pk_submission_answers", "submission_answers", type_="primary")

    op.alter_column("submission_answers", "field_id", nullable=True)

    op.add_column(
        "submission_answers",
        sa.Column(
            "answer_id",
            PG_UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )
    op.create_primary_key(
        "submission_answers_pkey",
        "submission_answers",
        ["answer_id"],
    )
