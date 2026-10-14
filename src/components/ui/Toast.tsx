import { useEffect, useState } from 'react';

type ToastTone = 'success' | 'error';

interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

type Listener = (toast: ToastMessage | null) => void;

let listener: Listener | null = null;
let seq = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const showToast = (text: string, tone: ToastTone = 'success', durationMs?: number) => {
  seq += 1;
  const next: ToastMessage = { id: seq, text, tone };
  listener?.(next);
  if (hideTimer) clearTimeout(hideTimer);
  const duration = Math.max(3000, durationMs ?? 4200);
  hideTimer = setTimeout(() => listener?.(null), duration);
};

/** Fixed toast host — mount once near the app root. */
export const ToastHost = () => {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    listener = setToast;
    return () => {
      listener = null;
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!toast) return null;

  const toneClass =
    toast.tone === 'success'
      ? 'border-[#bbf7d0] bg-[#ecfdf5] text-[#15803d]'
      : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex justify-end px-0 sm:right-6 sm:top-6"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.12)] ${toneClass}`}
      >
        <span className="min-w-0 flex-1 leading-snug">{toast.text}</span>
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded-md px-1 text-current/70 transition hover:bg-black/5 hover:text-current"
          onClick={() => listener?.(null)}
        >
          ×
        </button>
      </div>
    </div>
  );
};
