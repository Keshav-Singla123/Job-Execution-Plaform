import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import useJobStore from '../store/useJobStore.js';

function useSocket(enabled = false) {
  const updateJob = useJobStore((s) => s.updateJob);
  const removeJob = useJobStore((s) => s.removeJob);
  const updateWorker = useJobStore((s) => s.updateWorker);
  const updateJobProgress = useJobStore((s) => s.updateJobProgress);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return undefined;
    }

    const base = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:5000';
    const socket = io(base, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('job:update', (job) => {
      try {
        updateJob(job);
      } catch (e) {
        console.error('job:update handler failed', e.message);
      }
    });

    socket.on('job:progress', ({ jobId, progress, log }) => {
      try {
        updateJobProgress(jobId, progress, log);
      } catch (e) {
        console.error('job:progress handler failed', e.message);
      }
    });

    socket.on('job:delete', ({ jobId }) => {
      try {
        removeJob(jobId);
      } catch (e) {
        console.error('job:delete handler failed', e.message);
      }
    });

    socket.on('worker:update', (worker) => {
      try {
        updateWorker(worker);
      } catch (e) {
        console.error('worker:update handler failed', e.message);
      }
    });

    return () => {
      try {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('job:update');
        socket.off('job:progress');
        socket.off('job:delete');
        socket.off('worker:update');
        socket.disconnect();
      } catch (error) {
        console.error('Socket cleanup failed:', error.message);
      }
    };
  }, [enabled, removeJob, updateJob, updateWorker, updateJobProgress]);

  return { connected };
}

export default useSocket;
