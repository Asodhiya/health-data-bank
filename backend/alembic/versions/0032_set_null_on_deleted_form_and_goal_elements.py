"""Set nullable delete behavior for form and goal element foreign keys

Revision ID: 0032
Revises: 0031
Create Date: 2026-04-10
"""

from alembic import op


revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def _replace_fk(table_name: str, local_column: str, remote_table: str, remote_column: str, ondelete: str) -> None:
    op.execute(
        f"""
        DO $$
        DECLARE
            constraint_name text;
        BEGIN
            SELECT tc.constraint_name
            INTO constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = '{table_name}'
              AND kcu.column_name = '{local_column}'
            LIMIT 1;

            IF constraint_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE {table_name} DROP CONSTRAINT %I', constraint_name);
            END IF;

            EXECUTE 'ALTER TABLE {table_name} ADD CONSTRAINT fk_{table_name}_{local_column} '
                 || 'FOREIGN KEY ({local_column}) REFERENCES {remote_table}({remote_column}) '
                 || 'ON DELETE {ondelete}';
        END $$;
        """
    )


def upgrade() -> None:
    _replace_fk("health_goals", "element_id", "data_elements", "element_id", "SET NULL")
    _replace_fk("form_submissions", "form_id", "survey_forms", "form_id", "SET NULL")


def downgrade() -> None:
    _replace_fk("health_goals", "element_id", "data_elements", "element_id", "NO ACTION")
    _replace_fk("form_submissions", "form_id", "survey_forms", "form_id", "NO ACTION")
