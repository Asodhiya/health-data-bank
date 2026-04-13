# Full System Code Audit Report
Date: 2026-04-13
Mode: Read-only code audit
Scope: Frontend, backend, routes, services, schemas, hooks, utilities, assets, generated artifacts, and dependency usage

## Executive Summary

This audit focused on identifying:

- Confirmed dead code
- Possibly unused code
- Incomplete or half-finished features
- TODO / placeholder code
- Redundant or duplicated logic
- Legacy code paths that should be cleaned up

Key conclusion:

- I did not find confirmed dead routed frontend pages. The major page modules in `frontend/src/App.jsx` are wired and reachable.
- I did not find confirmed unused backend router modules. The route files in `backend/app/api/routes/__init__.py` are included.
- I did not find a high-confidence unused dependency in `frontend/package.json` or `backend/requirements.txt` among the packages inspected.

The strongest cleanup opportunities are not missing routes or orphaned features. They are:

1. Generated artifacts committed into the repo
2. Duplicate validation models in backend middleware vs shared schemas
3. Half-finished / visibly exposed fallback and "coming soon" code
4. Legacy endpoints that still exist alongside newer paged APIs

## Findings Summary

- Confirmed dead code / generated artifacts: 3
- Confirmed redundant / legacy code paths: 3
- Incomplete or half-finished features: 4
- Possibly unused or needs verification: 1
- High-risk verification items: 4

---

## 1. Confirmed Dead Code

### A01
- File Name: `frontend/src/assets/react.svg`
- Function / Component / Section: asset file
- Issue Type: Dead Code
- Severity: Low
- Description: Default Vite scaffold asset remains in the repo with no references in frontend source.
- Why it is a problem: Adds noise and makes cleanup audits harder.
- Evidence: repo search found no usage of `react.svg` in `frontend/src`.
- Is it safe to remove? Yes
- Recommended Action: Delete the file.
- Suggested Refactor or Cleanup: None needed.

### A02
- File Name: repo root
- Function / Component / Section: `pytest-cache-files-*` directories
- Issue Type: Dead Code
- Severity: Medium
- Description: The project root contains a very large number of generated pytest cache directories.
- Why it is a problem: Pollutes the repository, obscures real files, and increases the chance of accidental commits.
- Evidence: root listing shows many directories matching `pytest-cache-files-*`.
- Is it safe to remove? Yes
- Recommended Action: Remove all generated cache directories.
- Suggested Refactor or Cleanup: Add or strengthen ignore rules so they do not return.

### A03
- File Name: generated reports and local logs in repo root and `backend/tests`
- Function / Component / Section: HTML reports and local runtime logs
- Issue Type: Dead Code
- Severity: Low
- Description: Generated artifacts such as test HTML reports and `cloudflared-*.log` files are present in the repo tree.
- Why it is a problem: These are not runtime assets and create maintenance noise.
- Evidence: examples include `cloudflared-backend.log`, `cloudflared-frontend.log`, `backend/tests/services/test1_user_updates_report.html`, and similar report files.
- Is it safe to remove? Yes
- Recommended Action: Remove generated artifacts and keep only intentional docs.
- Suggested Refactor or Cleanup: Ignore these outputs in source control.

---

## 2. Confirmed Redundant or Legacy Code

### L01
- File Name: `backend/app/middleware/signup_validation.py`, `backend/app/middleware/survey_validation.py`, `backend/app/schemas/schemas.py`
- Function / Component / Section: `UserSignup`, `SurveyRequest`
- Issue Type: Redundant Code
- Severity: High
- Description: Signup and survey request validation models are defined twice: once in middleware modules and again in shared schemas.
- Why it is a problem: Validation logic can drift, and tests can validate a different contract than the live application uses.
- Evidence: tests import middleware models, while runtime route code imports schema models.
- Is it safe to remove? Needs Verification
- Recommended Action: Standardize on the schema versions used by runtime code, migrate tests, then remove middleware duplicates.
- Suggested Refactor or Cleanup: Keep a single validation source under `backend/app/schemas/`.

### L02
- File Name: `backend/app/api/routes/user.py`
- Function / Component / Section: `POST /user/update_user`
- Issue Type: Legacy Code
- Severity: Medium
- Description: Older endpoint naming and string response format remain active.
- Why it is a problem: Inconsistent API style, typo in success message, and extra surface area for maintenance.
- Evidence: route returns `"detail : User updated sucessfully"` and is still used by `frontend/src/pages/shared/ProfilePage.jsx`.
- Is it safe to remove? No
- Recommended Action: Replace with a normalized response model and deprecate the legacy path after the frontend is updated.
- Suggested Refactor or Cleanup: Move to a more standard `PATCH /user/profile` style endpoint.

