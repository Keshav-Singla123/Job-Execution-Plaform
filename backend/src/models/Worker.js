const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['idle', 'busy', 'offline'],
      default: 'idle'
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now
    },
    currentJobId: {
      type: String,
      default: null
    },
    jobsCompleted: {
      type: Number,
      default: 0
    },
    jobsFailed: {
      type: Number,
      default: 0
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    concurrency: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Worker', workerSchema);
