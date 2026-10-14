import { useMutation } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/api/client';
import { authService } from '@/api/services/auth';
import { useAuth } from '@/hooks/useAuth';
import type { RegisterAdminRequestDto } from '@/types/dto';

export const useRegister = () => {
  const { establishSession } = useAuth();

  return useMutation({
    mutationFn: (payload: RegisterAdminRequestDto) => authService.register(payload),
    onSuccess: ({ user }) => {
      establishSession(user);
    },
    meta: { getErrorMessage: getApiErrorMessage },
  });
};
