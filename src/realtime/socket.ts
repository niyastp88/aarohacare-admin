import { io, type Socket } from 'socket.io-client';
import { APP } from '@/constants/app';
import { logger } from '@/utils/logger';

export const SOCKET_EVENTS = {
  NOTIFICATION_NEW: 'notification:new',
  TICKET_NEW: 'ticket:new',
  TICKET_REPLY: 'ticket:reply',
  TICKET_RESOLVED: 'ticket:resolved',
  // Added QUEUE_UPDATED to receive immediate notifications when a doctor's live queue changes
  QUEUE_UPDATED: 'queue:updated',
} as const;

const SOCKET_PATH = '/api/socket.io';

const origin = String(import.meta.env.VITE_API_URL ?? APP.DEFAULT_API_URL).replace(/\/+$/, '');

let socket: Socket | null = null;

export const connectRealtime = () => {
  if (socket?.connected) return socket;
  socket?.disconnect();
  socket = io(origin, {
    path: SOCKET_PATH,
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
  socket.on('connect', () => logger.debug('socket connected'));
  socket.on('connect_error', (err) => logger.warn('socket connect error', err.message));
  return socket;
};

export const disconnectRealtime = () => {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
};
