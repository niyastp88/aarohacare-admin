import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/api/services/notifications';
import { APP_ROUTES } from '@/constants/routes';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';
import { IconBell } from './icons';

type NotificationBellProps = {
  className?: string;
};

const formatWhen = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const NotificationBell = ({ className }: NotificationBellProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list(),
    refetchInterval: 30_000,
  });

  const items = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const isLab = useIsLabFacility();

  const handleBellClick = () => {
    if (isLab) {
      navigate(APP_ROUTES.ADMIN.NOTIFICATIONS);
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleBellClick}
        className={
          className ||
          'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#4B5563] transition hover:bg-white'
        }
        aria-label="Notifications"
        aria-expanded={open}
      >
        <IconBell />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#E11D48] px-1 text-[10px] font-bold leading-4 text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#E5EAF0] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#EEF2F6] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#0B2A4A]">Notifications</p>
              <p className="text-[11px] text-[#64748B]">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'Super Admin messages and replies'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-[12px] font-bold text-[#1B64F2]"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {listQuery.isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">
                No notifications yet.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className={[
                    'w-full border-b border-[#F1F5F9] px-4 py-3 text-left hover:bg-[#F8FAFC]',
                    item.read ? 'bg-white' : 'bg-[#F5F9FF]',
                  ].join(' ')}
                  onClick={() => {
                    if (!item.read) markOne.mutate(item._id);
                    setOpen(false);
                    if (item.ticketId) {
                      navigate(
                        `${APP_ROUTES.ADMIN.CHAT}?ticket=${encodeURIComponent(item.ticketId)}`,
                      );
                    } else if (item.type === 'LAB_REPORT_REMINDER') {
                      navigate(APP_ROUTES.ADMIN.REPORTS);
                    }
                  }}
                >
                  <p className="truncate text-[13px] font-bold text-[#0B2A4A]">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] text-[#64748B]">{item.body}</p>
                  <p className="mt-1.5 text-[11px] font-medium text-[#94A3B8]">
                    {formatWhen(item.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[#EEF2F6] bg-[#F8FAFC] px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(APP_ROUTES.ADMIN.NOTIFICATIONS);
              }}
              className="text-[12.5px] font-bold text-[#2563EB] hover:underline"
            >
              View all notifications & filters →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
