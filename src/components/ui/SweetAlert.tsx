import { useEffect, useState } from 'react';

export type SweetAlertTone = 'danger' | 'warning' | 'info';

export type SweetAlertOptions = {
  title: string;
  message?: string;
  tone?: SweetAlertTone;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  // Support prompt input field for manual refund amount or custom inputs
  prompt?: {
    inputType?: 'text' | 'number';
    defaultValue?: string | number;
    placeholder?: string;
    max?: number;
    min?: number;
    helperText?: string;
    validate?: (val: string) => string | null;
    onContinue?: (value: string) => void;
  };
};

type AlertState = SweetAlertOptions & {
  id: number;
  open: boolean;
};

type Listener = (state: AlertState | null) => void;

let listener: Listener | null = null;
let seq = 0;

const showAlert = (options: SweetAlertOptions) => {
  seq += 1;
  listener?.({
    id: seq,
    open: true,
    tone: options.tone || 'danger',
    title: options.title,
    message: options.message,
    confirmText: options.confirmText || 'Confirm',
    cancelText: options.cancelText || 'Cancel',
    onConfirm: options.onConfirm,
    onCancel: options.onCancel,
    prompt: options.prompt,
  });
};

const hideAlert = () => listener?.(null);

/** Imperative confirm dialog — use for priority / destructive actions. */
export const sweetAlert = {
  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      tone?: SweetAlertTone;
      confirmText?: string;
      cancelText?: string;
      onCancel?: () => void;
    },
  ) =>
    showAlert({
      title,
      message,
      tone: options?.tone || 'danger',
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      onConfirm,
      onCancel: options?.onCancel,
    }),
  prompt: (
    title: string,
    message: string,
    promptConfig: {
      inputType?: 'text' | 'number';
      defaultValue?: string | number;
      placeholder?: string;
      max?: number;
      min?: number;
      helperText?: string;
      validate?: (val: string) => string | null;
      onContinue: (val: string) => void;
    },
    options?: {
      tone?: SweetAlertTone;
      confirmText?: string;
      cancelText?: string;
      onCancel?: () => void;
    },
  ) =>
    showAlert({
      title,
      message,
      tone: options?.tone || 'warning',
      confirmText: options?.confirmText || 'Continue',
      cancelText: options?.cancelText || 'Cancel',
      prompt: promptConfig,
      onCancel: options?.onCancel,
    }),
  hide: hideAlert,
};

const TONE = {
  danger: {
    ring: 'bg-[#FEE2E2]',
    iconBg: 'bg-[#DC2626]',
    confirm: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
    bar: 'from-[#DC2626] to-[#F87171]',
    glyph: '!',
  },
  warning: {
    ring: 'bg-[#FEF3C7]',
    iconBg: 'bg-[#F59E0B]',
    confirm: 'bg-[#D97706] hover:bg-[#B45309] text-white',
    bar: 'from-[#F59E0B] to-[#FBBF24]',
    glyph: '!',
  },
  info: {
    ring: 'bg-[#DBEAFE]',
    iconBg: 'bg-[#2563EB]',
    confirm: 'bg-[#0B2A4A] hover:bg-[#081F37] text-white',
    bar: 'from-[#2563EB] to-[#60A5FA]',
    glyph: 'i',
  },
} as const;

/** Mount once near the app root (with ToastHost). */
export const SweetAlertHost = () => {
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [promptValue, setPromptValue] = useState<string>('');
  const [promptError, setPromptError] = useState<string | null>(null);

  useEffect(() => {
    listener = (next) => {
      setAlert(next);
      if (next?.prompt) {
        setPromptValue(
          next.prompt.defaultValue !== undefined ? String(next.prompt.defaultValue) : '',
        );
        setPromptError(null);
      } else {
        setPromptValue('');
        setPromptError(null);
      }
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!alert?.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        alert.onCancel?.();
        hideAlert();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alert]);

  if (!alert?.open) return null;

  const tone = TONE[alert.tone || 'danger'];

  const handleCancel = () => {
    alert.onCancel?.();
    hideAlert();
  };

  const handleConfirm = () => {
    if (alert.prompt) {
      if (alert.prompt.validate) {
        const err = alert.prompt.validate(promptValue);
        if (err) {
          setPromptError(err);
          return;
        }
      }
      const onContinue = alert.prompt.onContinue;
      hideAlert();
      onContinue?.(promptValue);
      return;
    }

    const fn = alert.onConfirm;
    hideAlert();
    fn?.();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-[#061526]/50 backdrop-blur-[2px]"
        aria-label="Dismiss"
        onClick={handleCancel}
      />
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <button
          type="button"
          aria-label="Close"
          onClick={handleCancel}
          className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
        >
          <span className="text-[20px] font-medium leading-none">&times;</span>
        </button>
        <div className={`h-1.5 w-full bg-gradient-to-r ${tone.bar}`} />
        <div className="flex flex-col items-center px-6 pb-6 pt-7 text-center">
          <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${tone.ring}`}>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-[20px] font-bold text-white ${tone.iconBg}`}
            >
              {tone.glyph}
            </div>
          </div>
          <h2 className="text-[20px] font-bold tracking-tight text-[#0f172a]">{alert.title}</h2>
          {alert.message ? (
            <p className="mt-2 text-[14.5px] font-medium leading-relaxed text-[#4B5563]">
              {alert.message}
            </p>
          ) : null}

          {alert.prompt ? (
            <div className="mt-4 w-full text-left">
              <input
                type={alert.prompt.inputType || 'text'}
                value={promptValue}
                onChange={(e) => {
                  setPromptValue(e.target.value);
                  if (promptError) setPromptError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                placeholder={alert.prompt.placeholder || 'Enter amount'}
                className="w-full rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-3.5 py-2.5 text-[15px] font-semibold text-[#1A1F36] outline-none transition focus:border-[#0B2A4A] focus:bg-white"
                autoFocus
              />
              {promptError ? (
                <p className="mt-1.5 text-[12.5px] font-medium text-[#DC2626]">{promptError}</p>
              ) : alert.prompt.helperText ? (
                <p className="mt-1 text-[12px] text-[#64748B]">{alert.prompt.helperText}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex w-full gap-3">
            <button
              type="button"
              className="flex-1 rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-4 py-2.5 text-[14px] font-semibold text-[#334155] transition hover:bg-[#EEF2F7]"
              onClick={handleCancel}
            >
              {alert.cancelText}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition ${tone.confirm}`}
              onClick={handleConfirm}
            >
              {alert.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
