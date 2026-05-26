# Multi-Tenant Inventory Management System

A SaaS-style inventory management platform built with React, FastAPI, PostgreSQL, and Docker.

## Project Structure

```text
inventory-management-system/
├── frontend/
├── backend/
├── docs/
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Local Setup

This project is currently configured for local development without Docker.

Create the local database in PostgreSQL:

```bash
createdb inventory
```

If your local PostgreSQL user is different, update `backend/.env`.

Backend environment:

```bash
cp backend/.env.example backend/.env
```

Frontend environment:

```bash
cp frontend/.env.example frontend/.env
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python scripts/seed_all.py
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Local services:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Docker Setup

Docker support is available, but local setup is the default during development.

Copy the root sample environment file before running Docker:

```bash
cp .env.example .env
```

Run the full stack:

```bash
docker compose up --build
```

## Manual Development Commands

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
# GENAI_CAPstone
# gensai_codebackeup
# gensai_codebackeup
