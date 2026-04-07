# Environment Variables Checklist & Validation

This document lists the environment variables currently required by the Health Data Bank app and how to validate them safely without exposing secret values.

## Required Variables

### Database

The backend database connection is assembled from these variables in [db.py](/c:/Users/nbkka/health-data-bank/backend/app/db/db.py):

- `user`
- `password`
- `host`
- `port`
- `dbname`

Optional database tuning variables:

- `DB_SSLMODE`
- `DB_POOL_SIZE`
- `DB_MAX_OVERFLOW`
- `DB_POOL_TIMEOUT`
- `DB_POOL_RECYCLE`

Validation:

- Confirm all five required DB fields are present.
- Confirm `port` is numeric.
- Confirm the backend starts without `RuntimeError("DATABASE_URL not set")`.
- Confirm the app can connect and serve an authenticated API request.

### JWT / Auth

Used in [security.py](/c:/Users/nbkka/health-data-bank/backend/app/core/security.py):

- `JWT_SECRET`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

Validation:

- Confirm `JWT_SECRET` is present and non-empty.
- Confirm `JWT_ALGORITHM` is set to the expected signing algorithm.
- Confirm `ACCESS_TOKEN_EXPIRE_MINUTES` is numeric.
- Confirm login succeeds and returned tokens decode correctly in backend tests.

### Email

Used in [email_sender.py](/c:/Users/nbkka/health-data-bank/backend/app/services/email_sender.py):

- `EMAIL_USER`
- `EMAIL_PASS`

Validation:

- Confirm both values are present.
- Confirm invite or reset-email flows do not fail with missing SMTP credentials.
- Confirm the configured sender account can authenticate to SMTP.

### Frontend URL

Used in:

- [config.py](/c:/Users/nbkka/health-data-bank/backend/app/core/config.py)
- [auth_service.py](/c:/Users/nbkka/health-data-bank/backend/app/services/auth_service.py)
- [security.py](/c:/Users/nbkka/health-data-bank/backend/app/core/security.py)

Required variable:

- `FRONTEND_URL`

Validation:

- Confirm it points to the correct deployed frontend origin.
- Confirm password reset and invite links open the correct frontend route.
- Confirm CORS allows requests from that origin.

## Frontend Runtime Variable

Used in [api.js](/c:/Users/nbkka/health-data-bank/frontend/src/services/api.js) and [vite.config.js](/c:/Users/nbkka/health-data-bank/frontend/vite.config.js):

- `VITE_API_URL`
- `VITE_API_PROXY_TARGET`

Validation:

- Confirm frontend API requests resolve to the expected backend base URL.
- Confirm local development proxy works if `VITE_API_URL` is not set.

## Validation Checklist

- [ ] Database variables are present: `user`, `password`, `host`, `port`, `dbname`
- [ ] JWT variables are present: `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- [ ] Email variables are present: `EMAIL_USER`, `EMAIL_PASS`
- [ ] Frontend origin is present: `FRONTEND_URL`
- [ ] Frontend runtime API variable is documented: `VITE_API_URL` or proxy target
- [ ] Backend starts successfully with current environment
- [ ] Login works
- [ ] Invite email flow works
- [ ] Password reset link points to the correct frontend origin

## Security Notes

- Do not commit live secrets into the repository.
- Use example values or placeholders in documentation only.
- If real credentials were previously committed to `.env` files, rotate them.

## Current Repository Notes

The current repo already references these variables directly in code, and the checklist above matches the live implementation as of April 7, 2026.
