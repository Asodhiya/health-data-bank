# Onboarding Test Audit Report

Date: 2026-03-30  
Workspace: `C:\Users\nbkka\health-data-bank`

## Scope
- Participant onboarding flow UI/logic:
  - Background info
  - Consent
  - Intake
- Role onboarding profile flows:
  - Admin onboarding
  - Researcher onboarding
  - Caretaker onboarding
- Backend onboarding/auth edge cases

## Commands Run
1. `pytest -q backend/tests/routes/test_goal_audit_auth_edgecases.py`
2. `pytest -q backend/tests` (first run)
3. `$env:DEBUG='false'; pytest -q backend/tests` (second run)
4. `$env:DEBUG='false'; pytest -q backend/tests -k onboarding`
5. `npm run build` (frontend)
6. `npm run lint` (frontend)

## Results Summary
- Backend onboarding/auth edge routes: PASS
  - `15 passed` in `test_goal_audit_auth_edgecases.py`
- Backend full suite: PARTIAL FAIL (not onboarding-specific)
  - `133 passed, 20 failed`
  - Failures are mainly form-management service signature mismatch tests and historical "bug-before" tests.
- Backend onboarding-filtered tests: PASS
  - `1 passed, 152 deselected`
- Frontend build: BLOCKED IN ENV
  - Vite/esbuild failed with `spawn EPERM` (environment/process permission issue).
- Frontend lint: FAIL
  - Many pre-existing lint errors across app; onboarding-specific notes listed below.

## High-Risk Onboarding Findings

### 1) Consent page does not submit to backend
- File: `frontend/src/pages/onboarding/ConsentPage.jsx:102`
- Evidence:
  - Backend call is commented out:
    - `// await api.submitConsent(payload);`
  - Flow currently only clears session storage and navigates to intake.
- Impact:
  - Participant can proceed without persisted consent record.
  - `onboarding_status` may not become `CONSENT_GIVEN`.

### 2) Background page does not mark "background read"
- File: `frontend/src/pages/onboarding/BackgroundInfoPage.jsx:300`
- Evidence:
  - Continue button navigates directly to `/onboarding/consent`.
  - No API call to `POST /onboarding/background-read`.
- Impact:
  - Backend status transition `PENDING -> BACKGROUND_READ` is skipped.

### 3) Frontend API client lacks participant onboarding endpoints
- Evidence:
  - `frontend/src/services/api.js` has intake calls, but no active methods for:
    - `POST /onboarding/background-read`
    - `POST /onboarding/consent`
    - `POST /onboarding/complete`
- Impact:
  - UI cannot execute full backend onboarding state machine.

## Medium Findings

### 4) Admin onboarding page has lint issues
- File: `frontend/src/pages/admin/AdminOnboardingPage.jsx:1`
- Evidence:
  - Unused imports: `useEffect`, `useCallback`.
- Impact:
  - Not functionally blocking, but indicates cleanup debt.

### 5) Existing onboarding gate checks are correctly wired
- Files:
  - `frontend/src/components/AdminRoute.jsx`
  - `frontend/src/components/CaretakerRoute.jsx`
  - `frontend/src/components/ResearcherRoute.jsx`
  - `frontend/src/components/ParticipantRoute.jsx`
- Notes:
  - Redirect logic and role-gating appear consistent.
  - Researcher profile upsert-on-patch is present in backend:
    - `backend/app/api/routes/researcher.py:39-51`.

## What This Means Right Now
- Admin/caretaker/researcher profile onboarding can submit.
- Participant onboarding UI can appear to complete in frontend, but consent/background status persistence is incomplete due to missing API wiring.

## Recommended Next Fix Batch
1. Add API methods in `frontend/src/services/api.js`:
   - `onboardingMarkBackgroundRead()`
   - `onboardingSubmitConsent(payload)`
   - `onboardingComplete()`
2. Wire background page continue action to `onboardingMarkBackgroundRead()` before navigate.
3. Wire consent submit to backend (`onboardingSubmitConsent`) and handle errors.
4. On successful intake submission, call `onboardingComplete()` (or enforce sequence from backend policy).
5. Add at least one frontend integration test harness (Vitest + React Testing Library) for onboarding flows.

