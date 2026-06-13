const axios = require('axios');

let heartbeatTimer = null;
let currentStatus = 'idle';
let currentJobId = null;

async function registerWorker() {
  try {
    await axios.post(`${process.env.BACKEND_URL.replace(/\/$/, '')}/api/workers/register`, {
      workerId: process.env.WORKER_ID,
      name: process.env.WORKER_NAME,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 1)
    }, {
      timeout: 5000,
      headers: {
        'x-worker-secret': process.env.WORKER_API_KEY
      }
    });
    console.log('Worker registered with backend.');
  } catch (error) {
    console.warn('Worker register failed:', error.message);
  }
}

async function sendHeartbeat() {
  try {
    await axios.post(`${process.env.BACKEND_URL.replace(/\/$/, '')}/api/workers/heartbeat`, {
      workerId: process.env.WORKER_ID,
      name: process.env.WORKER_NAME,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
      status: currentStatus,
      currentJobId
    }, {
      timeout: 5000,
      headers: {
        'x-worker-secret': process.env.WORKER_API_KEY
      }
    });
  } catch (error) {
    console.warn('Worker heartbeat failed (will continue):', error.message);
  }
}

async function startHeartbeat() {
  try {
    // register first so the backend has a worker document before heartbeat calls arrive
    await registerWorker();
    // send the first heartbeat after registration is confirmed
    await sendHeartbeat();

    heartbeatTimer = setInterval(() => {
      sendHeartbeat();
    }, 10000);
  } catch (error) {
    console.warn('Failed to start heartbeat:', error.message);
  }
}

function stopHeartbeat() {
  try {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  } catch (error) {
    console.warn('Stop heartbeat failed:', error.message);
  }
}

function setStatus(status) {
  currentStatus = status;
}

function setCurrentJob(jobId) {
  currentJobId = jobId;
}

module.exports = {
  startHeartbeat,
  stopHeartbeat,
  setStatus,
  setCurrentJob
};
