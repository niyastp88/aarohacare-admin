import { useEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { useAppDispatch } from './hooks';
import { bootstrapAuth } from './slices/authSlice';
import { store } from './store';

const AuthBootstrap = ({ children }: { children: ReactNode }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    void dispatch(bootstrapAuth());
  }, [dispatch]);

  return <>{children}</>;
};

/** Redux store + one-time cookie session restore. */
export const StoreProvider = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <AuthBootstrap>{children}</AuthBootstrap>
  </Provider>
);
