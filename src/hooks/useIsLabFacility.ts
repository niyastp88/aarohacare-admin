import { useAuth } from '@/hooks/useAuth';
import { useMyFacility } from '@/hooks/useFacility';
import { FACILITY_TYPES } from '@/constants/roles';

/** True when this admin's facility is a diagnostic lab. */
export const useIsLabFacility = () => {
  const { user } = useAuth();
  const facilityQuery = useMyFacility();
  const type =
    facilityQuery.data?.facilityType ||
    user?.facility?.facilityType ||
    user?.facilityType;
  return type === FACILITY_TYPES.LAB;
};
