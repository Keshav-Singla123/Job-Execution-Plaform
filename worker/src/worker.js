require('dotenv').config();

const mongoose = require('mongoose');
const IORedis = require('ioredis');
const axios = require('axios');
const { Worker } = require('bullmq');
const { processJob } = require('./jobHandlers');
const { startHeartbeat, stopHeartbeat, setStatus, setCurrentJob } = require('./heartbeat');

// Minimal Job model used to read job metadata from MongoDB
const jobSchema = new mongoose.Schema({}, { strict: false, versionKey: false });
const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);

function createRedisConnection() {
  return new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null
  });
}

async function notifyBackend(path, body = {}) {
  try {
    const url = `${process.env.BACKEND_URL.replace(/\/$/, '')}${path}`;
    await axios.post(url, body, {
      timeout: 5000,
      headers: {
        'x-worker-secret': process.env.WORKER_API_KEY
      }
    });
  } catch (error) {
    console.warn(`Backend notify failed (${path}):`, error.message);
  }
}

async function startWorker() {
  const redisConnection = createRedisConnection();
  const concurrency = Number(process.env.WORKER_CONCURRENCY || 1);

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/job-exec');

    await startHeartbeat();

    const worker = new Worker(
      'job-execution-queue',
      async (bullJob) => {
        const jobId = (bullJob && (bullJob.id || (bullJob.data && (bullJob.data.jobId || bullJob.data.id)))) || null;

        // Notify backend we're busy on this job
        await notifyBackend('/api/workers/heartbeat', {
          workerId: process.env.WORKER_ID,
          status: 'busy',
          currentJobId: jobId
        });

        // update heartbeat module state
        setStatus('busy');
        setCurrentJob(jobId || null);

        // fetch job details from MongoDB when possible
        let jobDoc = null;
        try {
          if (jobId && mongoose.isValidObjectId && mongoose.isValidObjectId(jobId)) {
            jobDoc = await Job.findById(jobId).lean();
          }
        } catch (err) {
          console.warn('Failed to read job document from MongoDB:', err.message);
        }

        const jobData = jobDoc || (bullJob.data || {});

        // reportProgress function delegates progress updates to backend
          async function reportProgress(progress, message) {
          try {
            await bullJob.updateProgress(progress);
          } catch (e) {
            // non-fatal
          }

          try {
            await notifyBackend('/api/workers/heartbeat', {
              workerId: process.env.WORKER_ID,
              status: 'busy',
              currentJobId: jobId,
                progress,
                log: message
            });
          } catch (e) {
            // already handled in notifyBackend
          }
        }

        // call the actual job processor
        try {
          const result = await processJob(jobData, reportProgress);

          // on success, inform backend
          await notifyBackend('/api/workers/complete', {
            workerId: process.env.WORKER_ID,
            jobId,
            result
          });

          setStatus('idle');
          setCurrentJob(null);

          return result;
        } catch (error) {
          // inform backend of failure
          await notifyBackend('/api/workers/failed', {
            workerId: process.env.WORKER_ID,
            jobId,
            error: error.message
          });

          setStatus('idle');
          setCurrentJob(null);

          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency
      }
    );

    worker.on('completed', (job) => {
      try {
        console.log(`Job completed: ${job.id}`);
      } catch (err) {
        console.log('Job completed (failed to log id).');
      }
    });

    worker.on('failed', (job, err) => {
      console.error(`Job failed: ${job && job.id}`, err && err.message);
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err && err.message);
      // do not crash the process
    });

    console.log(`Worker ${process.env.WORKER_ID || 'unknown'} started — concurrency=${concurrency}`);

    async function shutdown(signal) {
      try {
        console.log(`${signal} received. Shutting down worker.`);
        stopHeartbeat();
        await worker.close();
        await redisConnection.quit();
        await mongoose.disconnect();
        process.exit(0);
      } catch (error) {
        console.error('Worker shutdown failed:', error.message);
        process.exit(1);
      }
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Worker startup failed:', error.message);
    stopHeartbeat();
    try {
      await redisConnection.quit();
    } catch (e) {}
    process.exit(1);
  }
}

startWorker();
