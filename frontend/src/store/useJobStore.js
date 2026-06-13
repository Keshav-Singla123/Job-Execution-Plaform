import { create } from 'zustand';
import { createJob, getJobs, getWorkers, getStats, cancelJob as apiCancelJob, retryJob as apiRetryJob, deleteJob as apiDeleteJob } from '../api/index.js';

const useJobStore = create((set) => ({
  jobs: [],
  workers: [],
  stats: {},
  loading: false,
  error: null,

  // fetchJobs(filters)
  fetchJobs: async (filters = {}) => {
    try {
      set({ loading: true, error: null });
      const jobs = await getJobs(filters);
      set({ jobs, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // fetchWorkers()
  fetchWorkers: async () => {
    try {
      set({ loading: true, error: null });
      const workers = await getWorkers();
      set({ workers, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // fetchStats()
  fetchStats: async () => {
    try {
      set({ loading: true, error: null });
      const stats = await getStats();
      set({ stats, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // submitJob(jobData)
  submitJob: async (data) => {
    try {
      set({ loading: true, error: null });
      await createJob(data);
      await useJobStore.getState().fetchJobs();
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // cancelJob(id)
  cancelJob: async (id) => {
    try {
      set({ loading: true, error: null });
      const job = await apiCancelJob(id);
      set((state) => ({ jobs: state.jobs.map((j) => (j._id === id ? job : j)), loading: false }));
      return job;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // retryJob(id)
  retryJob: async (id) => {
    try {
      set({ loading: true, error: null });
      const job = await apiRetryJob(id);
      set((state) => ({ jobs: state.jobs.map((j) => (j._id === id ? job : j)), loading: false }));
      return job;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // deleteJob(id)
  deleteJob: async (id) => {
    try {
      set({ loading: true, error: null });
      await apiDeleteJob(id);
      set((state) => ({
        jobs: state.jobs.filter((j) => j._id !== id && j.id !== id),
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // removeJob(id) ← called by socket
  removeJob: (id) => {
    set((state) => ({
      jobs: state.jobs.filter((j) => j._id !== id && j.id !== id)
    }));
  },

  // updateJob(job) ← called by socket
  updateJob: (job) => {
    set((state) => {
      const normalized = { ...job, _id: job.id || job._id };
      const exists = state.jobs.some((j) => j._id === normalized._id);

      if (!exists) {
        return { jobs: [normalized, ...state.jobs] };
      }

      return { jobs: state.jobs.map((j) => (j._id === normalized._id ? { ...j, ...normalized } : j)) };
    });
  },

  // updateWorker(worker) ← called by socket
  updateWorker: (worker) => {
    set((state) => {
      const exists = state.workers.some((w) => w.workerId === worker.workerId);
      if (!exists) {
        return { workers: [worker, ...state.workers] };
      }
      return { workers: state.workers.map((w) => (w.workerId === worker.workerId ? { ...w, ...worker } : w)) };
    });
  },

  // updateJobProgress(jobId, progress, log)
  updateJobProgress: (jobId, progress, log) => {
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j._id === jobId || j.id === jobId) {
          const next = { ...j, progress };
          if (log) {
            next.logs = [...(j.logs || []), { timestamp: new Date().toISOString(), message: log }];
          }
          return next;
        }
        return j;
      })
    }));
  }
}));

export default useJobStore;
