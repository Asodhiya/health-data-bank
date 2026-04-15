# Health Data Bank

A secure web application for community health programs supporting Participants, Caretakers, Researchers, and Administrators.

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)

## Overview

Health Data Bank enables multiple stakeholder roles to interact with health information in a controlled, privacy-conscious manner.

| Role            | Capabilities                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Participant** | Complete onboarding (background, consent, intake), fill assigned surveys, track health goals, view a personal health summary, send feedback              |
| **Caretaker**   | Monitor assigned participants, view participant submissions and goals, generate reports, respond to messages                                             |
| **Researcher**  | Build surveys, manage data elements, assign participants to groups/cohorts, view submissions                                                             |
| **Admin**       | Manage users and roles, configure system settings, onboarding management, goal templates, audit logs, backup/restore, messages/feedback, system insights |

## Tech Stack

| Layer                  | Technology                                                       |
| ---------------------- | ---------------------------------------------------------------- |
| **Frontend**           | React 19, Vite, Tailwind CSS, React Router, Recharts             |
| **Backend**            | Python 3.11+, FastAPI, SQLAlchemy (async), Alembic               |
| **Database**           | PostgreSQL 15+ with Row-Level Security                           |
| **Cache / Rate limit** | Redis 7                                                          |
| **Auth**               | Session-based authentication with RBAC (permission-based guards) |
| **Runtime**            | Docker, Docker Compose                                           |

## Project Structure

```
health-data-bank/
├── frontend/                 # React + Vite application
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── pages/            # Pages grouped by role
│       ├── layouts/          # Dashboard, auth, and onboarding layouts
│       ├── hooks/            # Custom React hooks
│       ├── services/         # API client (api.js)
│       ├── contexts/         # Auth context
│       ├── config/           # Navigation config
│       └── utils/            # Formatters, helpers
│
├── backend/                  # FastAPI application
│   ├── alembic/              # Database migrations
│   ├── scripts/              # Database setup and maintenance scripts
│   └── app/
│       ├── api/routes/       # API endpoints grouped by domain
│       ├── core/             # Config, security
│       ├── db/               # SQLAlchemy models and queries
│       ├── middleware/       # Session, rate-limit, logging middleware
│       ├── schemas/          # Pydantic schemas
│       ├── seeds/            # RBAC and initial data seeds
│       ├── services/         # Business logic
│       └── utils/            # Shared helpers
│
├── docs/                     # Architecture notes
└── docker-compose.yml        # Full stack (Postgres, Redis, backend, frontend)
```

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

That's it. Docker Compose runs PostgreSQL, Redis, the backend, and the frontend — no external services required.

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd health-data-bank
   ```

2. **Create the backend environment file**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Then open `backend/.env` and set at minimum:
   - `JWT_SECRET` — run `python -c "import secrets; print(secrets.token_hex(32))"` to generate one
   - `FIRST_ADMIN_EMAIL` — the email for the initial admin account

   All other values have working defaults. See [backend/.env.example](backend/.env.example) for the full list.

3. **Start the stack**

   ```bash
   docker compose up --build
   ```

   On first start the backend will automatically:
   - Create all database tables
   - Seed roles and permissions (admin, researcher, caretaker, participant)
   - Create the first admin account (credentials printed in the backend logs)

4. **Access the application**

   | Service            | URL                        |
   | ------------------ | -------------------------- |
   | Frontend           | http://localhost:5173       |
   | Backend API        | http://localhost:8000       |
   | API Docs (Swagger) | http://localhost:8000/docs  |

5. **Apply database migrations** (only when new migrations are added after initial setup)

   ```bash
   docker compose exec backend alembic upgrade head
   ```

### Manual Setup (without Docker)

Requires PostgreSQL 15+, Python 3.11+, Node.js 18+, and Redis running locally.

**Backend**

```bash
cd backend
cp .env.example .env        # edit .env with your DB credentials and secrets
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
python scripts/setup_db.py   # first-time only — creates tables, seeds roles
uvicorn app.main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## First Admin Account

On a fresh database the backend creates an admin user using the `FIRST_ADMIN_*` variables in `backend/.env`. If `FIRST_ADMIN_PASSWORD` is left blank, a random password is generated and printed in the backend container logs:

```bash
docker compose logs backend | grep "first-admin"
```

Change this password immediately after first login.

## Database Notes

The application connects to PostgreSQL through SQLAlchemy and asyncpg. It does not use the Supabase client SDK — any standard PostgreSQL 15+ server works.

Docker Compose includes a Postgres container with a persistent volume (`pgdata`), so data survives `docker compose down`. To fully reset the database, remove the volume:

```bash
docker compose down -v
```

For migration guidance from Supabase-hosted PostgreSQL to a self-hosted server, see [docs/architecture/postgresql-migration-from-supabase.md](docs/architecture/postgresql-migration-from-supabase.md).

## Environment Variables

All backend configuration is managed through `backend/.env`. See [backend/.env.example](backend/.env.example) for the full list with descriptions.

| Variable               | Required | Description                                      |
| ---------------------- | -------- | ------------------------------------------------ |
| `JWT_SECRET`           | Yes      | Secret key for signing auth tokens               |
| `FIRST_ADMIN_EMAIL`    | Yes      | Email for the auto-created admin account          |
| `EMAIL_USER`/`EMAIL_PASS` | No    | Gmail credentials for password-reset emails      |
| `DB_SSLMODE`           | No       | Set to `require` for remote Postgres, `disable` for local (Docker default: `disable`) |

Database connection vars (`user`, `password`, `host`, `port`, `dbname`) are set automatically by Docker Compose. Only configure them manually if running without Docker.

## Development Workflow

### Branch Strategy

| Branch      | Purpose                 |
| ----------- | ----------------------- |
| `main`      | Production-ready code   |
| `feature/*` | New features            |
| `bugfix/*`  | Bug fixes               |
| `hotfix/*`  | Urgent production fixes |

### Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | Usage              |
| ----------- | ------------------ |
| `feat:`     | New feature        |
| `fix:`      | Bug fix            |
| `docs:`     | Documentation      |
| `refactor:` | Code restructuring |
| `test:`     | Tests              |
| `chore:`    | Maintenance        |

## Testing

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test
```

## Team

| Name                   | Role      |
| ---------------------- | --------- |
| Nayan Karki            | Developer |
| Najid Mir              | Developer |
| Nima Sherpa            | Developer |
| Job Dominic Sobrecaray | Developer |
| Akshit Sodhiya         | Developer |

**Client:** Dr. William Montelpare, UPEI
**Course:** CS 4820 — Software Engineering Project

## License

Academic project developed for CS 4820 at the University of Prince Edward Island.
