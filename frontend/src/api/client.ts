import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from './types';

/**
 * Single axios instance. Auth is carried by the httpOnly cookie set at login
 * (withCredentials), so the JWT is never readable by JavaScript — an XSS bug
 * cannot exfiltrate it from storage.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

type UnauthorizedListener = () => void;
const listeners = new Set<UnauthorizedListener>();

/** Lets the auth layer react to a 401 from any request (expired/invalid session). */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    // A failed login is a normal form error, not an expired session.
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      listeners.forEach((l) => l());
    }
    return Promise.reject(error);
  },
);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly messages: string[],
  ) {
    super(messages.join('\n'));
    this.name = 'ApiError';
  }
}

/** Normalises axios/network errors into an ApiError with human-readable messages. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined;
    const status = error.response?.status ?? 0;
    if (body?.message) {
      return new ApiError(status, Array.isArray(body.message) ? body.message : [body.message]);
    }
    if (!error.response) {
      return new ApiError(0, ['Unable to reach the server. Check your connection and try again.']);
    }
    return new ApiError(status, [error.message]);
  }
  return new ApiError(0, ['Something went wrong. Please try again.']);
}
