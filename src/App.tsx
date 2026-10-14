import { AppProviders } from '@/providers/AppProviders';
import { AppRouter } from '@/routes/AppRouter';

export const App = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);
