import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { emergencyService } from '@/api/services/emergency';
import { notificationService } from '@/api/services/notifications';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { showToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import type { EmergencyTicketDto, NotificationListDto } from '@/types/dto';
import {
  formatChatTime,
  getLatestIncomingMessageTimestamp,
  lastMessagePreview,
  ticketToBubbles,
} from '../lib/chat';

export const ChatPage = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const storageKey = `aarohcare_read_chat_${user?._id || 'admin'}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('ticket') || '';
  const isEmergencyParam = searchParams.get('emergency') === 'true';

  const [draft, setDraft] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [composing, setComposing] = useState(isEmergencyParam);
  const [isEmergency, setIsEmergency] = useState(isEmergencyParam);
  const [replyAsEmergency, setReplyAsEmergency] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [readMap, setReadMap] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  });

  const listQuery = useQuery({
    queryKey: ['emergency'],
    queryFn: () => emergencyService.listMine(),
    refetchInterval: 20_000,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list(),
  });

  const notifications = notificationsQuery.data?.items ?? [];
  const tickets = listQuery.data ?? [];
  const selected = useMemo(
    () => tickets.find((ticket) => ticket._id === selectedId) ?? tickets[0] ?? null,
    [tickets, selectedId],
  );

  useEffect(() => {
    if (isEmergencyParam) {
      setComposing(true);
      setIsEmergency(true);
    }
  }, [isEmergencyParam]);

  useEffect(() => {
    if (!selectedId && tickets[0]?._id && !composing) {
      setSearchParams({ ticket: tickets[0]._id }, { replace: true });
    }
  }, [selectedId, tickets, composing, setSearchParams]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?._id, selected?.replies?.length]);

  // Mark selected ticket as read (both local state and backend notifications)
  useEffect(() => {
    if (!selected?._id || composing) return;

    const ticketId = selected._id;
    const nowIso = new Date().toISOString();

    // 1. Update local read timestamp
    setReadMap((prev) => {
      const currentRead = prev[ticketId];
      const latestIncoming = getLatestIncomingMessageTimestamp(selected);
      if (
        currentRead &&
        (!latestIncoming || new Date(currentRead).getTime() >= new Date(latestIncoming).getTime())
      ) {
        return prev;
      }
      const next = { ...prev, [ticketId]: nowIso };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Clear backend unread notifications for this ticket
    const unreadNotifs = notifications.filter(
      (n) => n.ticketId === ticketId && !n.read,
    );
    if (unreadNotifs.length > 0) {
      qc.setQueryData<NotificationListDto>(['notifications'], (old) => {
        if (!old) return old;
        const unreadIds = new Set(unreadNotifs.map((n) => n._id));
        return {
          ...old,
          items: old.items.map((item) =>
            unreadIds.has(item._id) ? { ...item, read: true } : item,
          ),
          unreadCount: Math.max(0, old.unreadCount - unreadNotifs.length),
        };
      });

      unreadNotifs.forEach((n) => {
        notificationService.markRead(n._id).catch(() => {});
      });
    }
  }, [
    selected?._id,
    selected?.updatedAt,
    selected?.replies?.length,
    composing,
    notifications,
    storageKey,
    qc,
  ]);

  const isTicketUnread = useCallback(
    (ticket: EmergencyTicketDto): boolean => {
      if (ticket.status !== 'OPEN') return false;
      if (selected?._id === ticket._id && !composing) return false;

      // 1. Check existing backend notification status
      const hasUnreadNotif = notifications.some(
        (n) => n.ticketId === ticket._id && !n.read,
      );
      if (hasUnreadNotif) return true;

      // 2. Check latest incoming message from Super Admin vs local read map
      const latestIncoming = getLatestIncomingMessageTimestamp(ticket);
      if (latestIncoming) {
        const readAt = readMap[ticket._id];
        if (!readAt) {
          if (notificationsQuery.isSuccess) {
            return false;
          }
          return true;
        }
        return new Date(latestIncoming).getTime() > new Date(readAt).getTime();
      }

      return false;
    },
    [selected?._id, composing, notifications, notificationsQuery.isSuccess, readMap],
  );

  const selectTicket = (ticket: EmergencyTicketDto) => {
    setComposing(false);
    setReplyAsEmergency(false);
    setSearchParams({ ticket: ticket._id });
  };

  const startComposing = (emergencyMode = false) => {
    setComposing(true);
    setIsEmergency(emergencyMode);
    setNewSubject(emergencyMode ? 'Critical support alert' : '');
    setNewBody('');
  };

  const replyMutation = useMutation({
    mutationFn: ({ body, priority }: { body: string; priority?: 'NORMAL' | 'EMERGENCY' }) =>
      emergencyService.reply(selected!._id, body, priority),
    onSuccess: () => {
      setDraft('');
      setReplyAsEmergency(false);
      void qc.invalidateQueries({ queryKey: ['emergency'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      emergencyService.create({
        subject:
          newSubject.trim() ||
          (isEmergency ? 'Critical support alert' : 'Chat with Super Admin'),
        body: newBody.trim(),
        channel: 'SUPPORT',
        priority: isEmergency ? 'EMERGENCY' : 'NORMAL',
      }),
    onSuccess: (ticket) => {
      setNewSubject('');
      setNewBody('');
      setComposing(false);
      setIsEmergency(false);
      setSearchParams({ ticket: ticket._id });
      void qc.invalidateQueries({ queryKey: ['emergency'] });
      showToast(isEmergency ? '🚨 Emergency alert sent to Super Admin' : 'Message sent to Super Admin');
    },
    onError: (err) => showToast(getApiErrorMessage(err), 'error'),
  });

  const onReply = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected || selected.status === 'RESOLVED') return;
    replyMutation.mutate({ body, priority: replyAsEmergency ? 'EMERGENCY' : 'NORMAL' });
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    if (newBody.trim().length < 4) {
      showToast('Write a short message (at least 4 characters).', 'error');
      return;
    }
    createMutation.mutate();
  };

  const bubbles = selected ? ticketToBubbles(selected) : [];

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full max-w-[1280px] flex-col gap-4 lg:h-[calc(100dvh-6rem)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36]">Chat & Support</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Message Aarohcare Super Admin with standard inquiries or critical emergency alerts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="tel:+919072043355"
            className="hidden items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-[12px] font-bold text-[#1B64F2] shadow-xs hover:bg-[#EFF6FF] sm:inline-flex"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Helpline: +91 9072043355
          </a>
          <NotificationBell className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#4B5563] transition hover:bg-white" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#E5EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:grid-cols-[290px_1fr]">
        {/* Left Conversations Sidebar */}
        <aside className="flex min-h-0 flex-col border-b border-[#E5EAF0] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-[#EEF2F6] px-4 py-3">
            <p className="text-sm font-bold text-[#0B2A4A]">Conversations</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => startComposing(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#FCA5A5] bg-[#FFF1F2] px-2 py-1 text-[11px] font-bold text-[#DC2626] hover:bg-[#FEE2E2] transition"
                title="Send critical emergency alert"
              >
                <span>🚨</span> Alert
              </button>
              <button
                type="button"
                onClick={() => startComposing(false)}
                className="rounded-lg bg-[#0B2A4A] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#081F37] transition"
              >
                + New
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">
                No chats yet. Start one with Super Admin.
              </p>
            ) : (
              tickets.map((ticket) => {
                const active = ticket._id === selected?._id && !composing;
                const isTicketEmergency = ticket.priority === 'EMERGENCY';

                return (
                  <button
                    key={ticket._id}
                    type="button"
                    onClick={() => selectTicket(ticket)}
                    className={[
                      'w-full border-b border-[#F1F5F9] px-4 py-3 text-left transition',
                      active ? 'bg-[#EFF6FF]' : 'bg-white hover:bg-[#F8FAFC]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isTicketEmergency && (
                          <span className="shrink-0 rounded bg-[#FEE2E2] px-1 py-0.2 text-[9px] font-extrabold text-[#DC2626]">
                            EMERGENCY
                          </span>
                        )}
                        <p className="truncate text-[13px] font-bold text-[#0B2A4A]">{ticket.subject}</p>
                      </div>
                      {isTicketUnread(ticket) ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" title="New message" />
                      ) : ticket.status !== 'OPEN' ? (
                        <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Closed</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-[#64748B]">
                      {lastMessagePreview(ticket)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Chat Panel */}
        <section className="flex min-h-0 flex-col">
          {composing ? (
            <form onSubmit={onCreate} className="flex min-h-0 flex-1 flex-col p-5 overflow-y-auto">
              <div className="flex items-center justify-between gap-3 border-b border-[#EEF2F6] pb-3">
                <h2 className="text-base font-bold text-[#0B2A4A]">New message to Super Admin</h2>
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                >
                  &times;
                </button>
              </div>

              {/* Emergency Option along with the message */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-[12.5px] font-bold uppercase tracking-wider text-[#64748B]">
                  Message Type:
                </span>
                <div className="flex items-center gap-1.5 rounded-xl bg-[#F1F5F9] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmergency(false);
                      if (newSubject === 'Critical support alert') setNewSubject('');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition ${
                      !isEmergency
                        ? 'bg-white text-[#0B2A4A] shadow-xs'
                        : 'text-[#64748B] hover:text-[#0B2A4A]'
                    }`}
                  >
                    <span>💬</span> Standard Message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmergency(true);
                      if (!newSubject) setNewSubject('Critical support alert');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition ${
                      isEmergency
                        ? 'bg-[#DC2626] text-white shadow-xs'
                        : 'text-[#DC2626] hover:bg-[#FEE2E2]'
                    }`}
                  >
                    <span>🚨</span> Emergency Alert
                  </button>
                </div>
              </div>

              {/* Emergency Banner */}
              {isEmergency && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-3 text-[13px] text-[#9F1239]">
                  <span className="text-base leading-none">⚡</span>
                  <div>
                    <p className="font-bold">Urgent Emergency Priority</p>
                    <p className="mt-0.5 text-[12px] opacity-90">
                      Super Admin will be alerted immediately with high-priority notifications and push alerts.
                    </p>
                  </div>
                </div>
              )}

              <input
                value={newSubject}
                onChange={(event) => setNewSubject(event.target.value)}
                placeholder={isEmergency ? 'Subject (e.g., Urgent Support Required)' : 'Subject (optional)'}
                className={`mt-4 rounded-xl border px-3.5 py-3 text-sm outline-none ${
                  isEmergency
                    ? 'border-[#FCA5A5] bg-[#FFFBFB] focus:border-[#DC2626]'
                    : 'border-[#E5EAF0] focus:border-[#0B2A4A]/40'
                }`}
              />

              <textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                placeholder={isEmergency ? 'Describe the critical emergency issue…' : 'Write your message…'}
                rows={6}
                className={`mt-3 min-h-[160px] flex-1 resize-none rounded-xl border px-3.5 py-3 text-sm outline-none ${
                  isEmergency
                    ? 'border-[#FCA5A5] bg-[#FFFBFB] focus:border-[#DC2626]'
                    : 'border-[#E5EAF0] focus:border-[#0B2A4A]/40'
                }`}
              />

              <div className="mt-4 flex gap-2">
                <Button
                  type="submit"
                  variant={isEmergency ? 'danger' : 'navy'}
                  className={isEmergency ? '!bg-[#DC2626] hover:!bg-[#B91C1C]' : ''}
                  loading={createMutation.isPending}
                >
                  {isEmergency ? '🚨 Send Critical Alert' : 'Send Message'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setComposing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : !selected ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-[#64748B]">
              Start a conversation with Super Admin.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF2F6] px-5 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#0B2A4A] text-[15.5px]">{selected.subject}</p>
                    {selected.priority === 'EMERGENCY' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-2 py-0.5 text-[10.5px] font-extrabold text-[#DC2626]">
                        <span>🚨</span> EMERGENCY
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    {selected.status === 'RESOLVED' ? 'Closed' : 'Open'} · Super Admin
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startComposing(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#FCA5A5] bg-[#FFF1F2] px-2.5 py-1 text-[11.5px] font-bold text-[#DC2626] hover:bg-[#FEE2E2] transition"
                  >
                    <span>🚨</span> New Alert
                  </button>
                </div>
              </div>

              {/* Message Bubbles */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F8FAFC] px-4 py-4">
                {bubbles.map((bubble) => (
                  <div
                    key={bubble.id}
                    className={bubble.fromSuperAdmin ? 'flex justify-start' : 'flex justify-end'}
                  >
                    <div
                      className={[
                        'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                        bubble.fromSuperAdmin
                          ? 'bg-white text-[#0F172A] shadow-sm'
                          : 'bg-[#0B2A4A] text-white',
                      ].join(' ')}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                        {bubble.fromSuperAdmin ? 'Super Admin' : 'You'}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{bubble.body}</p>
                      {bubble.createdAt ? (
                        <p className="mt-1 text-[10px] opacity-60">{formatChatTime(bubble.createdAt)}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply Section */}
              {selected.status === 'RESOLVED' ? (
                <p className="border-t border-[#EEF2F6] px-5 py-3 text-sm text-[#64748B]">
                  This conversation is closed.
                </p>
              ) : (
                <div className="flex flex-col gap-2 border-t border-[#EEF2F6] p-3 bg-white">
                  {/* Emergency Option along with the reply */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setReplyAsEmergency((v) => !v)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold transition ${
                        replyAsEmergency
                          ? 'border-[#DC2626] bg-[#FEE2E2] text-[#DC2626] shadow-xs'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]'
                      }`}
                    >
                      <span>🚨</span>
                      <span>{replyAsEmergency ? 'Emergency Mode Active' : 'Mark as Emergency'}</span>
                    </button>
                    {replyAsEmergency && (
                      <span className="text-[11px] font-bold text-[#DC2626]">
                        ⚡ Escalating ticket to Emergency Priority
                      </span>
                    )}
                  </div>

                  <form onSubmit={onReply} className="flex gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={replyAsEmergency ? 'Type urgent emergency reply…' : 'Type a message…'}
                      rows={1}
                      className={`min-h-[44px] flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                        replyAsEmergency
                          ? 'border-[#FCA5A5] bg-[#FFF5F5] focus:border-[#DC2626]'
                          : 'border-[#E5EAF0] focus:border-[#0B2A4A]/40'
                      }`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          const body = draft.trim();
                          if (body) onReply(event);
                        }
                      }}
                    />
                    <Button
                      type="submit"
                      variant={replyAsEmergency ? 'danger' : 'navy'}
                      className={`!px-4 !py-2.5 ${replyAsEmergency ? '!bg-[#DC2626] hover:!bg-[#B91C1C]' : ''}`}
                      disabled={!draft.trim()}
                      loading={replyMutation.isPending}
                    >
                      {replyAsEmergency ? '🚨 Send Alert' : 'Send'}
                    </Button>
                  </form>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

