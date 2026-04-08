"""Add caretaker notes table

Revision ID: 0016
Revises: 0015
Create Date: 2026-03-31
"""

from alembic import op


revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS caretaker_notes (
            note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            caretaker_id UUID NOT NULL REFERENCES caretaker_profile(caretaker_id) ON DELETE CASCADE,
            participant_id UUID NOT NULL REFERENCES participant_profile(participant_id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            tag TEXT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_caretaker_notes_caretaker_participant_created "
        "ON caretaker_notes (caretaker_id, participant_id, created_at DESC)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_caretaker_notes_caretaker_participant_created")
    op.execute("DROP TABLE IF EXISTS caretaker_notes")

