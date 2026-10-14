import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type { CreateEmergencyTicketRequestDto, EmergencyTicketDto } from '@/types/dto';

export const emergencyService = {
  listMine: async () => {
    const { data } = await apiClient.get<EmergencyTicketDto[]>(API_PATHS.EMERGENCY.MINE);
    return data;
  },

  create: async (payload: CreateEmergencyTicketRequestDto) => {
    const { data } = await apiClient.post<EmergencyTicketDto>(API_PATHS.EMERGENCY.CREATE, payload);
    return data;
  },

  reply: async (id: string, body: string, priority?: 'NORMAL' | 'EMERGENCY') => {
    const { data } = await apiClient.post<EmergencyTicketDto>(API_PATHS.EMERGENCY.REPLY(id), {
      body,
      priority,
    });
    return data;
  },
};
