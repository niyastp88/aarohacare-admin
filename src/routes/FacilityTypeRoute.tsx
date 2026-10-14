import { Navigate, Outlet } from 'react-router-dom';
import { APP_ROUTES } from '@/constants/routes';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';

/** Lab portal pages — clinics/hospitals are sent home. */
export const LabOnlyRoute = () => {
  const isLab = useIsLabFacility();
  if (!isLab) return <Navigate to={APP_ROUTES.ADMIN.ROOT} replace />;
  return <Outlet />;
};

/** Clinic/hospital pages — labs are sent home. */
export const ClinicOnlyRoute = () => {
  const isLab = useIsLabFacility();
  if (isLab) return <Navigate to={APP_ROUTES.ADMIN.ROOT} replace />;
  return <Outlet />;
};
