export type EmergencyTicketSource = 'PATIENT' | 'FACILITY_ADMIN' | 'SUPER_ADMIN';
export type EmergencyTicketChannel = 'FEEDBACK' | 'SUPPORT' | 'SETTINGS_ALERT' | 'SUPER_ADMIN';

export interface EmergencyTicketReplyDto {
  body: string;
  authorId?: string;
  fromRole?: 'USER' | 'SUPER_ADMIN';
  createdAt?: string;
}

export interface EmergencyTicketDto {
  _id: string;
  subject: string;
  body: string;
  priority: 'NORMAL' | 'EMERGENCY';
  status: 'OPEN' | 'RESOLVED';
  source?: EmergencyTicketSource;
  channel?: EmergencyTicketChannel;
  createdBy?: string | { _id: string; name?: string };
  replies?: EmergencyTicketReplyDto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEmergencyTicketRequestDto {
  body: string;
  subject?: string;
  priority?: 'NORMAL' | 'EMERGENCY';
  channel?: EmergencyTicketChannel;
}

export interface AppNotificationDto {
  _id: string;
  title: string;
  body: string;
  type?: string;
  ticketId?: string;
  read: boolean;
  createdAt?: string;
}

export interface NotificationListDto {
  items: AppNotificationDto[];
  unreadCount: number;
}
