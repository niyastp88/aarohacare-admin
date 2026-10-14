import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type {
  AuthResponseDto,
  CsrfResponseDto,
  ForgotPasswordRequestDto,
  LoginRequestDto,
  MeResponseDto,
  RefreshRequestDto,
  RefreshResponseDto,
  RegisterAdminRequestDto,
  ResetPasswordRequestDto,
  ChangePasswordRequestDto,
  UserResponseDto,
} from '@/types/dto';
import { clearRememberedCsrfToken, readCsrfToken, rememberCsrfToken } from '@/utils/csrf';

const captureCsrf = (csrfToken?: string) => {
  rememberCsrfToken(csrfToken);
};

export const authService = {
  /** Fetch a fresh CSRF token. Pass force=true before login / register / forgot. */
  ensureCsrf: async (force = false): Promise<void> => {
    if (!force && readCsrfToken()) return;
    clearRememberedCsrfToken();
    const { data } = await apiClient.get<CsrfResponseDto>(API_PATHS.AUTH.CSRF);
    captureCsrf(data.csrfToken);
  },

  login: async (payload: LoginRequestDto): Promise<AuthResponseDto> => {
    await authService.ensureCsrf(true);
    const { data } = await apiClient.post<AuthResponseDto>(API_PATHS.AUTH.LOGIN, payload);
    captureCsrf(data.csrfToken);
    return data;
  },

  register: async (payload: RegisterAdminRequestDto): Promise<AuthResponseDto> => {
    await authService.ensureCsrf(true);
    const { data } = await apiClient.post<AuthResponseDto>(API_PATHS.AUTH.REGISTER, payload);
    captureCsrf(data.csrfToken);
    return data;
  },

  forgotPassword: async (payload: ForgotPasswordRequestDto): Promise<{ message: string }> => {
    await authService.ensureCsrf(true);
    const { data } = await apiClient.post<{ message: string }>(
      API_PATHS.AUTH.FORGOT_PASSWORD,
      payload,
    );
    return data;
  },

  resetPassword: async (payload: ResetPasswordRequestDto): Promise<{ message: string }> => {
    await authService.ensureCsrf(true);
    const { data } = await apiClient.post<{ message: string }>(
      API_PATHS.AUTH.RESET_PASSWORD,
      payload,
    );
    return data;
  },

  refresh: async (payload: RefreshRequestDto = {}): Promise<RefreshResponseDto> => {
    const { data } = await apiClient.post<RefreshResponseDto>(API_PATHS.AUTH.REFRESH, payload);
    captureCsrf(data.csrfToken);
    return data;
  },

  me: async (): Promise<UserResponseDto> => {
    const { data } = await apiClient.get<MeResponseDto>(API_PATHS.AUTH.ME);
    captureCsrf(data.csrfToken);
    return data.user;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_PATHS.AUTH.LOGOUT);
    } finally {
      clearRememberedCsrfToken();
    }
  },

  changePassword: async (payload: ChangePasswordRequestDto): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>(
      API_PATHS.AUTH.CHANGE_PASSWORD,
      payload,
    );
    return data;
  },
};
