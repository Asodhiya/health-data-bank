"""Backfill display values for select-type health data points

Revision ID: 0030
Revises: 0029
Create Date: 2026-04-09
"""

from alembic import op


revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE health_data_points AS hdp
        SET value_text = fo.label,
            value_number = NULL
        FROM submission_answers AS sa
        JOIN form_fields AS ff
          ON ff.field_id = sa.field_id
        JOIN field_options AS fo
          ON fo.field_id = ff.field_id
         AND fo.value = sa.value_number::integer
        WHERE hdp.source_submission_id = sa.submission_id
          AND hdp.source_field_id = sa.field_id
          AND ff.field_type IN ('single_select', 'dropdown')
          AND hdp.value_text IS NULL
          AND hdp.value_number IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE health_data_points AS hdp
        SET value_text = fo.label
        FROM submission_answers AS sa
        JOIN form_fields AS ff
          ON ff.field_id = sa.field_id
        JOIN field_options AS fo
          ON fo.field_id = ff.field_id
         AND fo.value = sa.value_number::integer
        WHERE hdp.source_submission_id = sa.submission_id
          AND hdp.source_field_id = sa.field_id
          AND ff.field_type = 'likert'
          AND hdp.value_number IS NOT NULL
          AND (hdp.value_text IS NULL OR hdp.value_text = '')
        """
    )

    op.execute(
        """
        UPDATE health_data_points AS hdp
        SET value_json = mapped.labels
        FROM (
            SELECT
                sa.submission_id,
                sa.field_id,
                jsonb_agg(COALESCE(fo.label, value_entry.value) ORDER BY value_entry.ordinality) AS labels
            FROM submission_answers AS sa
            JOIN form_fields AS ff
              ON ff.field_id = sa.field_id
            JOIN LATERAL jsonb_array_elements_text(sa.value_json) WITH ORDINALITY AS value_entry(value, ordinality)
              ON TRUE
            LEFT JOIN field_options AS fo
              ON fo.field_id = ff.field_id
             AND fo.value = value_entry.value::integer
            WHERE ff.field_type = 'multi_select'
            GROUP BY sa.submission_id, sa.field_id
        ) AS mapped
        WHERE hdp.source_submission_id = mapped.submission_id
          AND hdp.source_field_id = mapped.field_id
          AND hdp.value_json IS NOT NULL
        """
    )


def downgrade() -> None:
    pass
