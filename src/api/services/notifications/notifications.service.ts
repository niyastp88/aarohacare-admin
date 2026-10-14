import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type { AppNotificationDto, NotificationListDto } from '@/types/dto';

export const notificationService = {
  list: async () => {
    const { data } = await apiClient.get<NotificationListDto>(API_PATHS.NOTIFICATIONS.LIST);
    return data;
  },

  markRead: async (id: string) => {
    const { data } = await apiClient.patch<AppNotificationDto>(API_PATHS.NOTIFICATIONS.READ(id));
    return data;
  },

  markAllRead: async () => {
    const { data } = await apiClient.patch(API_PATHS.NOTIFICATIONS.READ_ALL);
    return data;
  },
};
