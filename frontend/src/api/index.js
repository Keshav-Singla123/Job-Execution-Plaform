import axios from 'axios';

const BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jobPlatformToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      // clear token and redirect to login
      localStorage.removeItem('jobPlatformToken');
      window.location.href = '/login';
    }

    return Promise.reject(err);
  }
);

export async function login(credentials) {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
}

export async function register(credentials) {
  const response = await api.post('/api/auth/register', credentials);
  return response.data;
}

export async function getJobs(filters = {}) {
  const response = await api.get('/api/jobs', { params: filters });
  return response.data.jobs;
}

export async function getJob(id) {
  const response = await api.get(`/api/jobs/${id}`);
  return response.data.job;
}

export async function createJob(data) {
  const response = await api.post('/api/jobs', data);
  return response.data.job;
}

export async function cancelJob(id) {
  const response = await api.post(`/api/jobs/${id}/cancel`);
  return response.data.job;
}

export async function retryJob(id) {
  const response = await api.put(`/api/jobs/${id}/retry`);
  return response.data.job;
}

export async function deleteJob(id) {
  const response = await api.delete(`/api/jobs/${id}`);
  return response.data;
}

export async function getWorkers() {
  const response = await api.get('/api/workers');
  return response.data.workers;
}

export async function getStats() {
  const response = await api.get('/api/jobs/stats');
  return response.data;
}

export default api;
