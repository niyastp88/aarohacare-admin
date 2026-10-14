import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/types';

export interface AuthState {
  user: User | null;
  isBootstrapping: boolean;
  sessionExpired: boolean;
}

const initialState: AuthState = {
  user: null,
  isBootstrapping: true,
  sessionExpired: false,
};

/** One-time cleanup of older insecure client-side token storage. */
const scrubLegacyAuthStorage = () => {
  for (const key of ['aarohcare.token', 'aarohcare.refreshToken', 'aarohcare.user'] as const) {
    localStorage.removeItem(key);
  }
};

/**
 * Restore session from httpOnly cookies.
 * Tokens never enter Redux or localStorage.
 */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async () => {
  scrubLegacyAuthStorage();

  const { authService } = await import('@/api/services/auth');
  await authService.ensureCsrf();

  try {
    return { user: await authService.me() };
  } catch {
    await authService.refresh({});
    return { user: await authService.me() };
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.sessionExpired = false;
    },
    clearSession(
      state,
      action: PayloadAction<{ reason?: 'session_expired' } | undefined>,
    ) {
      state.user = null;
      state.sessionExpired = action.payload?.reason === 'session_expired';
    },
    clearSessionExpired(state) {
      state.sessionExpired = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(bootstrapAuth.pending, (state) => {
        state.isBootstrapping = true;
      })
      .addCase(bootstrapAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isBootstrapping = false;
      })
      .addCase(bootstrapAuth.rejected, (state) => {
        state.user = null;
        state.isBootstrapping = false;
      });
  },
});

export const { setSession, clearSession, clearSessionExpired } = authSlice.actions;
export const authReducer = authSlice.reducer;
