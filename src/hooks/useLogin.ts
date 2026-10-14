import { useMutation } from '@tanstack/react-query';
import { getApiErrorMessage } from '@/api/client';
import { authService } from '@/api/services/auth';
import { useAuth } from '@/hooks/useAuth';
import type { LoginRequestDto } from '@/types/dto';

export const useLogin = () => {
  const { establishSession } = useAuth();

  return useMutation({
    mutationFn: (payload: LoginRequestDto) => authService.login(payload),
    onSuccess: ({ user }) => {
      // Tokens are set as httpOnly cookies by the API; Redux keeps user only.
      establishSession(user);
    },
    meta: { getErrorMessage: getApiErrorMessage },
  });
};
