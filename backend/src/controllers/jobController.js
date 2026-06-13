const mongoose = require('mongoose');
const Job = require('../models/Job');
const jobService = require('../services/jobService');
const { jobQueue } = require('../services/jobService');
const { emitJobUpdate, emitJobDelete } = require('../services/socketService');

const allowedPriorities = [1, 3, 5, 10];

function parsePriority(priority) {
  const parsedPriority = Number(priority || 5);
  return allowedPriorities.includes(parsedPriority) ? parsedPriority : null;
}

async function submitJob(req, res, next) {
  try {
    const priority = parsePriority(req.body.priority);
    const delayMs = Number(req.body.delayMs || 0);
    const scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : null;
    const delayFromSchedule = scheduledFor && !Number.isNaN(scheduledFor.getTime())
      ? Math.max(scheduledFor.getTime() - Date.now(), 0)
      : 0;
    const finalDelay = Math.max(delayMs, delayFromSchedule);

    if (!req.body.name) {
      res.status(400).json({ success: false, message: 'Job name is required' });
      return;
    }

    if (req.body.payload !== undefined && (typeof req.body.payload !== 'object' || Array.isArray(req.body.payload) || req.body.payload === null)) {
      res.status(400).json({ success: false, message: 'Payload must be an object' });
      return;
    }

    if (!priority) {
      res.status(400).json({ success: false, message: 'Priority must be one of 1, 3, 5, or 10' });
      return;
    }

    const maxRetries = Number(req.body.maxRetries || 3);
    const job = await Job.create({
      name: req.body.name,
      payload: req.body.payload || {},
      status: finalDelay > 0 ? 'scheduled' : 'pending',
      priority,
      maxRetries,
      scheduledFor: finalDelay > 0 ? new Date(Date.now() + finalDelay) : null
    });

    await jobService.addJobToQueue(job._id.toString(), job.payload, job.priority, finalDelay);
    const queuedJob = await Job.findById(job._id);

    emitJobUpdate(req.app.get('io'), queuedJob);
    res.status(201).json({ success: true, job: queuedJob });
  } catch (error) {
    next(error);
  }
}

async function getAllJobs(req, res, next) {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.max(Number(req.query.limit || 20), 1);
    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.priority) {
      filter.priority = Number(req.query.priority);
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Job.countDocuments(filter)
    ]);

    res.json({
      success: true,
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getJobById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
}

async function cancelJob(req, res, next) {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    if (!['pending', 'scheduled', 'queued'].includes(job.status)) {
      res.status(409).json({ success: false, message: 'Only pending, scheduled, or queued jobs can be cancelled' });
      return;
    }

    if (job.status === 'queued') {
      await jobService.removeJobFromQueue(job._id.toString());
    }

    job.status = 'cancelled';
    await job.save();

    emitJobUpdate(req.app.get('io'), job);
    res.json({ success: true, job });
  } catch (error) {
    next(error);
  }
}

async function retryJob(req, res, next) {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    if (!['failed', 'cancelled'].includes(job.status)) {
      res.status(409).json({ success: false, message: 'Only failed or cancelled jobs can be retried' });
      return;
    }

    job.status = 'pending';
    job.attempts = 0;
    job.progress = 0;
    job.error = null;
    job.logs = [];
    job.startedAt = null;
    job.completedAt = null;
    job.failedAt = null;
    await job.save();

    const existingBullJob = await jobQueue.getJob(job._id.toString());
    if (existingBullJob) await existingBullJob.remove();
    await jobService.addJobToQueue(`${job._id.toString()}-retry-${Date.now()}`, job.payload, job.priority);
    const queuedJob = await Job.findById(job._id);

    emitJobUpdate(req.app.get('io'), queuedJob);
    res.json({ success: true, job: queuedJob });
  } catch (error) {
    next(error);
  }
}

async function deleteJob(req, res, next) {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }

    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      res.status(400).json({ success: false, message: 'Cannot delete a job that is currently active' });
      return;
    }

    const jobId = job._id.toString();
    await job.deleteOne();

    emitJobDelete(req.app.get('io'), jobId);
    res.json({ success: true, jobId });
  } catch (error) {
    next(error);
  }
}

async function getJobStats(req, res, next) {
  try {
    const groupedStats = await Job.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    const countsByStatus = groupedStats.reduce((counts, item) => {
      counts[item._id] = item.count;
      return counts;
    }, {});
    const queue = await jobService.getQueueStats();

    res.json({
      success: true,
      counts: countsByStatus,
      queue
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitJob,
  getAllJobs,
  getJobById,
  cancelJob,
  retryJob,
  deleteJob,
  getJobStats
};
