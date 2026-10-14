import { useMutation } from '@tanstack/react-query';
import { authService } from '@/api/services/auth';
import type { ChangePasswordRequestDto } from '@/types/dto';

export const useChangePassword = () =>
  useMutation({
    mutationFn: (payload: ChangePasswordRequestDto) => authService.changePassword(payload),
  });
