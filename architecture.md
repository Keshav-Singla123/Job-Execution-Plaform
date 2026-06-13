# Architecture — Distributed Job Execution Platform

## Why I Built It This Way

When I started this project, the easiest path would have been to process jobs synchronously inside the API — submit a job, run it, return the result. But that breaks immediately under any real load. A job that takes 10 seconds blocks the entire request. Two jobs running together starve each other. A crash loses everything.

So I made a decision early: the system needs to be asynchronous, distributed, and fault-tolerant from the ground up. Every architectural choice flows from that.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│          Dashboard · Jobs · Workers · History            │
└────────────────────┬────────────────┬────────────────────┘
                     │ REST API        │ Socket.io
                     │ (HTTP)          │ (real-time)
                     ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                  Express API Server                      │
│         /api/jobs · /api/workers · /api/auth             │
│                  + Recovery Service                      │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────┐        ┌──────────────────────┐
│    MongoDB      │        │   Redis + BullMQ      │
│                 │        │                       │
│ Jobs collection │        │  Priority queue       │
│ Workers         │        │  Retry logic          │
│ Users           │        │  Atomic job locking   │
│ Execution logs  │        │                       │
└─────────────────┘        └──────────┬────────────┘
                                      │ dequeue
                                      ▼
                           ┌──────────────────────┐
                           │    Worker Process     │
                           │  (separate Node.js)   │
                           │                       │
                           │  Executes jobs        │
                           │  Reports progress     │
                           │  Sends heartbeat/10s  │
                           └──────────────────────┘
