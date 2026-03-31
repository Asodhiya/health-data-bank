# Health Data Bank Audit Report
Date: 2026-03-30
Mode: Read-only audit (no code changes made)

## Scope
- Backend tests
- Frontend lint/build
- Migration graph consistency
- API wiring consistency
- Admin-path checks

## Summary
- Critical issues: 2
- High issues: 2
- Medium issues: 4
- Low inconsistencies: 4

## Critical
1. Alembic revision ID collision (two 0006 heads from same parent)
- backend/alembic/versions/0006_add_onboarding_tables.py:19
- backend/alembic/versions/0006_submission_answers_composite_pk.py:16

2. Migration chain gap (0010 points to missing 0009)
- backend/alembic/versions/0010_admin_caretaker_profile_updates.py:13
- No 0009 file exists in backend/alembic/versions

## High
1. JSX parse error in admin dashboard (duplicate prop line)
- frontend/src/pages/admin/AdminDashboard.jsx:299

2. Backend config can crash on env parsing (DEBUG expects boolean)
- backend/app/core/config.py:13
- Observed failure when env provides non-boolean string (example seen: release)

## Medium
1. Backend test run blocked at import due to missing multipart dependency in active environment
- Route needing multipart: backend/app/api/routes/admin_only.py:202
- Present in backend deps: backend/requirements.txt:14
- Missing from root deps: requirements.txt

2. Frontend lint currently failing broadly
- Result: 51 errors, 11 warnings
- Main categories: react purity/set-state-in-effect, empty blocks, unused vars, hook deps

3. Stale/inaccurate TODO comments in frontend API client (backend endpoints now exist)
- frontend/src/services/api.js:142
- frontend/src/services/api.js:145
- frontend/src/services/api.js:194

4. Build size warning: large JS bundle (~1.4 MB minified)
- Reported during production build

## Low (Consistency)
1. File naming typos/inconsistency
- frontend/src/pages/researcher/DataElementMangaer.jsx
- frontend/src/pages/researcher/Group_Chorts.jsx

2. Route module naming inconsistency (capitalized file)
- backend/app/api/routes/Caretakers.py

3. Mixed migration style (typed revision vars vs plain assignment)
- Example typed: backend/alembic/versions/0007_add_fk_and_perf_indexes.py:15
- Example plain: backend/alembic/versions/0008_admin_profile_onboarding.py:11

4. Root .env key style does not align with app settings model fields
- Increases config confusion risk

## Checks Run
- pytest -q (backend): failed during import/config/dependency setup
- npm run lint (frontend): failed with 51 errors and 11 warnings
- npm run build (frontend): build completed with JSX warning and bundle-size warning
