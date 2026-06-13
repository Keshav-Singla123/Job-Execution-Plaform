const WorkerModel = require('../models/Worker');
const JobModel = require('../models/Job');
const jobService = require('./jobService');
const { emitJobUpdate, emitWorkerUpdate } = require('./socketService');
const logger = require('../utils/logger');

const CHECK_INTERVAL_MS = 15 * 1000; // every 15 seconds
const WORKER_TIMEOUT_MS = 30 * 1000; // consider crashed if no heartbeat for 30s

let recoveryTimer = null;

function safeDateSubtract(ms) {
  return new Date(Date.now() - ms);
}

async function recoverOnce(io) {
  try {
    const threshold = safeDateSubtract(WORKER_TIMEOUT_MS);

    const crashedWorkers = await WorkerModel.find({
      lastHeartbeat: { $lt: threshold },
      status: { $ne: 'offline' }
    });

    for (const worker of crashedWorkers) {
      const workerId = worker.workerId;
      let recoveredCount = 0;

      try {
        // mark worker offline
        worker.status = 'offline';
        await worker.save();
        emitWorkerUpdate(io, worker);

        // find running jobs assigned to this worker
        const stuckJobs = await JobModel.find({ workerId, status: 'running' });

        for (const job of stuckJobs) {
          try {
            if ((job.attempts || 0) < (job.maxRetries || 3)) {
              job.status = 'retrying';
              job.attempts = (job.attempts || 0) + 1;
              job.error = `Recovered after worker ${workerId} crash (attempt ${job.attempts})`;
              job.progress = 0;
              await job.save();

              // re-add to BullMQ queue
              await jobService.addJobToQueue(job._id.toString(), job.payload || {}, job.priority || 5);

              emitJobUpdate(io, job);
              recoveredCount += 1;
            } else {
              job.status = 'failed';
              job.error = 'Worker crashed, max retries exceeded';
              job.failedAt = new Date();
              await job.save();

              emitJobUpdate(io, job);
            }
          } catch (jobErr) {
            logger.error('Failed to recover job', { jobId: job._id.toString(), message: jobErr.message });
          }
        }

          logger.info(`Recovered ${recoveredCount} jobs from crashed worker ${workerId}`);
      } catch (wErr) {
          logger.error('Failed to process crashed worker', { workerId: worker.workerId, message: wErr.message });
      }
    }
  } catch (error) {
      logger.error('Recovery pass failed', { message: error.message });
  }
}

function startRecoveryService(io) {
  if (!io) {
    throw new Error('Socket.io instance required to start recovery service');
  }

  if (recoveryTimer) {
    return; // already running
  }

  // run immediately, then every interval
  recoverOnce(io).catch((e) => console.error('Initial recovery run failed:', e.message));

  recoveryTimer = setInterval(() => {
    recoverOnce(io);
  }, CHECK_INTERVAL_MS);

  logger.info('Recovery service started', { intervalMs: CHECK_INTERVAL_MS });
}

module.exports = {
  startRecoveryService
};
