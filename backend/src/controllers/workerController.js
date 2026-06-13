const Job = require('../models/Job');
const Worker = require('../models/Worker');
const jobService = require('../services/jobService');
const { emitJobProgress, emitJobUpdate, emitWorkerUpdate } = require('../services/socketService');

async function registerWorker(req, res, next) {
  try {
    const { workerId, name, concurrency } = req.body;

    if (!workerId || !name) {
      res.status(400).json({ success: false, message: 'workerId and name are required' });
      return;
    }

    const worker = await Worker.findOneAndUpdate(
      { workerId },
      {
        workerId,
        name,
        concurrency: Number(concurrency || 1),
        status: 'idle',
        lastHeartbeat: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    emitWorkerUpdate(req.app.get('io'), worker);
    res.status(201).json({ success: true, worker });
  } catch (error) {
    next(error);
  }
}

async function heartbeat(req, res, next) {
  try {
    const { workerId, status, currentJobId, progress } = req.body;

    if (!workerId) {
      res.status(400).json({ success: false, message: 'workerId is required' });
      return;
    }

    const worker = await Worker.findOneAndUpdate(
      { workerId },
      {
        lastHeartbeat: new Date(),
        status: status || 'idle',
        currentJobId: currentJobId || null
      },
      { new: true }
    );

    if (!worker) {
      res.status(404).json({ success: false, message: 'Worker not found' });
      return;
    }

    if (currentJobId) {
      // ensure job is marked as running and has a startedAt timestamp
      try {
        const jobDoc = await Job.findById(currentJobId);
        if (jobDoc) {
          let changed = false;
          if (jobDoc.status !== 'running') {
            jobDoc.status = 'running';
            changed = true;
          }
          if (!jobDoc.startedAt) {
            jobDoc.startedAt = new Date();
            changed = true;
          }

          if (changed) {
            await jobDoc.save();
            emitJobUpdate(req.app.get('io'), jobDoc);
          }
        }
      } catch (e) {
        // non-fatal — continue to progress updates
        console.warn('Failed to mark job running on heartbeat:', e.message);
      }

      if (progress !== undefined) {
        await Job.findByIdAndUpdate(currentJobId, { progress: Number(progress) });
        emitJobProgress(req.app.get('io'), currentJobId, Number(progress), req.body.log || null);
      }
    }

    emitWorkerUpdate(req.app.get('io'), worker);
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}

async function getAllWorkers(req, res, next) {
  try {
    const offlineBefore = new Date(Date.now() - 30000);
    await Worker.updateMany(
      {
        lastHeartbeat: { $lt: offlineBefore },
        status: { $ne: 'offline' }
      },
      {
        status: 'offline',
        currentJobId: null
      }
    );

    const workers = await Worker.find().sort({ registeredAt: 1 });
    res.json({ success: true, workers });
  } catch (error) {
    next(error);
  }
}

async function workerJobComplete(req, res, next) {
  try {
    const { workerId, jobId, result } = req.body;

    if (!workerId || !jobId) {
      res.status(400).json({ success: false, message: 'workerId and jobId are required' });
      return;
    }

    // attach the workerId to the job record and mark completed
    const job = await Job.findByIdAndUpdate(
      jobId,
      {
        workerId: workerId,
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        result
      },
      { new: true }
    );
    const worker = await Worker.findOneAndUpdate(
      { workerId },
      {
        status: 'idle',
        currentJobId: null,
        $inc: { jobsCompleted: 1 }
      },
      { new: true }
    );

    emitJobUpdate(req.app.get('io'), job);
    emitWorkerUpdate(req.app.get('io'), worker);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

async function workerJobFailed(req, res, next) {
  try {
    const { workerId, jobId, error } = req.body;

    if (!workerId || !jobId) {
      res.status(400).json({ success: false, message: 'workerId and jobId are required' });
      return;
    }

    const job = await Job.findById(jobId);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    job.attempts += 1;
    job.error = error || 'Job failed';

    if (job.attempts < job.maxRetries) {
      job.status = 'retrying';
      await job.save();
      await jobService.addJobToQueue(
        job._id.toString(),
        job.payload,
        job.priority,
        Number(process.env.JOB_RETRY_DELAY_MS || 5000)
      );
    } else {
      job.status = 'failed';
      job.failedAt = new Date();
      await job.save();
    }

    const worker = await Worker.findOneAndUpdate(
      { workerId },
      {
        status: 'idle',
        currentJobId: null,
        $inc: { jobsFailed: 1 }
      },
      { new: true }
    );

    emitJobUpdate(req.app.get('io'), job);
    emitWorkerUpdate(req.app.get('io'), worker);
    res.json({ success: true });
  } catch (handlerError) {
    next(handlerError);
  }
}

module.exports = {
  registerWorker,
  heartbeat,
  getAllWorkers,
  workerJobComplete,
  workerJobFailed
};
