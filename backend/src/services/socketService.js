function serializeDocument(document) {
  if (!document) {
    return document;
  }

  if (typeof document.toObject === 'function') {
    return document.toObject();
  }

  return document;
}

// Simple short-lived dedupe cache to avoid emitting duplicate progress/update events
const _dedupeCache = new Map(); // jobId -> { lastProgress, lastUpdateAt }

function emitJobUpdate(io, job) {
  try {
    if (!io || !job) {
      return;
    }

    const serialized = serializeDocument(job);
    const jobId = serialized && (serialized._id || serialized.id);

    // If a recent progress event for the same job was emitted with identical progress,
    // skip emitting a full job:update immediately to avoid duplicate renders.
    if (jobId && typeof serialized.progress === 'number') {
      const cache = _dedupeCache.get(jobId);
      const now = Date.now();

      if (cache && cache.lastProgress === serialized.progress && (now - cache.lastUpdateAt) < 250) {
        return;
      }
    }

    io.emit('job:update', serialized);

    if (jobId) {
      _dedupeCache.set(jobId, { lastProgress: serialized.progress, lastUpdateAt: Date.now() });
      // keep cache small — expire after a short timeout
      setTimeout(() => _dedupeCache.delete(jobId), 5000);
    }
  } catch (error) {
    console.error('Emit job update failed:', error.message);
  }
}

function emitJobProgress(io, jobId, progress, log) {
  try {
    if (!io) {
      return;
    }

    // dedupe exact repeated progress updates in a short window
    try {
      const cache = jobId && _dedupeCache.get(jobId);
      const now = Date.now();

      if (cache && cache.lastProgress === progress && (now - cache.lastUpdateAt) < 250) {
        return;
      }
    } catch (e) {
      // ignore cache errors
    }

    io.emit('job:progress', {
      jobId,
      progress,
      log
    });

    if (jobId) {
      _dedupeCache.set(jobId, { lastProgress: progress, lastUpdateAt: Date.now() });
      setTimeout(() => _dedupeCache.delete(jobId), 5000);
    }
  } catch (error) {
    console.error('Emit job progress failed:', error.message);
  }
}

function emitJobDelete(io, jobId) {
  try {
    if (!io || !jobId) {
      return;
    }

    io.emit('job:delete', { jobId });
  } catch (error) {
    console.error('Emit job delete failed:', error.message);
  }
}

function emitWorkerUpdate(io, worker) {
  try {
    if (!io || !worker) {
      return;
    }

    io.emit('worker:update', serializeDocument(worker));
  } catch (error) {
    console.error('Emit worker update failed:', error.message);
  }
}

module.exports = {
  emitJobUpdate,
  emitJobProgress,
  emitJobDelete,
  emitWorkerUpdate
};
