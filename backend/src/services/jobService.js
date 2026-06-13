const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');
const Job = require('../models/Job');
const logger = require('../utils/logger');

const jobQueue = new Queue('job-execution-queue', {
  connection: redisConnection
});

function normalizePriority(priority) {
  const parsedPriority = Number(priority || 5);

  if (parsedPriority < 1) {
    return 1;
  }

  if (parsedPriority > 10) {
    return 10;
  }

  return parsedPriority;
}

async function addJobToQueue(jobId, payload, priority, delayMs) {
  try {
    const delay = Number(delayMs || 0);
    const bullJob = await jobQueue.add(jobId, payload || {}, {
      jobId,
      priority: normalizePriority(priority),
      attempts: Number(process.env.MAX_JOB_RETRIES || 3),
      delay,
      backoff: {
        type: 'exponential',
        delay: Number(process.env.JOB_RETRY_DELAY_MS || 5000)
      }
    });

    await Job.findByIdAndUpdate(jobId, {
      status: delay > 0 ? 'scheduled' : 'queued'
    });

    logger.info('Job queued', { jobId, priority: normalizePriority(priority), delay });

    return bullJob;
  } catch (error) {
    logger.error('Add job to queue failed', { message: error.message, jobId });
    throw error;
  }
}

async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      jobQueue.getWaitingCount(),
      jobQueue.getActiveCount(),
      jobQueue.getCompletedCount(),
      jobQueue.getFailedCount(),
      jobQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed
    };
  } catch (error) {
    logger.error('Get queue stats failed', { message: error.message });
    throw error;
  }
}

async function removeJobFromQueue(bullJobId) {
  try {
    const bullJob = await jobQueue.getJob(bullJobId);

    if (!bullJob) {
      return null;
    }

    const state = await bullJob.getState();

    if (state !== 'waiting') {
      throw new Error('Only waiting jobs can be removed from the queue.');
    }

    await bullJob.remove();

    return bullJob;
  } catch (error) {
    logger.error('Remove job from queue failed', { message: error.message, bullJobId });
    throw error;
  }
}

module.exports = {
  addJobToQueue,
  getQueueStats,
  removeJobFromQueue,
  jobQueue
};
