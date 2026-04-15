# Migrating from Supabase to Another PostgreSQL Server

This document explains how to move Health Data Bank from a Supabase-hosted PostgreSQL instance to another PostgreSQL server such as AWS RDS, Google Cloud SQL, Azure Database for PostgreSQL, or a self-managed PostgreSQL deployment.

## Executive Summary

This application is already built around direct PostgreSQL access through SQLAlchemy and asyncpg, not around the Supabase client SDK.

That means the migration is mostly an infrastructure and database migration, not an application rewrite.

The main tasks are:

- Provision a PostgreSQL server with the required features enabled.
- Run the existing schema and migrations on the new server.
- Move existing data.
- Update backend environment variables to point at the new server.
- Validate row-level security, authentication, and key user workflows.
- Remove or update Supabase-specific documentation and labels.

## Why This Migration Is Feasible

The current codebase already uses:

- Direct PostgreSQL connection assembly in [backend/app/db/db.py](../../backend/app/db/db.py)
- Backend-managed JWT auth in [backend/app/core/security.py](../../backend/app/core/security.py)
- Backend-managed session and request authorization in [backend/app/core/dependency.py](../../backend/app/core/dependency.py)
- Frontend API calls to the FastAPI backend in [frontend/src/services/api.js](../../frontend/src/services/api.js)

The frontend does not currently use the Supabase JavaScript SDK.

## What Is Actually Coupled to PostgreSQL

The app relies on standard PostgreSQL features and some PostgreSQL-specific behavior. Your replacement server must support all of the following.

### Required Database Features

- PostgreSQL 15 or newer recommended
- `pgcrypto` extension for `gen_random_uuid()`
- JSONB columns
- partial indexes
- row-level security policies
- custom SQL functions used for request-scoped RLS context

Examples in the codebase:

- UUID and JSONB model usage in [backend/app/db/models.py](../../backend/app/db/models.py)
- `pgcrypto` bootstrap in [backend/scripts/bootstrap_local_db.py](../../backend/scripts/bootstrap_local_db.py)
- RLS helper functions in [backend/alembic/versions/0039_rls_setup.py](../../backend/alembic/versions/0039_rls_setup.py)
- RLS policies in [backend/alembic/versions/0040_notifications_rls.py](../../backend/alembic/versions/0040_notifications_rls.py), [backend/alembic/versions/0041_forms_and_deployments_rls.py](../../backend/alembic/versions/0041_forms_and_deployments_rls.py), [backend/alembic/versions/0042_submissions_rls.py](../../backend/alembic/versions/0042_submissions_rls.py), [backend/alembic/versions/0043_health_data_points_rls.py](../../backend/alembic/versions/0043_health_data_points_rls.py), [backend/alembic/versions/0044_health_goals_rls.py](../../backend/alembic/versions/0044_health_goals_rls.py), [backend/alembic/versions/0045_participant_profile_rls.py](../../backend/alembic/versions/0045_participant_profile_rls.py), [backend/alembic/versions/0046_goal_templates_rls.py](../../backend/alembic/versions/0046_goal_templates_rls.py), and [backend/alembic/versions/0047_users_rls.py](../../backend/alembic/versions/0047_users_rls.py)

## What Is Currently Supabase-Specific

The main Supabase-specific items in the repository today are operational and documentation-related.

### Current Supabase Dependencies

- The live database host value in the backend environment file
- Supabase references in docs and UI labels
- local tooling references such as `.mcp.json` and README instructions

Examples:

- Current host example in [backend/.env](../../backend/.env)
- Supabase references in [README.md](../../README.md)
- Admin UI labels in [frontend/src/pages/admin/SystemSettingsPage.jsx](../../frontend/src/pages/admin/SystemSettingsPage.jsx)

### What Is Not Supabase-Specific

- authentication implementation
- JWT token creation
- API authorization
- frontend data access
- SQLAlchemy models and query layer

## Migration Options

### Option 1: Managed PostgreSQL

Recommended for most teams.

