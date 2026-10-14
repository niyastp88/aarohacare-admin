import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';

type RefundChoice = 'refunded' | 'not_refunded';

interface CancelTokenModalProps {
  open: boolean;
  tokenLabel: string;
  consultationFee?: number;
  initialRefundAmount?: number;
  defaultPhone?: string;
  submitting?: boolean;
  error?: unknown;
  onClose: () => void;
  onConfirm: (payload: { refunded: boolean; refundPhone: string; refundAmount: number }) => void;
}

export const CancelTokenModal = ({
  open,
  tokenLabel,
  consultationFee = 0,
  initialRefundAmount,
  defaultPhone = '',
  submitting = false,
  error,
  onClose,
  onConfirm,
}: CancelTokenModalProps) => {
  const [refundChoice, setRefundChoice] = useState<RefundChoice>('not_refunded');
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [phone, setPhone] = useState(defaultPhone);

  useEffect(() => {
    if (!open) return;
    setRefundChoice('not_refunded');
    setPhone(defaultPhone);
    const defaultAmount =
      initialRefundAmount !== undefined && initialRefundAmount !== null
        ? String(initialRefundAmount)
        : String(consultationFee ?? 0);
    setRefundAmountInput(defaultAmount);
  }, [open, defaultPhone, initialRefundAmount, consultationFee]);

  if (!open) return null;

  const parsedRefundAmount = Number(refundAmountInput.trim());
  const isAmountValid =
    refundAmountInput.trim() !== '' &&
    !isNaN(parsedRefundAmount) &&
    parsedRefundAmount >= 0 &&
    parsedRefundAmount <= consultationFee;

  const needsPhone = refundChoice === 'not_refunded' && parsedRefundAmount > 0;
  const phoneOk = /^\d{10}$/.test(phone);
  const canConfirm = isAmountValid && (!needsPhone || phoneOk);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#061526]/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[480px] rounded-2xl border border-[#E5EAF0] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEF2F6] px-6 py-4">
          <h2 className="text-[18px] font-bold text-[#1A1F36]">Confirm Token Cancellation</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9AA3B2] transition hover:bg-[#F3F5F8] hover:text-[#4B5563]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-[14px] text-[#4B5563]">
            Cancel OP Token #{tokenLabel}. Enter the refund amount and select the refund settlement status.
          </p>

          {/* Refund Amount Input Field with validation */}
          <div className="mt-4 rounded-xl border border-[#EEF2F6] bg-[#F8FAFC] p-4">
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
                  Refund Amount (₹)
                </span>
                <span className="text-[12px] font-medium text-[#64748B]">
                  Collected Fee: ₹{consultationFee}
                </span>
              </div>
              <div className="relative mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#64748B]">
                  ₹
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={consultationFee}
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  placeholder={`Max ₹${consultationFee}`}
                  className="w-full rounded-xl border border-[#E5EAF0] bg-white pl-8 pr-3.5 py-2.5 text-[15px] font-bold text-[#1A1F36] outline-none transition focus:border-[#0B2A4A]"
                />
              </div>
            </label>

            {refundAmountInput.trim() !== '' && isNaN(parsedRefundAmount) && (
              <p className="mt-1.5 text-[12.5px] font-medium text-[#DC2626]">
                Enter a valid monetary amount.
              </p>
            )}
            {refundAmountInput.trim() !== '' && !isNaN(parsedRefundAmount) && parsedRefundAmount < 0 && (
              <p className="mt-1.5 text-[12.5px] font-medium text-[#DC2626]">
                Refund amount cannot be negative.
              </p>
            )}
            {refundAmountInput.trim() !== '' && !isNaN(parsedRefundAmount) && parsedRefundAmount > consultationFee && (
              <p className="mt-1.5 text-[12.5px] font-medium text-[#DC2626]">
                Refund amount cannot exceed collected consultation fee (₹{consultationFee}).
              </p>
            )}
            {parsedRefundAmount === 0 && (
              <p className="mt-1.5 text-[12px] text-[#64748B]">
                ₹0 refund: No refund transaction or pending refund will be created.
              </p>
            )}
          </div>

          {parsedRefundAmount > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRefundChoice('refunded')}
                className={[
                  'flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-4 transition',
                  refundChoice === 'refunded'
                    ? 'border-[#0B2A4A] bg-[#F8FAFC]'
                    : 'border-[#E5EAF0] bg-white hover:border-[#C8D0DB]',
                ].join(' ')}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F8EE] text-[#16A34A]">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="text-[13.5px] font-semibold text-[#1A1F36]">Already Refunded</span>
              </button>

              <button
                type="button"
                onClick={() => setRefundChoice('not_refunded')}
                className={[
                  'flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-4 transition',
                  refundChoice === 'not_refunded'
                    ? 'border-[#0B2A4A] bg-[#F8FAFC]'
                    : 'border-[#E5EAF0] bg-white hover:border-[#C8D0DB]',
                ].join(' ')}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2F6] text-[#4B5563]">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="6" cy="12" r="1.4" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                    <circle cx="18" cy="12" r="1.4" fill="currentColor" />
                  </svg>
                </span>
                <span className="text-[13.5px] font-semibold text-[#1A1F36]">Refund Pending</span>
              </button>
            </div>
          ) : null}

          {needsPhone ? (
            <label className="mt-4 block">
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
                Phone number for refund tracking
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit phone number"
                className="mt-1.5 w-full rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px] text-[#1A1F36] outline-none transition placeholder:text-[#9AA3B2] focus:border-[#0B2A4A] focus:bg-white"
              />
              {phone.length > 0 && !phoneOk ? (
                <p className="mt-1 text-[12.5px] text-[#DC2626]">Enter a valid 10-digit number</p>
              ) : null}
            </label>
          ) : parsedRefundAmount > 0 && refundChoice === 'refunded' ? (
            <p className="mt-3.5 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] px-3.5 py-2.5 text-[12.5px] text-[#15803D]">
              Refund already completed — no phone number needed.
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-error">{getApiErrorMessage(error)}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F6] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-4 py-2 text-[14px] font-semibold text-[#334155] transition hover:bg-[#EEF2F7]"
          >
            Close
          </button>
          <Button
            type="button"
            variant="navy"
            loading={submitting}
            disabled={!canConfirm}
            onClick={() =>
              onConfirm({
                refunded: parsedRefundAmount > 0 && refundChoice === 'refunded',
                refundPhone: needsPhone ? phone : '',
                refundAmount: parsedRefundAmount > 0 ? parsedRefundAmount : 0,
              })
            }
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
