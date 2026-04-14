# Health Data Bank

A secure web application for community health programs supporting Participants, Caretakers, Researchers, and Administrators.

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)

## Overview

Health Data Bank enables multiple stakeholder roles to interact with health information in a controlled, privacy-conscious manner.

| Role | Capabilities |
|------|--------------|
| **Participant** | Complete onboarding (background, consent, intake), fill assigned surveys, track health goals, view a personal health summary, send feedback |
| **Caretaker** | Monitor assigned participants, view participant submissions and goals, generate reports, respond to messages |
| **Researcher** | Build surveys, manage data elements, assign participants to groups/cohorts, view submissions |
| **Admin** | Manage users and roles, configure system settings, onboarding management, goal templates, audit logs, backup/restore, messages/feedback, system insights |

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Tailwind CSS, React Router, Recharts |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy (async), Alembic |
| **Database** | PostgreSQL with Row-Level Security |
| **Cache / Rate limit** | Redis |
| **Auth** | Session-based authentication with RBAC (permission-based guards) |
| **Runtime** | Docker, Docker Compose |

## Project Structure

```
health-data-bank/
├── frontend/                 # React + Vite application
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── pages/            # Pages grouped by role (admin, caretaker, participant, researcher, auth, onboarding, shared)
│       ├── layouts/          # Dashboard, auth, and onboarding layouts
│       ├── hooks/            # Custom React hooks (e.g. useDebounced)
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
│       ├── seeds/            # RBAC seed data
│       ├── services/         # Business logic
│       └── utils/            # Shared helpers
│
├── docs/                     # Architecture notes
└── docker-compose.yml        # Multi-service dev stack
```

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A reachable PostgreSQL database (connection string configured via `backend/.env`)

### Run with Docker (recommended)

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd health-data-bank
   ```

2. **Configure environment**
   - Create `backend/.env` with the required variables (see [docs/architecture/environment_variables_checklist.md](docs/architecture/environment_variables_checklist.md)).

3. **Start the stack**
   ```bash
   docker compose up --build
   ```

4. **Apply database migrations** (first-time only, or when new migrations land)
   ```bash
   docker compose exec backend alembic upgrade head
   ```

5. **Access the application**

   | Service | URL |
   |---------|-----|
   | Frontend | http://localhost:5173 |
   | Backend API | http://localhost:8000 |
   | API Docs (Swagger) | http://localhost:8000/docs |

### Manual Setup (without Docker)

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Database Notes

The application talks directly to PostgreSQL through SQLAlchemy and asyncpg. It does not require the Supabase frontend SDK.

For migration guidance from Supabase-hosted PostgreSQL to another PostgreSQL server, see [docs/architecture/postgresql-migration-from-supabase.md](docs/architecture/postgresql-migration-from-supabase.md).

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `feature/*` | New features |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Urgent production fixes |

### Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `refactor:` | Code restructuring |
| `test:` | Tests |
| `chore:` | Maintenance |

## Testing

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test
```

## Team

| Name | Role |
|------|------|
| Nayan Karki | Developer |
| Najid Mir | Developer |
| Nima Sherpa | Developer |
| Job Dominic Sobrecaray | Developer |
| Akshit Sodhiya | Developer |

**Client:** Dr. William Montelpare, UPEI
**Course:** CS 4820 — Software Engineering Project

## License

Academic project developed for CS 4820 at the University of Prince Edward Island.
