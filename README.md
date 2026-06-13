# Distributed Job Execution Platform

A background job processing system where users can submit computational jobs that execute asynchronously across distributed workers. The platform handles job scheduling, priority queuing, real-time monitoring, automatic retries, and worker crash recovery.

---

## What It Does

You submit a job. It goes into a priority queue. A worker picks it up and executes it. You watch the progress live. If the worker crashes, the system recovers automatically. If the job fails, it retries automatically. Everything is logged and stored permanently.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Zustand, Socket.io-client, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB (permanent storage) |
| Queue | Redis + BullMQ |
| Real-time | Socket.io |
| Auth | JWT (jsonwebtoken) |

---

## System Architecture

```
┌─────────────────────────────────────┐
│           React Frontend             │
└────────────┬────────────────┬────────┘
             │ REST           │ Socket.io
             ▼                ▼
┌─────────────────────────────────────┐
│         Express API Server           │
│         + Recovery Service           │
└──────────┬──────────────────┬────────┘
           │                  │
           ▼                  ▼
    ┌─────────────┐   ┌──────────────────┐
    │   MongoDB   │   │  Redis + BullMQ  │
    └─────────────┘   └────────┬─────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  Worker Process  │
                      └─────────────────┘
```

---

## Prerequisites

- Node.js v18 or higher
- MongoDB running locally
- Redis running locally

### Install MongoDB
- **Mac:** `brew install mongodb-community` then `brew services start mongodb-community`
- **Windows:** Download from https://www.mongodb.com/try/download/community
- **Linux:** `sudo apt install mongodb` then `sudo service mongodb start`

### Install Redis
- **Mac:** `brew install redis` then `brew services start redis`
- **Windows:** Download from https://github.com/microsoftarchive/redis/releases
- **Linux:** `sudo apt install redis-server` then `sudo service redis start`

### Verify both are running
```bash
mongosh --eval "db.adminCommand('ping')"
redis-cli ping
```
Both should respond without errors. Redis should reply `PONG`.

---

## Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd <project-folder>
```

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Install worker dependencies
```bash
cd ../worker
npm install
```

### 4. Install frontend dependencies
```bash
cd ../frontend
npm install
```

---

## Environment Configuration

### Backend — `backend/.env`
Copy the example file and fill in your values:
```bash
cp backend/.env.example backend/.env
```

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/jobplatform
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
MAX_JOB_RETRIES=3
JOB_RETRY_DELAY_MS=5000
```

### Worker — `worker/.env`
```bash
cp worker/.env.example worker/.env
```

```env
MONGODB_URI=mongodb://localhost:27017/jobplatform
REDIS_HOST=localhost
REDIS_PORT=6379
WORKER_ID=worker-1
WORKER_NAME=Worker One
WORKER_CONCURRENCY=3
BACKEND_URL=http://localhost:5000
MAX_JOB_RETRIES=3
JOB_RETRY_DELAY_MS=5000
```

### Frontend — `frontend/.env`
```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_URL=http://localhost:5000
```

---

## Running the Application

You need three separate terminals running simultaneously.

### Terminal 1 — Start the backend
```bash
cd backend
npm run dev
```
Backend starts on `http://localhost:5000`

### Terminal 2 — Start the worker
```bash
cd worker
node src/worker.js
```
Worker registers itself and starts listening for jobs. You should see:
```
Worker worker-1 started — concurrency=3
```

### Terminal 3 — Start the frontend
```bash
cd frontend
npm run dev
```
Frontend starts on `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## First Time Setup

1. Go to `http://localhost:5173`
2. Register an account on the login page
3. You will be redirected to the dashboard
4. The worker should already be visible on the Workers page

---

## Running Tests

```bash
cd backend
npm test
```

Tests use an in-memory MongoDB instance so no running database is needed for tests.

---

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | /api/auth/register | Register new user | No |
| POST | /api/auth/login | Login and get JWT token | No |
| POST | /api/jobs | Submit a new job | Yes |
| GET | /api/jobs | Get all jobs (with filters) | Yes |
| GET | /api/jobs/stats | Get job counts by status | Yes |
| GET | /api/jobs/:id | Get single job details | Yes |
| PUT | /api/jobs/:id/cancel | Cancel a pending or queued job | Yes |
| PUT | /api/jobs/:id/retry | Retry a failed or cancelled job | Yes |
| DELETE | /api/jobs/:id | Delete a completed or failed job | Yes |
| POST | /api/workers/register | Worker registers itself | No |
| POST | /api/workers/heartbeat | Worker sends heartbeat | No |
| GET | /api/workers | Get all workers | Yes |
| POST | /api/workers/complete | Worker reports job complete | No |
| POST | /api/workers/failed | Worker reports job failed | No |

---

## Job Priority Levels

| Label | Value | Description |
|---|---|---|
| Critical | 1 | Runs before everything else |
| High | 3 | Runs before Normal and Low |
| Normal | 5 | Default priority |
| Low | 10 | Runs last |

Lower number = higher priority. BullMQ handles ordering automatically.

---

## Job Lifecycle

```
pending → queued → running → completed
                          → failed (auto-retries up to maxRetries)
                          → retrying → running → completed
                                              → failed
```

---

## Key Features

- **Job Submission** — Submit jobs with name, payload, priority, and max retries
- **Worker Registration** — Workers register automatically on startup
- **Priority Queue** — Critical jobs always run before Low jobs regardless of submission order
- **Real-time Monitoring** — Live status updates via Socket.io, no page refresh needed
- **Heartbeat Monitoring** — Workers send heartbeat every 10 seconds
- **Automatic Retry** — Failed jobs retry automatically with exponential backoff
- **Failure Recovery** — Crashed worker jobs are detected and re-queued within 30 seconds
- **Execution History** — Full audit trail of every job stored in MongoDB

---

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── config/         ← MongoDB and Redis connections
│   │   ├── controllers/    ← Request handlers
│   │   ├── middleware/      ← Auth and error handling
│   │   ├── models/         ← Mongoose schemas
│   │   ├── routes/         ← Express route definitions
│   │   ├── services/       ← BullMQ queue, Socket.io, Recovery
│   │   └── index.js        ← Entry point
│   └── tests/              ← Jest test files
├── worker/
│   └── src/
│       ├── worker.js       ← BullMQ worker process
│       ├── heartbeat.js    ← Registration and heartbeat
│       └── jobHandlers.js  ← Job execution logic
└── frontend/
    └── src/
        ├── api/            ← Axios API calls
        ├── components/     ← Reusable UI components
        ├── hooks/          ← Socket.io hook
        ├── pages/          ← Dashboard, Jobs, Workers
        └── store/          ← Zustand state management
```

---

## Assumptions Made

- A single Redis instance is sufficient for this scale. Production would use Redis Cluster.
- Workers are trusted internal services and do not require JWT authentication on internal endpoints.
- Job payloads are flexible JSON objects — no schema enforcement at the API level.
- The 20% random failure rate in job handlers is intentional for demonstrating retry behavior. In production, job handlers would connect to real services.
- Worker concurrency is set to 3 per instance. This would be tuned based on job type and available CPU in production.
- Authentication is simple JWT for this assessment. Production would include refresh tokens, rate limiting, and role-based access.