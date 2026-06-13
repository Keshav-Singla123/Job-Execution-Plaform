const axios = require('axios');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reportProgressToBackend(progressPayload) {
  try {
    await axios.post(`${process.env.BACKEND_URL.replace(/\/$/, '')}/api/workers/heartbeat`, progressPayload, { timeout: 5000 });
  } catch (error) {
    console.warn('reportProgress backend call failed:', error.message);
  }
}

async function processJob(jobData, reportProgress) {
  // jobData expected to contain at least { id, name, payload }
  const name = jobData && (jobData.name || jobData.type || 'default');
  const payload = jobData && jobData.payload ? jobData.payload : jobData || {};
  const jobId = jobData && (jobData._id || jobData.id || jobData.jobId || null);

  // helper to unify progress reporting
  async function _report(progress, message) {
    try {
      // local reporter (passed from worker to update Bull progress and DB)
      if (typeof reportProgress === 'function') {
        await reportProgress(progress, message);
      }

      // also inform backend heartbeat endpoint about progress
      await reportProgressToBackend({
        workerId: process.env.WORKER_ID,
        status: 'busy',
        currentJobId: jobId,
        progress,
        message
      });
    } catch (e) {
      // non-fatal
    }
  }

  // 20% random failure chance helper
  function maybeFail() {
    if (Math.random() < 0.2) {
      throw new Error('Simulated random failure');
    }
  }

  try {
    if (name === 'data-processing') {
      for (let i = 1; i <= 10; i += 1) {
        await sleep(500);
        await _report(i * 10, `Processing chunk ${i}/10`);
        maybeFail();
      }

      return { message: 'data-processing complete', processedChunks: 10 };
    }

    if (name === 'report-generation') {
      for (let i = 1; i <= 5; i += 1) {
        await sleep(1000);
        await _report(i * 20, `Generating section ${i}/5`);
        maybeFail();
      }

      return { message: 'report-generation complete', sections: 5 };
    }

    if (name === 'email-campaign') {
      const recipients = Array.isArray(payload.recipients) ? payload.recipients : new Array(Number(payload.recipients || 5)).fill().map((_, i) => `user${i + 1}@example.com`);
      let sent = 0;
      for (let i = 0; i < recipients.length; i += 1) {
        await sleep(200);
        sent += 1;
        const progress = Math.round((sent / recipients.length) * 100);
        await _report(progress, `Sent to ${recipients[i]}`);
        maybeFail();
      }

      return { message: 'email-campaign complete', sent };
    }

    // default: run for 3 seconds total, report every 500ms
    const totalMs = 3000;
    const stepMs = 500;
    const steps = Math.ceil(totalMs / stepMs);
    for (let i = 1; i <= steps; i += 1) {
      await sleep(stepMs);
      const progress = Math.round((i / steps) * 100);
      await _report(progress, `Working... (${i}/${steps})`);
      maybeFail();
    }

    return { message: 'default job complete', durationMs: totalMs };
  } catch (error) {
    // bubble up error to worker
    throw error;
  }
}

module.exports = {
  processJob
};
