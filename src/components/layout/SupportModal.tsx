import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getApiErrorMessage } from '@/api/client';
import { emergencyService } from '@/api/services/emergency';
import { SUPPORT_CONTACT } from '@/constants/support';
import { showToast } from '@/components/ui/Toast';

type SupportModalProps = {
  open: boolean;
  onClose: () => void;
};

export const SupportModal = ({ open, onClose }: SupportModalProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage('');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const phoneHref = SUPPORT_CONTACT.phoneTel
    ? `tel:+${SUPPORT_CONTACT.phoneTel.replace(/\D/g, '')}`
    : undefined;
  const mailHref = `mailto:${SUPPORT_CONTACT.email}?subject=${encodeURIComponent(
    'Aarohcare facility support',
  )}`;

  const sendCriticalAlert = async () => {
    const text = message.trim();
    if (!text) {
      showToast('Enter a short description of the issue', 'error');
      return;
    }
    setSending(true);
    try {
      await emergencyService.create({
        body: text,
        subject: 'Critical support alert',
        channel: 'SUPPORT',
        priority: 'EMERGENCY',
      });
      showToast('Alert sent to Super Admin');
      onClose();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#061526]/45 backdrop-blur-[2px]"
        aria-label="Close support dialog"
        onClick={onClose}
      />

      <div className="relative z-10 flex max-h-[min(100dvh,720px)] w-full max-w-[520px] flex-col overflow-hidden rounded-t-2xl border border-[#E5EAF0] bg-white shadow-2xl sm:max-h-[min(92dvh,680px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#EEF2F6] bg-[#F5F8FC] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F1FF] text-[#1B64F2]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3" />
                <path d="M5.5 19c1.2-3.2 3.6-4.7 6.5-4.7S17.8 15.8 19 19" />
                <path d="M16.5 4.5c1.2.4 2 1.5 2 2.8" />
              </svg>
            </span>
            <h2 className="text-[17px] font-bold text-[#0B2A4A]">Support & Emergency Help</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9AA3B2] transition hover:bg-white hover:text-[#4B5563]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#DC2626" strokeWidth="2">
                <path d="M12 3.8 21 19.5H3L12 3.8Z" />
                <path d="M12 10v4.5M12 17.2v.2" />
              </svg>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#DC2626]">
                Critical Alert
              </p>
            </div>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#374151]">
                Enter urgent message for Super Admin
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Describe the critical issue…"
                className="mt-2 w-full resize-none rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-3.5 py-3 text-[14px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#0B2A4A] focus:bg-white"
              />
            </label>
            <button
              type="button"
              disabled={sending}
              onClick={() => void sendCriticalAlert()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#DC2626] px-4 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#B91C1C] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 10.5 20 4l-3.5 16-3.2-6.2L4 10.5Z" />
                <path d="m13.3 13.8 6.2-9.8" />
              </svg>
              {sending ? 'Sending…' : 'Send Critical Alert'}
            </button>
          </section>

          <div className="border-t border-[#EEF2F6]" />

          <section>
            <div className="mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1B64F2" strokeWidth="1.8">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.5-2.2 2-2.2 3.4M12 16.8v.2" />
              </svg>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0B2A4A]">
                Contact Super Admin
              </p>
            </div>
            <p className="text-[13px] font-medium text-[#64748B]">
              Need help? Contact Super Admin directly through the channels below.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#D6E4F5] bg-[#F5F9FF] px-4 py-4">
                <div className="flex items-center gap-2 text-[#0B2A4A]">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6.5 3.5h3l1.2 4-2 1.2a12 12 0 0 0 5.6 5.6l1.2-2 4 1.2v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
                  </svg>
                  <p className="text-[15px] font-bold">{SUPPORT_CONTACT.phoneDisplay}</p>
                </div>
                {phoneHref ? (
                  <a
                    href={phoneHref}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#1B64F2] bg-white px-3 py-2.5 text-[13px] font-bold text-[#1B64F2] transition hover:bg-[#EEF4FF]"
                  >
                    Call Now
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => showToast('Add a support phone number in settings constants', 'error')}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#1B64F2] bg-white px-3 py-2.5 text-[13px] font-bold text-[#1B64F2] transition hover:bg-[#EEF4FF]"
                  >
                    Call Now
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-[#E5EAF0] bg-[#F8FAFC] px-4 py-4">
                <a
                  href={mailHref}
                  className="flex items-start gap-2 text-[13px] font-semibold text-[#0F172A] hover:text-[#1B64F2]"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  <span className="break-all">{SUPPORT_CONTACT.email}</span>
                </a>
                <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#475569]">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l2.5 2.5" />
                  </svg>
                  {SUPPORT_CONTACT.hours}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
};
