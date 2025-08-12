import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function api(token?: string) {
  const instance = axios.create({ baseURL: API });
  if (token) instance.interceptors.request.use(cfg => { cfg.headers = cfg.headers || {}; cfg.headers['Authorization'] = `Bearer ${token}`; return cfg; });
  return instance;
}