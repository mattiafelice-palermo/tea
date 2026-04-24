# Battery TEA MVP

Minimal full-stack web application for battery techno-economic analysis using:

- Next.js App Router + TypeScript
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic

## Structure

```text
/backend
  /app
  /alembic
  main.py
/frontend
  /src
    /app
    /lib
    /types
docker-compose.yml
```

## Run with Docker Compose

```bash
docker compose up --build
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:8000`

## Run both apps from the root

```bash
npm install
npm --prefix frontend install
npm run dev
```

This starts:

- Next.js on `http://localhost:3000`
- FastAPI on `http://localhost:8000`

The root dev script expects Python backend dependencies to already be installed in the
environment used by `python`.

For local development it now uses SQLite by default at `backend/battery_tea.db`, so it does not
require Docker or a local PostgreSQL install.

It also runs Alembic migrations automatically before starting FastAPI.

## Backend local setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python seed.py
uvicorn main:app --reload
```

To force PostgreSQL instead of SQLite for local backend runs, set `DATABASE_URL` explicitly before
starting the server.

## Frontend local setup

```bash
cd frontend
npm install
npm run dev
```