```

---

## Component Breakdown

### React Frontend
The frontend is built with Vite + React. I used Zustand for state management because Redux adds too much boilerplate for what this project needs. Zustand lets Socket.io events plug directly into store actions — a job update event from the server instantly updates the UI with no extra wiring.

Real-time updates come through Socket.io. When any job or worker changes state, the server pushes the update and the UI reflects it immediately. No polling, no refresh button.

### Express API Server
The API is the central coordinator. It does not execute jobs itself — it accepts requests, persists data, manages the queue, and emits socket events. Keeping the API thin and stateless was a deliberate choice. Nothing lives in memory between requests. This means you can run multiple API instances behind a load balancer without any coordination between them.

### MongoDB
MongoDB stores everything permanently — jobs, workers, users, and execution logs. I chose MongoDB specifically because of the job payload field. Different job types carry completely different data. A `data-processing` job might carry file paths. An `email-campaign` job carries recipient lists. A rigid SQL schema would require migrations every time a new job type is added. A document store handles this naturally.

MongoDB is the source of truth. If Redis went down and came back up, the recovery service can reconstruct the queue state from MongoDB.

### Redis + BullMQ
Redis is the job queue backbone. I chose Redis over using MongoDB as a queue because Redis is in-memory — job pickup happens in microseconds. BullMQ sits on top of Redis and provides atomic job locking, which solves a critical distributed systems problem: two workers can never accidentally pick the same job. This is not something you want to implement yourself.

BullMQ also handles priority ordering natively. Jobs with priority 1 (Critical) always run before jobs with priority 10 (Low), regardless of submission order.

I chose BullMQ specifically over the older Bull library because Bull is no longer actively maintained. Choosing a deprecated library for a production queue system is a real operational risk.

For the Redis client I used ioredis, which is BullMQ's officially recommended client. It supports Redis Cluster and Sentinel out of the box, meaning if Redis needs to scale to multiple nodes, no code changes are required.

### Worker Process
The worker is a completely separate Node.js process. This was one of the most important architectural decisions I made.

If the worker lived inside the API process, a CPU-heavy job would block the event loop and make the entire API unresponsive. Users would not be able to check job status, submit new jobs, or see the dashboard — exactly when they need it most.

By separating the worker, the API stays fast and responsive regardless of what the worker is doing. The worker can crash without bringing down the API. You can scale workers independently — add more worker machines without touching the API layer.

### Recovery Service
The recovery service runs inside the API server as a background interval every 15 seconds. It checks all registered workers. Any worker that has not sent a heartbeat in 30 seconds is marked offline. Any job that was assigned to that worker and still shows as running gets automatically re-queued.

This required no external tooling — just a setInterval and a few MongoDB queries. Simple to implement, easy to reason about, and solves the most dangerous failure mode in any distributed job system: work that disappears silently when a worker crashes.

---

## Component Interactions

### Job Submission Flow
1. User submits job from frontend
2. API validates the request
3. Job saved to MongoDB with status `pending`
4. Job pushed to BullMQ queue, status updated to `queued`
5. Socket.io emits `job:update` to all connected clients
6. Frontend updates instantly without refresh

### Job Execution Flow
1. Worker picks up job from BullMQ queue (atomic — no other worker can take it)
2. Worker calls API heartbeat endpoint: status `busy`, currentJobId set
3. Worker executes job, reports progress every few seconds
4. API updates job progress in MongoDB, emits socket event
5. On completion: worker calls `/api/workers/complete`
6. API updates job status to `completed`, worker back to `idle`
7. Socket.io pushes final update to frontend

### Failure and Retry Flow
1. Job execution throws an error in the worker
2. Worker calls `/api/workers/failed` with error details
3. API checks: is `attempts < maxRetries`?
4. If yes: status set to `retrying`, job re-queued with exponential backoff delay
5. If no: status set to `failed`, error stored, worker back to `idle`
6. Exponential backoff means first retry waits 5s, second 10s, third 20s — this prevents hammering a failing dependency

### Worker Crash Recovery Flow
1. Worker process crashes (network failure, OOM, manual kill)
2. Heartbeats stop arriving at the API
3. Recovery service fires (every 15 seconds)
4. Detects worker with `lastHeartbeat > 30 seconds ago`
5. Marks worker as `offline`
6. Finds all jobs with `status: running` and `workerId: crashedWorker`
7. Re-queues those jobs — next available worker picks them up
8. Zero human intervention required

---

## Design Decisions

**Why not use a database queue instead of Redis?**
Polling a MongoDB collection every second works at small scale but falls apart under load. It adds constant database pressure, has higher latency, and lacks atomic locking. Two workers polling simultaneously can grab the same job. Redis with BullMQ solves all three problems.

**Why keep MongoDB as the permanent store if Redis has the queue?**
Redis is ephemeral by default. If it restarts without persistence configured, the queue is gone. MongoDB holds every job permanently. The recovery service uses MongoDB to detect and rescue jobs after any Redis or worker failure. The two databases have different responsibilities and neither replaces the other.

**Why separate the worker from the API?**
Fault isolation. When a worker crashes, the API stays up. Users can still see the dashboard, check job history, and submit new jobs. Only execution stops, which is the correct behavior. This also means workers are independently scalable — a traffic spike in job submissions does not require scaling the API and workers together.

**Why Socket.io instead of polling?**
Job status changes are events. Polling asks "did anything change?" every N seconds — wasting requests when nothing changed, and being slow when something did. Socket.io pushes the update the moment it happens. For a monitoring dashboard where users are watching live job progress, this is the right choice.

**Why Zustand over Redux?**
Redux is the right choice for very large applications with complex shared state. For this project, Zustand provides the same centralized store with significantly less boilerplate. Socket.io events plug into Zustand actions in three lines of code. Redux would require actions, reducers, and middleware for the same result.

---

## Failure Handling Strategies

| Failure Scenario | How the System Handles It |
|---|---|
| Job execution throws an error | Auto-retry with exponential backoff up to maxRetries |
| Worker process crashes mid-job | Recovery service detects via heartbeat timeout, re-queues stuck jobs |
| Worker crashes after max retries | Job marked permanently failed with error stored in MongoDB |
| Redis connection drops temporarily | BullMQ connection retry built into ioredis, jobs remain in MongoDB |
| API server restarts | Recovery service starts on boot, scans for any orphaned running jobs |
| Duplicate job pickup | BullMQ atomic locking on Redis prevents two workers taking the same job |

---

## Scalability Considerations

The system is designed to scale horizontally without architectural changes.

**Workers** are completely stateless. To handle more jobs, you run more worker processes — on the same machine or different machines. They all connect to the same Redis queue. BullMQ handles the distribution automatically.

**The API** is stateless. No session data, no in-memory job state. Multiple API instances can run behind a load balancer with no coordination required between them. Socket.io would need to move to Redis adapter for multi-instance deployments, which is a one-line configuration change.

**MongoDB** scales with replica sets for read scaling and sharding for write scaling if needed. The jobs collection has indexes on `status`, `priority`, and `createdAt` — the three fields most commonly used in queries.

**Redis** scales with Redis Cluster. Because I used ioredis, this requires no application code changes.

The current single-worker demo is intentional for clarity. The same code running on 10 machines with 10 worker processes would handle 30 concurrent jobs (at concurrency 3 each) with no changes to the codebase.

---

## What I Would Do Differently at Production Scale

- Add a Redis adapter to Socket.io so multiple API instances can all emit to the same clients
- Move job payload validation to a schema registry so different job types have enforced schemas
- Add Prometheus metrics on queue depth, worker utilization, and job completion rates
- Implement dead letter queue for jobs that fail permanently — for manual review and reprocessing
- Add job dependencies — job B only starts after job A completes