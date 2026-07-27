import { BemControlClient } from '@bem-control/api-client';
import { API_URL } from './config';
import { getToken } from '../state/authStore';

export const apiClient = new BemControlClient({
  baseUrl: API_URL,
  getToken: () => getToken(),
});
