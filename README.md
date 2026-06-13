# Distributed Job Execution Platform

Monorepo layout:

- `backend/` - Express.js API server with MongoDB, Redis, BullMQ, JWT auth, and Socket.io.
- `worker/` - standalone BullMQ worker process with backend heartbeat reporting.
- `frontend/` - React Vite frontend for jobs, workers, auth, and realtime progress.
- `docker-compose.yml` - local MongoDB and Redis containers.
- `.env.example` - all environment variables used by the project.

## Local Setup

```bash
docker compose up -d
```

In separate terminals:

```bash
cd backend
npm install
npm run dev
```

```bash
cd worker
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Copy `.env.example` into `backend/.env` and `worker/.env` before running services locally.
