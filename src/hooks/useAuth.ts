import { useCallback, useMemo } from 'react';
import { authService } from '@/api/services/auth';
import {
  clearSession,
  clearSessionExpired,
  selectIsAuthenticated,
  selectIsBootstrapping,
  selectSessionExpired,
  selectUser,
  setSession,
  useAppDispatch,
  useAppSelector,
} from '@/store';
import type { User } from '@/types';

/** App-facing auth API — cookie session + Redux user only. */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isBootstrapping = useAppSelector(selectIsBootstrapping);
  const sessionExpired = useAppSelector(selectSessionExpired);

  const establishSession = useCallback(
    (nextUser: User) => {
      dispatch(setSession(nextUser));
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Always clear client session if the network call fails
    }
    dispatch(clearSession());
  }, [dispatch]);

  const dismissSessionExpired = useCallback(() => {
    dispatch(clearSessionExpired());
  }, [dispatch]);

  return useMemo(
    () => ({
      user,
      isAuthenticated,
      isBootstrapping,
      sessionExpired,
      establishSession,
      logout,
      clearSessionExpired: dismissSessionExpired,
    }),
    [
      user,
      isAuthenticated,
      isBootstrapping,
      sessionExpired,
      establishSession,
      logout,
      dismissSessionExpired,
    ],
  );
};
