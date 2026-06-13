# Agent.md — AI Usage During Development

## Overview

I used AI tools during this project as a pair programmer — not as a replacement for thinking. Before writing a single line of code, I designed the system architecture myself: which components were needed, how they would communicate, what the failure modes were, and which database would own what responsibility. AI came in after those decisions were made.

The way I think about it — AI is fast at writing code I already know how to write. It is useless for decisions I have not made yet.

---

## Tools Used

- **Claude (Anthropic)** — Architecture discussion, understanding BullMQ internals, writing boilerplate for controllers and routes
- **GitHub Copilot** — Inline code completion during implementation phases

---

## My Development Approach

### Step 1 — Architecture First, Code Second

Before touching AI, I mapped out the system on my own:

- The API cannot execute jobs directly — it will block under load
- Workers need to be separate processes for fault isolation
- Redis is faster than MongoDB for a queue — but MongoDB must remain the source of truth
- Heartbeat + recovery service is the only practical way to detect worker crashes without adding external infrastructure

Once I had these decisions made, I used AI to implement them faster. I gave AI specific, constrained prompts — not open-ended ones. The difference is significant. "Build me a job queue system" produces generic code. "Write an Express controller that saves a job to MongoDB, then pushes it to BullMQ with these specific fields and emits a socket event" produces something useful.

### Step 2 — Phased Prompting

I broke the project into phases and worked through them sequentially. Each phase had to be reviewed and working before moving to the next. This forced me to understand every piece before building on top of it. If something was wrong, I caught it early instead of debugging a 2000-line codebase.

Phases I followed:
1. Project structure and scaffold
2. MongoDB models
3. Config, middleware, auth
4. Job queue service
5. Controllers and routes
6. Worker process
7. Failure recovery service
8. React frontend
9. Documentation

### Step 3 — Review Everything AI Wrote

Every file AI generated, I read before running it. This caught several issues immediately — wrong method names, missing error handling, incorrect BullMQ API usage. AI generates plausible-looking code, not always correct code. The review step is not optional.

---

## Where AI Helped

- Writing repetitive boilerplate — controllers follow the same pattern, AI wrote the first one and I reviewed the rest
- BullMQ queue setup — initial configuration of Queue and Worker classes
- Mongoose model definitions — straightforward once the schema was designed
- Frontend component structure — JobCard, WorkerCard, ProgressBar initial versions
- Documentation formatting

---

## Where AI Could Not Help — Real Debugging I Did Myself

This is where most of the actual engineering happened.

### Bug 1 — Worker Routes Returning 401

After the worker process was running, every heartbeat and progress call was returning 401. The worker was calling authenticated routes but had no JWT token — and giving the worker a token made no sense architecturally. Workers are internal services, not users.

I identified that auth middleware was applied globally to all worker routes, which was wrong. The fix was removing auth middleware specifically from `/api/workers/heartbeat`, `/api/workers/complete`, `/api/workers/failed`, and `/api/workers/register`. These are internal service endpoints, not user-facing routes. Auth belongs on job submission and dashboard routes only.

### Bug 2 — Retry Button Returning 404

The retry button was hitting `POST /api/jobs/:id/retry` but the backend route was defined as `PUT /api/jobs/:id/retry`. A method mismatch that returns 404 because Express does not match the route at all. Found it by reading the network tab carefully — the URL was correct but the method was wrong. One word change in the frontend API call fixed it.

### Bug 3 — Duplicate Job Showing on Dashboard

When a job was submitted, it appeared twice on the dashboard during the running state, then collapsed to one on completion. The issue was the job being added to Zustand state twice — once from the API response after submission, and once from the Socket.io `job:update` event.

The fix was changing the `submitJob` store action to not add the job to state directly after the API call. Instead it calls `fetchJobs()` to load the current list. Socket.io then handles all subsequent real-time updates. Only one source of truth for state updates.

### Bug 4 — Retried Jobs Stuck in Queued Forever

After a job failed three times and was manually retried, it went to `queued` status but the worker never picked it up. No errors in the worker terminal either.

The root cause was BullMQ's job deduplication. BullMQ uses the jobId as a unique key. The original job had already been processed under that MongoDB ID. When the retry re-added the same ID to the queue, BullMQ silently ignored it — it considered the job already handled.

The fix was removing the existing BullMQ job entry before re-adding it on retry, using `jobQueue.getJob(jobId)` followed by `existingJob.remove()`. This clears the stale entry so BullMQ accepts the job as new.

This was not a bug AI could find — it required understanding how BullMQ handles job identity internally.

### Bug 5 — Recovery Service Not Detecting Crashed Workers

The recovery service was running but not marking workers as offline after a crash. The issue was a timezone comparison problem — `lastHeartbeat > 30 seconds ago` was being compared incorrectly because the heartbeat timestamp was stored as a string in some cases, not a Date object. MongoDB was returning it correctly but the comparison was failing silently.

Fixed by explicitly wrapping the comparison in `new Date(worker.lastHeartbeat)` to guarantee a Date object regardless of how it came out of the query.

---

## What I Learned About Using AI Effectively

**Specific prompts produce specific results.** Every prompt I gave included the exact file, the exact function, the exact behavior I needed, and what I did not want changed. Vague prompts produce vague code.

**AI does not understand your system.** It understands the code you show it. If you show it one file and ask it to fix a bug that spans three files, it will fix the wrong thing. I always gave AI full context of the relevant files before asking for changes.

**Debugging is still manual.** Every bug listed above — AI did not find any of them. I found them by reading error messages, checking network tabs, reading BullMQ documentation, and reasoning through what the system was actually doing versus what I expected. AI helped implement the fix once I understood the problem.

**Do not let AI make architectural decisions.** At one point I asked AI what database to use for the queue. It gave me three options with pros and cons. I made the decision myself based on what I understood about the system requirements. That decision — Redis over MongoDB for the queue — is one of the most important ones in this project. It should not be delegated.

---

## Prompts I Used (Representative Examples)

These are representative of the approach — specific, constrained, architectural:

```
Write an Express controller function called retryJob. It should:
- Find the job by MongoDB ID from req.params.id
- Return 400 if status is not 'failed' or 'cancelled'
- Reset status to pending, attempts to 0, progress to 0, clear logs and error
- Call jobService.addJobToQueue with the job ID, payload, and priority
- Emit a socket event using req.app.get('io')
- Use try/catch and call next(error) on failure
Do not change anything else in the file.
```

```
In jobService.js, before calling jobQueue.add() in the addJobToQueue 
function, add these two lines:
const existingBullJob = await jobQueue.getJob(jobId);
if (existingBullJob) await existingBullJob.remove();
Show only the updated addJobToQueue function, nothing else.
```

The pattern is always the same — tell AI exactly what to change, exactly what not to touch, and exactly what the expected behavior is.

---

## Summary

AI reduced the time I spent writing predictable code. It did not reduce the time I spent thinking about the system. Architecture, debugging, and trade-off decisions were entirely manual. The result is a codebase I can explain line by line — because I reviewed everything, debugged everything that broke, and made every significant decision myself.