"""Grant researcher role data element permissions

Revision ID: 0049
Revises: 0048
Create Date: 2026-04-13
"""

from alembic import op


revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


RESEARCHER_ELEMENT_PERMISSION_SQL = """
INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles AS role
CROSS JOIN permissions AS permission
WHERE role.role_name = 'researcher'
    AND permission.code IN (
      'element:view',
      'element:create',
      'element:delete',
      'element:map'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM role_permissions AS rp
      WHERE rp.role_id = role.role_id
        AND rp.permission_id = permission.permission_id
  )
"""


def upgrade() -> None:
    op.execute(RESEARCHER_ELEMENT_PERMISSION_SQL)


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM role_permissions
        WHERE role_id IN (
            SELECT role_id FROM roles WHERE role_name = 'researcher'
        )
          AND permission_id IN (
              SELECT permission_id
              FROM permissions
              WHERE code IN (
                  'element:view',
                  'element:create',
                  'element:delete',
                  'element:map'
              )
          )
        """
    )
