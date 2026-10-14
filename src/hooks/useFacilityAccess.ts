import { useQuery } from '@tanstack/react-query';
import { authService } from '@/api/services/auth';
import { useAuth } from '@/hooks/useAuth';

export const isFacilityApproved = (status?: string) => status === 'APPROVED';

/** Pending/rejected facility admins may only use the dashboard until Super Admin approves. */
export const useFacilityAccess = () => {
  const { user, establishSession } = useAuth();
  const status = user?.facility?.approvalStatus;
  const approved = isFacilityApproved(status);
  const rejected = status === 'REJECTED';
  const pending = Boolean(user) && !approved && !rejected;

  useQuery({
    queryKey: ['auth', 'me', 'approval'],
    queryFn: async () => {
      const next = await authService.me();
      establishSession(next);
      return next;
    },
    enabled: Boolean(user) && !approved,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  return {
    approved,
    rejected,
    pending,
    status,
    facility: user?.facility,
  };
};
