const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'queued', 'running', 'completed', 'failed', 'retrying', 'cancelled'],
      default: 'pending'
    },
    priority: {
      type: Number,
      default: 5
    },
    workerId: {
      type: String
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    logs: [
      {
        timestamp: {
          type: Date
        },
        message: {
          type: String
        }
      }
    ],
    result: {
      type: mongoose.Schema.Types.Mixed
    },
    error: {
      type: String
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    failedAt: {
      type: Date
    },
    scheduledFor: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

jobSchema.index({ status: 1, priority: 1, createdAt: 1 });

module.exports = mongoose.model('Job', jobSchema);