### L03
- File Name: `backend/app/api/routes/form_management.py`, `frontend/src/pages/researcher/Group_Chorts.jsx`
- Function / Component / Section: `/form_management/list` vs `/form_management/list-paged`
- Issue Type: Legacy Code
- Severity: Medium
- Description: Both paged and non-paged form listing routes are active.
- Why it is a problem: Multiple list endpoints for similar data increase duplication and inconsistency.
- Evidence: the paged route exists, but `Group_Chorts.jsx` still calls `api.listForms()`.
- Is it safe to remove? No
- Recommended Action: Migrate remaining callers to a dedicated modern endpoint, then retire `/list`.
- Suggested Refactor or Cleanup: Use one canonical list strategy across researcher pages.

---

## 3. Incomplete or Half-Finished Features

### I01
- File Name: `frontend/src/pages/admin/BackupRestorePage.jsx`
- Function / Component / Section: backup scope selector
- Issue Type: Incomplete Code
- Severity: Medium
- Description: Backup scopes other than full backup are visible in UI but explicitly marked `coming soon`.
- Why it is a problem: Exposes unfinished capability in production-facing admin UI.
- Evidence: UI renders `coming soon` badge for non-full scopes; file comments also state backend only supports full backups.
- Is it safe to remove? No
- Recommended Action: Hide unsupported scope options until backend support exists.
- Suggested Refactor or Cleanup: Drive available scopes from backend capabilities.

### I02
- File Name: `frontend/src/pages/participant/SurveyFillPage.jsx`
- Function / Component / Section: file header comments / fallback behavior
- Issue Type: Incomplete Code
- Severity: Medium
- Description: File still documents a mock + localStorage fallback for when backend is unavailable.
- Why it is a problem: Suggests partially retired offline logic or stale implementation commentary.
- Evidence: header comment explicitly says `Fallback: mock data + localStorage`.
- Is it safe to remove? Needs Verification
- Recommended Action: Confirm whether the fallback still exists; remove either the fallback or the stale comment.
- Suggested Refactor or Cleanup: Keep comments aligned with actual behavior.

### I03
- File Name: `frontend/src/pages/participant/FormListPage.jsx`, `frontend/src/pages/participant/ParticipantDashboard.jsx`
- Function / Component / Section: temporary / mock wording
- Issue Type: Incomplete Code
- Severity: Medium
- Description: Participant pages still contain temporary comments about mock data and "for now" setup.
- Why it is a problem: Signals unfinished product logic and increases uncertainty during maintenance.
- Evidence: comments include `Fallback: mock data + localStorage hydration` and `For now we are setting up our use mock data here`.
- Is it safe to remove? Needs Verification
- Recommended Action: Verify live behavior and delete stale temporary comments.
- Suggested Refactor or Cleanup: Remove old transitional comments after confirming production path.

### I04
- File Name: `backend/app/api/routes/participant_survey.py`, `backend/app/schemas/filter_data_schema.py`
- Function / Component / Section: TODO notes
- Issue Type: TODO / Placeholder Code
- Severity: Medium
- Description: Production files still contain TODOs about broken dependencies and missing demographic schema coverage.
- Why it is a problem: These are not cosmetic TODOs; they describe real gaps or uncertainty.
- Evidence:
  - `participant_survey.py`: `dependencies do not work as of the moment`
  - `filter_data_schema.py`: demographic fields TODO
- Is it safe to remove? No
- Recommended Action: Resolve the underlying issue or move the work into tracked tickets and remove stale code comments.
- Suggested Refactor or Cleanup: Keep only TODOs that are current, scoped, and tracked externally.

---

## 4. Possibly Unused Code

### P01
- File Name: `AUDIT_REPORT.md`, `TEST_AUDIT_REPORT.md`, `BACKUP_RESTORE_TEST_REPORT.html`, and similar top-level report files
- Function / Component / Section: repo documentation / generated output
- Issue Type: Needs Verification
- Severity: Low
- Description: These look like point-in-time audit artifacts rather than application code.
- Why it is a problem: They may be useful documentation, or they may be stale clutter.
- Evidence: no runtime references found during code scan.
- Is it safe to remove? Needs Verification
- Recommended Action: Decide whether these are intentionally versioned process artifacts.
- Suggested Refactor or Cleanup: Move retained reports into a dedicated `docs/reports/` area if they matter.

---

## 5. Unused Files and Components

