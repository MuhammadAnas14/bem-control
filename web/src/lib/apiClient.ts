import { BemControlClient } from '@bem-control/api-client';
import { getToken } from '../state/authStore';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const apiClient = new BemControlClient({
  baseUrl: API_URL,
  getToken: () => getToken(),
});

export const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4001';
