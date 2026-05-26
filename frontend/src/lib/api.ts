import axios from 'axios';

import { isTokenExpired } from './auth-token';
import { useAuthStore } from './auth-store';

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  } | null;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    if (isTokenExpired(token)) {
      useAuthStore.getState().clearSession();
      return Promise.reject(new Error('Session expired.'));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  },
);