No additional high-confidence unused routed page components were confirmed in this audit.

What was verified:

- Major frontend pages declared in `frontend/src/App.jsx` are routed.
- Shared hooks checked during the audit, including `usePolling` and `useResearcherMeta`, are actively used.
- Components checked during the audit, including `MedicalCrossIcon` and `HDBLogo`, are actively used.

---

## 6. Unused APIs, Routes, and Database Models

No confirmed dead backend router modules were found.

What was verified:

- Route modules in `backend/app/api/routes/__init__.py` are included in the API router.
- The `health`, `stats`, `feedback`, and `user` routers are all included.
- Database-related models inspected in the audit path, including `SystemFeedback`, `BackupScheduleSettings`, `SystemMaintenanceSettings`, and `HealthDataPoint`, are referenced by services or routes.

Legacy note:

- The strongest route-level cleanup opportunity is not removal of dead routers, but consolidation of old and new endpoints where both still exist.

---

## 7. Unused Dependencies and Packages

No high-confidence unused dependency was confirmed among the packages inspected.

Verified as used:

- `react-markdown`
- `remark-gfm`
- `@tailwindcss/typography`
- `recharts`
- backend packages associated with Redis, Excel export, async DB access, and scheduling

Recommendation:

- If you want to tighten this further, the next step would be a lockfile-plus-import audit with package-level tooling, but I would not mark any inspected dependency as unused from this pass.

---

## 8. Legacy Code That Should Be Removed

### R01
- File Name: `backend/app/middleware/signup_validation.py`
- Function / Component / Section: validation model module
- Issue Type: Legacy Code
- Severity: Medium
- Description: Appears to exist primarily because older tests import it directly.
- Why it is a problem: Keeps duplicated validation rules alive outside the runtime schema layer.
- Evidence: tests reference this module; runtime auth flow uses schema models instead.
- Is it safe to remove? Needs Verification
- Recommended Action: Repoint tests first, then remove.
- Suggested Refactor or Cleanup: Replace test imports with `backend/app/schemas/schemas.py`.

### R02
- File Name: `backend/app/middleware/survey_validation.py`
- Function / Component / Section: validation model module and embedded `__main__` test block
- Issue Type: Legacy Code
- Severity: Medium
- Description: Contains duplicated request validation and an inline manual test block.
- Why it is a problem: Mixed-purpose module with behavior likely superseded by central schemas.
- Evidence: duplicated `SurveyRequest`, plus `if __name__ == "__main__":` block.
- Is it safe to remove? Needs Verification
- Recommended Action: Move all validation to shared schemas and remove the ad hoc module.
- Suggested Refactor or Cleanup: Keep manual experiments out of runtime modules.

---

## 9. Quick Cleanup Wins

- Delete `frontend/src/assets/react.svg`
- Remove generated `pytest-cache-files-*` directories from repo root
- Remove generated HTML test reports and local cloudflared logs
- Hide unsupported backup scopes in admin UI
- Consolidate duplicate validation models into one shared schema layer
- Remove stale mock / fallback commentary after verifying current behavior

---

## 10. High-Risk Areas Requiring Manual Verification

### H01
- Area: participant fallback behavior
- Risk: Comments suggest old localStorage/mock fallback paths may still influence behavior.
- Why verification is needed: Removing fallback code blindly could affect degraded-mode UX.

### H02
- Area: duplicate validation models
- Risk: Tests and runtime may currently rely on subtly different validation behavior.
- Why verification is needed: Consolidation can break tests or API validation contracts if drift already exists.

### H03
- Area: legacy form list endpoints
- Risk: Some pages still depend on `/form_management/list`.
- Why verification is needed: Removing the old endpoint too early would break researcher pages.

### H04
- Area: generated reports tracked in repo
- Risk: Some files may be intentionally retained for audit/compliance history.
- Why verification is needed: Technical cleanup is safe, but process cleanup needs owner confirmation.

---

## 11. Explicit Non-Findings

These were checked and not reported as confirmed issues:

- No confirmed dead routed frontend pages among the major modules wired through `frontend/src/App.jsx`
- No confirmed unused backend router modules among files registered by `backend/app/api/routes/__init__.py`
- No high-confidence unused dependency among the inspected entries in `frontend/package.json` and `backend/requirements.txt`

---

## Recommended Next Action Order

1. Safe-delete generated artifacts and cache folders
2. Consolidate backend validation models
3. Hide unfinished admin backup scope UI
4. Remove stale participant fallback comments or code after verification
5. Migrate remaining callers off legacy list endpoints and then retire them
