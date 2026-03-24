"""
Central registry of all permission codes, grouped by use case.

Format: resource:action (camelCase)
"""

# ── Participant: Goals ────────────────────────────────────────────────────────
GOAL_VIEW_ALL   = "goal:displayAll"
GOAL_ADD        = "goal:addGoals"
GOAL_EDIT       = "goal:edit"
GOAL_DELETE     = "goal:delete"

# ── Participant: Surveys ──────────────────────────────────────────────────────
SURVEY_LIST_ASSIGNED = "survey:listAssigned"
SURVEY_READ          = "survey:read"
SURVEY_SUBMIT        = "survey:submit"

# ── Participant: Stats ────────────────────────────────────────────────────────
STATS_VIEW = "stats:view"

# ── Researcher: Forms ─────────────────────────────────────────────────────────
FORM_VIEW      = "form:view"
FORM_CREATE    = "form:create"
FORM_GET       = "form:get"
FORM_UPDATE    = "form:update"
FORM_DELETE    = "form:delete"
FORM_PUBLISH   = "form:publish"
FORM_UNPUBLISH = "form:unpublish"

# ── Researcher: Goal Templates ────────────────────────────────────────────────
GOAL_TEMPLATE_VIEW   = "goalTemplate:view"
GOAL_TEMPLATE_CREATE = "goalTemplate:create"
GOAL_TEMPLATE_EDIT   = "goalTemplate:edit"

# ── Admin: Data Elements ──────────────────────────────────────────────────────
ELEMENT_VIEW   = "element:view"
ELEMENT_CREATE = "element:create"
ELEMENT_DELETE = "element:delete"
ELEMENT_MAP    = "element:map"

# ── Admin: Roles & Auth ───────────────────────────────────────────────────────
ROLE_READ_ALL = "role:readAll"
SEND_INVITE   = "send:invite"

# ── Admin: Group & Caretaker Management ───────────────────────────
GROUP_READ    = "group:read"
GROUP_WRITE   = "group:write"
GROUP_DELETE  = "group:delete"
CARETAKER_READ   = "caretaker:read"
CARETAKER_ASSIGN = "caretaker:assign"

# ── Admin: Backup & Restore ────────────────────────────────────────
BACKUP_CREATE  = "backup:create"

# ── Onboarding ──────────────────────────────────────────────────────
ONBOARDING_READ   = "onboarding:read"
ONBOARDING_SUBMIT = "onboarding:submit"
ONBOARDING_EDIT   = "onboarding:edit"