Examples:

- AWS RDS for PostgreSQL
- Google Cloud SQL for PostgreSQL
- Azure Database for PostgreSQL
- Neon, Crunchy Bridge, Render PostgreSQL, Railway PostgreSQL

Pros:

- easier backups and failover
- less operational burden
- TLS and monitoring usually built in

Cons:

- platform-specific pricing and network controls
- extension support varies by provider

### Option 2: Self-Managed PostgreSQL

Use this only if you are prepared to operate PostgreSQL directly.

Pros:

- full control over configuration
- full access to extensions and tuning

Cons:

- backups, failover, patching, and monitoring become your responsibility
- higher risk during incidents

## Preconditions Before Cutover

Before switching production traffic, confirm all of the following.

- The new PostgreSQL server is reachable from the backend runtime.
- The new PostgreSQL server allows TLS if your environment requires it.
- `pgcrypto` can be enabled.
- The DB user has the privileges needed to run migrations.
- Alembic migrations can run successfully from the backend.
- Backup and restore procedures are defined for the new platform.
- Connection limits match application pooling settings.
- Firewall or security group rules permit app-to-database traffic.

## Environment Variables That Need Review

The backend database connection is composed from the values documented in [docs/architecture/environment_variables_checklist.md](./environment_variables_checklist.md).

At minimum, review these variables:

- `user`
- `password`
- `host`
- `port`
- `dbname`
- `DB_SSLMODE`
- `DB_POOL_SIZE`
- `DB_MAX_OVERFLOW`
- `DB_POOL_TIMEOUT`
- `DB_POOL_RECYCLE`

The connection string is assembled in [backend/app/db/db.py](../../backend/app/db/db.py).

## Recommended Migration Strategy

Use a staged migration rather than editing production configuration first.

### Phase 1: Provision the New Database

1. Create the PostgreSQL instance.
2. Create the application database.
3. Create the application database user.
4. Enable `pgcrypto`.
5. Verify network access from the backend environment.
6. Decide whether SSL should be required or disabled and set `DB_SSLMODE` accordingly.

### Phase 2: Initialize Schema

Use one of these approaches.

#### Preferred: Run Alembic Migrations on the New Database

This is the cleanest approach when creating a new environment.

Steps:

1. Point the backend environment variables to the new PostgreSQL server.
2. Run Alembic migrations against the new database.
3. Confirm RLS helper functions and policies are present.
4. Run any seed/bootstrap scripts needed for roles, permissions, and baseline data.

Relevant files:

- [backend/alembic/env.py](../../backend/alembic/env.py)
- [backend/scripts/bootstrap_local_db.py](../../backend/scripts/bootstrap_local_db.py)
- [backend/scripts/setup_db.py](../../backend/scripts/setup_db.py)

#### Alternative: Restore a Full Database Dump

This is usually faster for a production migration if you need all data, history, and schema exactly as-is.

Recommended dump contents:

- schema
- data
- indexes
- constraints
- functions
- row-level security policies
- extension requirements

After restore, still verify the current Alembic revision and run a migration status check.

### Phase 3: Data Migration

If you are moving live production data, plan for one of these patterns.

#### Low-Downtime Approach

1. Freeze schema changes.
2. Take a fresh database backup or dump from the source.
3. Restore into the target server.
4. Put the application into maintenance mode.
5. Capture final delta data or perform a final full refresh.
6. Switch application configuration to the new target.
7. Validate critical flows.
8. Re-enable user access.

#### Maintenance Window Approach

1. Announce downtime.
2. Stop writes.
3. Take final export.
4. Restore to new server.
5. Point backend to the new server.
6. Run smoke tests.
7. Bring the system back online.

## Application Changes Required

### Required Changes

- update database host and credentials in environment configuration
- update deployment secrets
- update any infrastructure runbooks that mention Supabase

### Strongly Recommended Cleanup

