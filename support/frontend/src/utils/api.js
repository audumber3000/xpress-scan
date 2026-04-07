import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002/api/v1';

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('support_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('support_token');
      localStorage.removeItem('support_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
