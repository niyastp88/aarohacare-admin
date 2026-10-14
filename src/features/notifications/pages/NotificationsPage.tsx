import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/api/services/notifications';
import { Spinner } from '@/components/ui/Spinner';
import { APP_ROUTES } from '@/constants/routes';
import type { AppNotificationDto } from '@/types/dto';

type StatusTab = 'ALL' | 'UNREAD' | 'READ';
type TypeFilter = 'ALL' | 'TICKET' | 'LAB' | 'OTHER';

const formatWhen = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [search, setSearch] = useState('');

  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list(),
    refetchInterval: 30_000,
  });

  const allItems = listQuery.data?.items ?? [];
  const unreadCount = listQuery.data?.unreadCount ?? 0;
  const readCount = Math.max(0, allItems.length - unreadCount);

  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const filteredItems = useMemo(() => {
    let list = allItems;

    // Filter by Read / Unread status
    if (statusTab === 'UNREAD') {
      list = list.filter((item) => !item.read);
    } else if (statusTab === 'READ') {
      list = list.filter((item) => item.read);
    }

    // Filter by Type
    if (typeFilter === 'TICKET') {
      list = list.filter((item) => Boolean(item.ticketId) || item.type?.toUpperCase().includes('TICKET'));
    } else if (typeFilter === 'LAB') {
      list = list.filter((item) => item.type?.toUpperCase().includes('LAB') || item.type?.toUpperCase().includes('REPORT'));
    } else if (typeFilter === 'OTHER') {
      list = list.filter(
        (item) =>
          !item.ticketId &&
          !item.type?.toUpperCase().includes('TICKET') &&
          !item.type?.toUpperCase().includes('LAB') &&
          !item.type?.toUpperCase().includes('REPORT'),
      );
    }

    // Filter by Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          (item.type && item.type.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [allItems, statusTab, typeFilter, search]);

  const handleItemClick = (item: AppNotificationDto) => {
    if (!item.read) {
      markOne.mutate(item._id);
    }
    if (item.ticketId) {
      navigate(`${APP_ROUTES.ADMIN.CHAT}?ticket=${encodeURIComponent(item.ticketId)}`);
    } else if (item.type === 'LAB_REPORT_REMINDER' || item.type?.toUpperCase().includes('REPORT')) {
      navigate(APP_ROUTES.ADMIN.REPORTS);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36] sm:text-[32px]">
              Notifications
            </h1>
            {unreadCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-[#E11D48] px-2.5 py-0.5 text-[12px] font-bold text-white">
                {unreadCount} Unread
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[14px] text-[#64748B]">
            Review all announcements, chat replies, and system alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={markAll.isPending}
              onClick={() => markAll.mutate()}
              className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-[13px] font-bold text-[#1E40AF] shadow-xs hover:bg-[#EFF6FF] hover:border-[#93C5FD] transition disabled:opacity-50"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs: All, Unread, Read */}
          <div className="flex items-center gap-1.5 rounded-xl bg-[#F1F5F9] p-1">
            <button
              type="button"
              onClick={() => setStatusTab('ALL')}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                statusTab === 'ALL'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              All ({allItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('UNREAD')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                statusTab === 'UNREAD'
                  ? 'bg-white text-[#E11D48] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#E11D48] px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('READ')}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                statusTab === 'READ'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Read ({readCount})
            </button>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-bold text-[#94A3B8] uppercase mr-1">Type:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'TICKET', label: 'Support / Chat' },
              { id: 'LAB', label: 'Lab Reports' },
              { id: 'OTHER', label: 'System' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id as TypeFilter)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-bold transition ${
                  typeFilter === t.id
                    ? 'bg-[#0B2A4A] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#E2E8F0]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative pt-1 border-t border-[#F1F5F9]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="6" />
              <line x1="16" y1="16" x2="21" y2="21" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within notifications..."
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pl-9 pr-4 text-[13.5px] outline-none placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white"
          />
        </div>
      </div>

      {/* Notifications List */}
      {listQuery.isLoading ? (
        <div className="p-12 text-center">
          <Spinner label="Loading notifications…" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-16 text-center shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="mt-3 text-[16px] font-bold text-[#1A1F36]">No notifications found</p>
          <p className="mt-1 text-[13.5px] text-[#64748B]">
            {search
              ? 'No notifications match your search query.'
              : statusTab === 'UNREAD'
                ? 'All caught up! You have no unread notifications.'
                : 'No notifications in this category yet.'}
          </p>
          {statusTab !== 'ALL' || typeFilter !== 'ALL' || search ? (
            <button
              type="button"
              onClick={() => {
                setStatusTab('ALL');
                setTypeFilter('ALL');
                setSearch('');
              }}
              className="mt-4 text-[13px] font-bold text-[#2563EB] hover:underline"
            >
              Reset all filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item) => {
            const hasAction =
              Boolean(item.ticketId) ||
              item.type === 'LAB_REPORT_REMINDER' ||
              item.type?.toUpperCase().includes('REPORT');

            return (
              <div
                key={item._id}
                className={`relative flex flex-col gap-3 rounded-2xl border p-5 shadow-xs transition hover:shadow-sm ${
                  item.read
                    ? 'border-[#E2E8F0] bg-white'
                    : 'border-[#BFDBFE] bg-[#F5F9FF]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Unread / Read Indicator icon */}
                    <div className="mt-0.5 shrink-0">
                      {item.read ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8]">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
                          <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[15px] font-bold text-[#0F172A]">{item.title}</h2>
                        {!item.read && (
                          <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
                            NEW
                          </span>
                        )}
                        {item.type && (
                          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                            {item.type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#475569]">
                        {item.body}
                      </p>
                      <p className="mt-2 text-[12px] font-medium text-[#94A3B8]">
                        {formatWhen(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions on right */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => markOne.mutate(item._id)}
                        className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-[12px] font-bold text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition"
                      >
                        Mark read
                      </button>
                    )}

                    {hasAction && (
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#1D4ED8] transition"
                      >
                        {item.ticketId
                          ? 'Open Ticket →'
                          : 'View Reports →'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer link to Dashboard / Reports */}
      <div className="flex justify-center pt-3">
        <Link
          to={APP_ROUTES.ADMIN.ROOT}
          className="text-[13px] font-bold text-[#64748B] hover:text-[#0F172A] transition"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