- replace Supabase references in [README.md](../../README.md)
- replace Supabase wording in [frontend/src/pages/admin/SystemSettingsPage.jsx](../../frontend/src/pages/admin/SystemSettingsPage.jsx)
- update any onboarding or deployment docs that instruct developers to run Supabase locally

### Changes You Probably Do Not Need

- no frontend SDK rewrite
- no auth rewrite
- no ORM replacement
- no API contract changes

## Validation Checklist After Migration

After switching to the new database, validate all of the following.

### Database Connectivity

- backend starts successfully
- health endpoint can reach the database
- migrations report the expected current revision

### Authentication and Sessions

- login works
- logout works
- session expiry behaves correctly
- password reset flow works
- invite-based registration works

### Authorization and RLS

- admin can access admin-only resources
- researcher can access researcher data
- participant sees only participant-owned data
- caretaker sees only caretaker-visible data
- cross-role leakage does not occur

Because this application uses request-scoped RLS context, verify the behavior controlled by [backend/app/core/dependency.py](../../backend/app/core/dependency.py).

### Functional Smoke Tests

- create and edit a user
- submit onboarding
- publish and unpublish a form
- submit a survey
- create and read notifications
- create and update a goal
- view role-specific dashboards

### Backup and Recovery

- take a backup on the new platform
- restore the backup into a non-production environment
- verify the restored environment is usable

## Rollback Plan

Do not migrate without a rollback plan.

Minimum rollback plan:

1. Keep the original Supabase database unchanged until cutover validation passes.
2. Preserve the previous environment secrets.
3. If validation fails, point the backend configuration back to the original database.
4. Re-run smoke tests.
5. Investigate and retry later.

If writes were allowed on the new system before rollback, define how those writes will be reconciled. Without that plan, rollback can lose data.

## Common Failure Modes

### Missing `pgcrypto`

Symptoms:

- inserts fail on UUID defaults
- migrations fail around `gen_random_uuid()`

Mitigation:

- enable `pgcrypto` before running schema setup

### RLS Policies Exist but Context Is Not Set

Symptoms:

- empty query results for authenticated users
- unexpected permission-denied behavior

Mitigation:

- verify request handling still executes the context setters in [backend/app/core/dependency.py](../../backend/app/core/dependency.py)
- verify the helper functions from [backend/alembic/versions/0039_rls_setup.py](../../backend/alembic/versions/0039_rls_setup.py) exist on the target database

### SSL Misconfiguration

Symptoms:

- connection failures during backend startup
- connection resets or handshake failures

Mitigation:

- set `DB_SSLMODE` correctly for the provider
- verify whether the target requires certificate validation or just encrypted transport

### Connection Pool Settings Too Aggressive

Symptoms:

- timeouts under load
- connection limit exhaustion

Mitigation:

- tune `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, and database connection limits together

## Suggested Execution Checklist

- [ ] Select the target PostgreSQL provider
- [ ] Confirm PostgreSQL version and extension support
- [ ] Provision database and credentials
- [ ] Enable `pgcrypto`
- [ ] Initialize schema or restore database dump
- [ ] Verify Alembic revision state
- [ ] Update backend environment variables
- [ ] Deploy backend pointing to the new server
- [ ] Run authentication smoke tests
- [ ] Run role and RLS smoke tests
- [ ] Run core workflow smoke tests
- [ ] Update docs and UI text that still mention Supabase
- [ ] Keep rollback path available until production validation is complete

## Recommended Follow-Up Work in This Repository

After the database migration is complete, consider these repo cleanup tasks.

1. Update README so it no longer claims Supabase Auth is in use.
2. Replace provider-branded UI labels with provider-neutral wording.
3. Add an example environment file for generic PostgreSQL deployments.
4. Add a deployment runbook for your chosen infrastructure target.

## Bottom Line

Health Data Bank can be moved off Supabase without a major application rewrite.

This is primarily a PostgreSQL infrastructure migration with configuration, validation, and documentation cleanup work around it. The biggest technical risks are preserving PostgreSQL features, preserving row-level security behavior, and executing a clean data cutover.