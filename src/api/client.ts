import axios, { AxiosError } from 'axios';
import { APP } from '@/constants/app';
import { API_PATHS } from '@/constants/paths';
import { clearSession } from '@/store/slices/authSlice';
import { store } from '@/store/store';
import type { ApiErrorResponseDto, RefreshResponseDto } from '@/types/dto';
import { CSRF_HEADER, readCsrfToken, rememberCsrfToken, clearRememberedCsrfToken } from '@/utils/csrf';
import { logger } from '@/utils/logger';

const apiLog = logger.child('api');
const rawApiUrl = import.meta.env.VITE_API_URL ?? APP.DEFAULT_API_URL;
const apiUrl = String(rawApiUrl).replace(/\/+$/, '');

/**
 * Cookie-session API client.
 * JWTs: httpOnly cookies. CSRF: double-submit header from readable cookie.
 */
export const apiClient = axios.create({
  baseURL: `${apiUrl}/api`,
  timeout: APP.API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-Client': 'web',
  },
  withCredentials: true,
});

const isAuthCredentialRequest = (url?: string) => {
  const path = url ?? '';
  return (
    path.includes(API_PATHS.AUTH.LOGIN) ||
    path.includes(API_PATHS.AUTH.REGISTER) ||
    path.includes(API_PATHS.AUTH.REFRESH) ||
    path.includes(API_PATHS.AUTH.FORGOT_PASSWORD) ||
    path.includes(API_PATHS.AUTH.RESET_PASSWORD) ||
    path.includes(API_PATHS.AUTH.CSRF) ||
    path.includes(API_PATHS.AUTH.ME) ||
    path.includes(API_PATHS.AUTH.LOGOUT)
  );
};

const expireSession = () => {
  const hadSession = Boolean(store.getState().auth.user);
  store.dispatch(clearSession(hadSession ? { reason: 'session_expired' } : undefined));
  if (hadSession) {
    window.dispatchEvent(new Event(APP.SESSION_EXPIRED_EVENT));
  }
};

apiClient.interceptors.request.use((config) => {
  const csrf = readCsrfToken();
  if (csrf) {
    config.headers.set(CSRF_HEADER, csrf);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponseDto>) => {
    const originalRequest = error.config as
      | (typeof error.config & { _retry?: boolean; _csrfRetry?: boolean })
      | undefined;

    const message = error.response?.data?.message;
    if (
      error.response?.status === 403 &&
      message === 'Invalid CSRF token' &&
      originalRequest &&
      !originalRequest._csrfRetry
    ) {
      originalRequest._csrfRetry = true;
      try {
        clearRememberedCsrfToken();
        const { authService } = await import('@/api/services/auth');
        await authService.ensureCsrf(true);
        return apiClient(originalRequest);
      } catch {
        // Fall through to normal error handling.
      }
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthCredentialRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await axios.post<RefreshResponseDto>(
          `${apiUrl}/api${API_PATHS.AUTH.REFRESH}`,
          {},
          {
            timeout: APP.API_TIMEOUT_MS,
            withCredentials: true,
            headers: {
              'X-Client': 'web',
              ...(readCsrfToken() ? { [CSRF_HEADER]: readCsrfToken()! } : {}),
            },
          },
        );
        rememberCsrfToken(refreshResponse.data.csrfToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        apiLog.warn('Session refresh failed', refreshError);
        expireSession();
      }
    }

    if (error.response) {
      apiLog.warn(`${error.response.status} ${originalRequest?.method?.toUpperCase() ?? 'REQ'} ${originalRequest?.url ?? ''}`, error.response.data);
    } else {
      apiLog.error('Network / request failure', error.message);
    }

    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<ApiErrorResponseDto>(error)) {
    if (error.code === 'ECONNABORTED') return 'Request timed out. Is the server running?';
    if (!error.response) return 'Cannot reach the server. Check your connection.';
    return error.response.data?.message ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
};
