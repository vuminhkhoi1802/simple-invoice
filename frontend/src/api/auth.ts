import { http, toApiError } from './client';
import type { LoginResponse, UserProfile } from './types';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      return (await http.post<LoginResponse>('/auth/login', { email, password })).data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async me(): Promise<UserProfile> {
    try {
      return (await http.get<UserProfile>('/auth/me')).data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout').catch(() => undefined);
  },
};
