import type { RootState } from '../store';

export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => Boolean(state.auth.user);
export const selectIsBootstrapping = (state: RootState) => state.auth.isBootstrapping;
export const selectSessionExpired = (state: RootState) => state.auth.sessionExpired;
