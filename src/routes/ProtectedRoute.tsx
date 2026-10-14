import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { APP_ROUTES } from '@/constants/routes';
import { USER_ROLES } from '@/constants/roles';
import { useAuth } from '@/hooks/useAuth';
import { isFacilityApproved } from '@/hooks/useFacilityAccess';

/** Only facility ADMIN accounts may enter the portal. */
export const ProtectedRoute = () => {
  const { user, isAuthenticated, isBootstrapping, logout } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <Spinner label="Checking session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={APP_ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (user?.role !== USER_ROLES.ADMIN) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-xl font-bold">This portal is for facility admins</h2>
        <p className="text-muted">
          Your account does not have admin access. Please use the Aarohcare mobile app instead.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            sweetAlert.confirm(
              'Log out?',
              'You will need to sign in again with an admin account.',
              () => {
                void logout();
              },
              { confirmText: 'Log out', cancelText: 'Cancel', tone: 'danger' },
            );
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  const onDashboard = location.pathname === APP_ROUTES.ADMIN.ROOT;
  const onChat = location.pathname === APP_ROUTES.ADMIN.CHAT;
  if (!isFacilityApproved(user.facility?.approvalStatus) && !onDashboard && !onChat) {
    return <Navigate to={APP_ROUTES.ADMIN.ROOT} replace />;
  }

  return <Outlet />;
};
