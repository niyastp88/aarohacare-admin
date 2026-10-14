import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { showToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { SOCKET_EVENTS, connectRealtime, disconnectRealtime } from './socket';

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectRealtime();
      return;
    }

    const socket = connectRealtime();
    const refreshInbox = () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['emergency'] });
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, (payload: { title?: string; body?: string }) => {
      refreshInbox();
      showToast(payload?.title || 'New message from Aarohacare Technologies Pvt Ltd');
    });
    socket.on(SOCKET_EVENTS.TICKET_NEW, (payload: { subject?: string }) => {
      refreshInbox();
      showToast(payload?.subject ? `New message: ${payload.subject}` : 'New message from Aarohacare Technologies Pvt Ltd');
    });
    socket.on(SOCKET_EVENTS.TICKET_REPLY, refreshInbox);
    socket.on(SOCKET_EVENTS.TICKET_RESOLVED, refreshInbox);
    
    // Listen for real-time queue updates to immediately refresh the live OP board, queue, and appointment lists
    // across all admin views instead of waiting for the slower default polling interval.
    socket.on(SOCKET_EVENTS.QUEUE_UPDATED, () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.schedules.all });
    });

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW);
      socket.off(SOCKET_EVENTS.TICKET_NEW);
      socket.off(SOCKET_EVENTS.TICKET_REPLY);
      socket.off(SOCKET_EVENTS.TICKET_RESOLVED);
      socket.off(SOCKET_EVENTS.QUEUE_UPDATED);
      disconnectRealtime();
    };
  }, [isAuthenticated, qc]);

  return children;
};
