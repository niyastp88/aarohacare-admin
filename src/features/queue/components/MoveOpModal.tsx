import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DoctorSelect, type DoctorSelectOption } from '@/components/ui/DoctorSelect';

type MoveOpModalProps = {
  open: boolean;
  doctorName: string;
  defaultFromOp: number;
  defaultToOp: number;
  pendingCount: number;
  doctorOptions: DoctorSelectOption[];
  submitting?: boolean;
  apiError?: string;
  onClose: () => void;
  onConfirm: (payload: { fromOp: number; toOp: number; toDoctorId: string }) => void;
};

export const MoveOpModal = ({
  open,
  doctorName,
  defaultFromOp,
  defaultToOp,
  pendingCount,
  doctorOptions,
  submitting = false,
  apiError = '',
  onClose,
  onConfirm,
}: MoveOpModalProps) => {
  const [fromOp, setFromOp] = useState(String(defaultFromOp || ''));
  const [toOp, setToOp] = useState(String(defaultToOp || ''));
  const [toDoctorId, setToDoctorId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setFromOp(String(defaultFromOp || ''));
    setToOp(String(defaultToOp || ''));
    setToDoctorId(doctorOptions[0]?.id || '');
    setError('');
  }, [open, defaultFromOp, defaultToOp, doctorOptions]);

  const fromNum = Number(fromOp);
  const toNum = Number(toOp);
  const rangeOk =
    Number.isInteger(fromNum) &&
    Number.isInteger(toNum) &&
    fromNum >= 1 &&
    toNum >= fromNum;

  const previewCount = useMemo(() => {
    if (!rangeOk || pendingCount <= 0) return 0;
    if (defaultFromOp > 0 && defaultToOp >= defaultFromOp) {
      const start = Math.max(fromNum, defaultFromOp);
      const end = Math.min(toNum, defaultToOp);
      if (end < start) return 0;
      return end - start + 1;
    }
    return Math.max(0, toNum - fromNum + 1);
  }, [rangeOk, fromNum, toNum, defaultFromOp, defaultToOp, pendingCount]);

  if (!open) return null;

  const canSubmit = rangeOk && Boolean(toDoctorId) && !submitting && doctorOptions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#061526]/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[520px] rounded-2xl border border-[#E5EAF0] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEF2F6] px-6 py-4">
          <div>
            <h2 className="text-[18px] font-bold text-[#1A1F36]">Move pending OPs</h2>
            <p className="mt-0.5 text-[13px] text-[#64748B]">{doctorName}</p>
          </div>
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

        <div className="space-y-4 px-6 py-5">
          <p className="text-[14px] text-[#4B5563]">
            Choose the pending OP range to move. Tokens keep the same order on the new doctor&apos;s
            schedule, then this doctor&apos;s booking closes.
          </p>

          {pendingCount === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No pending OPs left in the queue for this doctor.
            </p>
          ) : (
            <p className="rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#475569]">
              Pending queue auto-filled as OP {defaultFromOp}–{defaultToOp} ({pendingCount}{' '}
              {pendingCount === 1 ? 'patient' : 'patients'}).
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-[#0F172A]">Starting pending OP</span>
              <input
                type="number"
                min={1}
                value={fromOp}
                onChange={(event) => setFromOp(event.target.value)}
                className="rounded-xl border border-[#D7DEE7] px-3.5 py-3 text-[15px] outline-none focus:border-[#0B2A4A]/40"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-[#0F172A]">Final pending OP</span>
              <input
                type="number"
                min={1}
                value={toOp}
                onChange={(event) => setToOp(event.target.value)}
                className="rounded-xl border border-[#D7DEE7] px-3.5 py-3 text-[15px] outline-none focus:border-[#0B2A4A]/40"
              />
            </label>
          </div>

          <DoctorSelect
            label="Assign to doctor"
            value={toDoctorId}
            options={doctorOptions}
            onChange={setToDoctorId}
            placeholder="Select available doctor"
            emptyLabel="No other doctors with an open schedule today"
            tone="white"
          />

          {rangeOk && toDoctorId ? (
            <p className="text-[13px] font-medium text-[#0B2A4A]">
              About {previewCount} OP{previewCount === 1 ? '' : 's'} will move in order to the
              selected doctor.
            </p>
          ) : null}

          {error || apiError ? (
            <p className="text-sm text-[#DC2626]">{error || apiError}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EEF2F6] px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="navy"
            loading={submitting}
            disabled={!canSubmit}
            onClick={() => {
              if (!rangeOk) {
                setError('Enter a valid OP range (start ≤ end).');
                return;
              }
              if (!toDoctorId) {
                setError('Select a doctor.');
                return;
              }
              setError('');
              onConfirm({ fromOp: fromNum, toOp: toNum, toDoctorId });
            }}
          >
            Move OPs & close booking
          </Button>
        </div>
      </div>
    </div>
  );
};
