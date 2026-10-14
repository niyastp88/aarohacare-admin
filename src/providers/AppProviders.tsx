import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SweetAlertHost } from '@/components/ui/SweetAlert';
import { ToastHost } from '@/components/ui/Toast';
import { QUERY_DEFAULTS } from '@/constants/app';
import { StoreProvider } from '@/store/StoreProvider';
import { RealtimeProvider } from '@/realtime/RealtimeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_DEFAULTS.STALE_TIME_MS,
      retry: QUERY_DEFAULTS.RETRY,
      refetchOnWindowFocus: false,
    },
  },
});

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <StoreProvider>
      <RealtimeProvider>
        {children}
        <ToastHost />
        <SweetAlertHost />
      </RealtimeProvider>
    </StoreProvider>
  </QueryClientProvider>
);
