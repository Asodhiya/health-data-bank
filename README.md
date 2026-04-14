# 🏥 Health Data Bank

A secure web application for community health programs supporting Participants, Caretakers, Researchers, and Administrators.

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)

## 📋 Overview

Health Data Bank enables multiple stakeholder roles to interact with health information in a controlled, privacy-conscious manner:

| Role | Capabilities |
|------|--------------|
| **Participant** | Submit health surveys, track personal goals, view progress reports |
| **Caretaker** | Monitor assigned participants, provide feedback, generate group reports |
| **Researcher** | Create survey forms, generate aggregated reports, export anonymized data |
| **Admin** | Manage users/roles, view audit logs, perform backup/restore |

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Tailwind CSS |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Database** | PostgreSQL |
| **Auth** | Backend-managed JWT + session-based auth |
| **Runtime** | Docker, Docker Compose |

## 📁 Project Structure

```
health-data-bank/
├── frontend/               # React application
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page components by role
│       ├── hooks/          # Custom React hooks
│       ├── services/       # API service functions
│       └── context/        # React context providers
│
├── backend/                # FastAPI application
│   └── app/
│       ├── api/routes/     # API endpoints
│       ├── core/           # Config, security
│       ├── models/         # Database models
│       ├── schemas/        # Pydantic schemas
│       └── services/       # Business logic
│
├── backend/alembic/        # Database migrations
├── backend/scripts/        # Database setup and maintenance scripts
│
├── docs/                   # Documentation
└── .github/                # CI/CD & templates
```

## 🚀 Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [PostgreSQL 15+](https://www.postgresql.org/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/health-data-bank.git
   cd health-data-bank
   ```

2. **Set up backend environment variables**
   ```bash
   # Configure backend/.env with your PostgreSQL and app credentials
   ```

   Required values are documented in [docs/architecture/environment_variables_checklist.md](docs/architecture/environment_variables_checklist.md).

3. **Initialize the database**
   ```bash
   cd backend
   python scripts/setup_db.py
   ```

4. **Start with Docker**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   | Service | URL |
   |---------|-----|
   | Frontend | http://localhost:3000 |
   | Backend API | http://localhost:8000 |
   | API Docs | http://localhost:8000/docs |

### Manual Setup (Without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python scripts/setup_db.py
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🗄 Database Notes

The application talks directly to PostgreSQL through SQLAlchemy and asyncpg. It does not require the Supabase frontend SDK.

For migration guidance from Supabase-hosted PostgreSQL to another PostgreSQL server, see [docs/architecture/postgresql-migration-from-supabase.md](docs/architecture/postgresql-migration-from-supabase.md).

## 💻 Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code only |
| `develop` | Integration branch for features |
| `feature/*` | New features (e.g., `feature/user-auth`) |
| `bugfix/*` | Bug fixes |
| `hotfix/*` | Urgent production fixes |

### Creating a Feature

```bash
# 1. Update develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and commit
git add .
git commit -m "feat: add user authentication"

# 4. Push and create PR
git push origin feature/your-feature-name
```

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `style:` | Formatting (no code change) |
| `refactor:` | Code restructuring |
| `test:` | Adding tests |
| `chore:` | Maintenance |

**Examples:**
```
feat: add participant dashboard
fix: resolve login redirect loop
docs: update API endpoint documentation
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 👥 Team

| Name | Role |
|------|------|
| Nayan Karki | Developer |
| Najid Mir | Developer |
| Nima Sherpa | Developer |
| Job Dominic Sobrecaray | Developer |
| Akshit Sodhiya | Developer |

**Client:** Dr. William Montelpare, UPEI  
**Course:** CS 4820 - Software Engineering Project

## 📄 License

Academic project developed for CS 4820 at the University of Prince Edward Island.

---

<p align="center">Built with ❤️ for community health</p>
