import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { getApiErrorMessage } from '@/api/client';
import { useUpdateMyFacility } from '@/hooks/useFacility';
import type {
  FacilityResponseDto,
  CancellationPolicyDto,
  CancellationPolicyItemDto,
  CancellationTimeUnit,
  RefundProcessingUnit,
} from '@/types/dto';

interface Props {
  facility: FacilityResponseDto | undefined;
}

const PREDEFINED_ICONS = [
  { id: 'alert-circle-outline', label: 'Alert / Warning' },
  { id: 'information-outline', label: 'Information' },
  { id: 'shield-check-outline', label: 'Shield / Security' },
  { id: 'file-document-outline', label: 'Document / Terms' },
  { id: 'clock-outline', label: 'Clock / Timing' },
  { id: 'wallet-outline', label: 'Wallet / Fee' },
  { id: 'calendar-month-outline', label: 'Calendar / Days' },
  { id: 'phone-outline', label: 'Phone / Support' },
  { id: 'account-check-outline', label: 'Patient / Verification' },
  { id: 'help-circle-outline', label: 'Help / Questions' },
  { id: 'backup-restore', label: 'Non-reversible / Restore' },
];

const TIME_UNITS: Array<{ id: CancellationTimeUnit; label: string }> = [
  { id: 'minutes', label: 'Minutes' },
  { id: 'hours', label: 'Hours' },
  { id: 'days', label: 'Days' },
];

const PROCESSING_UNITS: Array<{ id: RefundProcessingUnit; label: string }> = [
  { id: 'working_days', label: 'Working Days' },
  { id: 'days', label: 'Calendar Days' },
  { id: 'hours', label: 'Hours' },
];

const fieldClass =
  'w-full rounded-lg border border-[#D7DEE7] bg-white px-3.5 py-2.5 text-[14px] text-[#111827] outline-none transition placeholder:text-[#6B7280] focus:border-[#0b2a4a] focus:ring-2 focus:ring-[#0b2a4a]/10';
const labelClass = 'text-xs font-semibold uppercase tracking-wider text-[#4B5563]';

export const CancellationPolicySection = ({ facility }: Props) => {
  const updateFacility = useUpdateMyFacility();

  const [fullRefundValue, setFullRefundValue] = useState<number>(30);
  const [fullRefundUnit, setFullRefundUnit] = useState<CancellationTimeUnit>('minutes');
  const [afterPeriodRefundPercent, setAfterPeriodRefundPercent] = useState<number>(90);
  const [processingValue, setProcessingValue] = useState<number>(7);
  const [processingUnit, setProcessingUnit] = useState<RefundProcessingUnit>('working_days');
  const [additionalItems, setAdditionalItems] = useState<CancellationPolicyItemDto[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!facility) return;
    const policy = facility.cancellationPolicy;
    if (policy) {
      if (policy.fullRefundWindow) {
        setFullRefundValue(policy.fullRefundWindow.value ?? 30);
        setFullRefundUnit(policy.fullRefundWindow.unit ?? 'minutes');
      }
      if (typeof policy.afterPeriodRefundPercent === 'number') {
        setAfterPeriodRefundPercent(policy.afterPeriodRefundPercent);
      }
      if (policy.refundProcessingPeriod) {
        setProcessingValue(policy.refundProcessingPeriod.value ?? 7);
        setProcessingUnit(policy.refundProcessingPeriod.unit ?? 'working_days');
      }
      if (Array.isArray(policy.additionalItems)) {
        setAdditionalItems(policy.additionalItems);
      }
    }
  }, [facility?._id]);

  const handleAddItem = () => {
    setAdditionalItems((prev) => [
      ...prev,
      {
        icon: 'information-outline',
        text: { en: '', ml: '' },
      },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: 'icon' | 'en' | 'ml',
    val: string,
  ) => {
    setAdditionalItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'icon') return { ...item, icon: val };
        return {
          ...item,
          text: {
            ...item.text,
            [field]: val,
          },
        };
      }),
    );
  };

  const handleDeleteItem = (index: number) => {
    setAdditionalItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (fullRefundValue < 1) {
      setError('Full-refund time limit must be at least 1.');
      return;
    }
    if (afterPeriodRefundPercent < 0 || afterPeriodRefundPercent > 100) {
      setError('After-period OP refund percentage must be between 0 and 100.');
      return;
    }
    if (processingValue < 1) {
      setError('Refund processing period must be at least 1.');
      return;
    }

    for (let i = 0; i < additionalItems.length; i++) {
      const it = additionalItems[i];
      if (!it.text.en.trim()) {
        setError(`Additional policy item #${i + 1} requires English text.`);
        return;
      }
    }

    const cancellationPolicy: CancellationPolicyDto = {
      fullRefundWindow: {
        value: Math.round(fullRefundValue),
        unit: fullRefundUnit,
      },
      afterPeriodRefundPercent: Math.round(afterPeriodRefundPercent),
      refundProcessingPeriod: {
        value: Math.round(processingValue),
        unit: processingUnit,
      },
      additionalItems: additionalItems.map((item) => ({
        icon: item.icon,
        text: {
          en: item.text.en.trim(),
          ml: item.text.ml.trim(),
        },
      })),
    };

    setSaving(true);
    try {
      await updateFacility.mutateAsync({ cancellationPolicy });
      showToast('Cancellation policy updated successfully');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const unitLabel = TIME_UNITS.find((u) => u.id === fullRefundUnit)?.label.toLowerCase() || 'minutes';
  const procUnitLabel =
    PROCESSING_UNITS.find((u) => u.id === processingUnit)?.label.toLowerCase() || 'working days';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7"
    >
      <div className="mb-6 flex flex-col gap-1 border-b border-[#F0F3F7] pb-4">
        <h2 className="text-[20px] font-bold text-[#1A1F36]">Cancellation & Refund Policy</h2>
        <p className="text-[13px] text-[#5B6577]">
          Control the configurable cancellation rules for this facility. Saved settings are the source of truth for the patient app display and the backend refund calculation.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Configurable values section */}
        <div>
          <h3 className="mb-4 text-[15px] font-bold text-[#1A1F36]">Configurable Rules</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Rule 1: Full-refund time limit */}
            <div className="rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
              <label className={labelClass}>1. Full OP Refund Time Limit</label>
              <p className="mt-1 mb-3 text-[12px] text-[#6B7280]">
                Cancellations within this period receive a 100% OP consultation fee refund.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={fullRefundValue}
                  onChange={(e) => setFullRefundValue(Math.max(1, Number(e.target.value)))}
                  className={`${fieldClass} w-1/2 font-semibold`}
                  required
                />
                <select
                  value={fullRefundUnit}
                  onChange={(e) => setFullRefundUnit(e.target.value as CancellationTimeUnit)}
                  className={`${fieldClass} w-1/2 cursor-pointer font-medium`}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Rule 2: After-period time limit & OP refund percentage */}
            <div className="rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
              <label className={labelClass}>2. After-Period OP Refund Percentage</label>
              <p className="mt-1 mb-3 text-[12px] text-[#6B7280]">
                Percentage of OP fee refunded for cancellations after the time limit ({fullRefundValue} {unitLabel}).
              </p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={afterPeriodRefundPercent}
                    onChange={(e) =>
                      setAfterPeriodRefundPercent(
                        Math.max(0, Math.min(100, Number(e.target.value))),
                      )
                    }
                    className={`${fieldClass} pr-8 font-semibold`}
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280]">
                    %
                  </span>
                </div>
                <div className="rounded-lg border border-[#D7DEE7] bg-white px-3 py-2 text-[12px] text-[#4B5563]">
                  After {fullRefundValue} {unitLabel}
                </div>
              </div>
            </div>

            {/* Rule 3: Refund processing period */}
            <div className="rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] p-4 sm:col-span-2">
              <label className={labelClass}>3. Refund Processing Period</label>
              <p className="mt-1 mb-3 text-[12px] text-[#6B7280]">
                Estimated turnaround timeframe communicated to patients.
              </p>
              <div className="flex gap-2 sm:w-1/2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={processingValue}
                  onChange={(e) => setProcessingValue(Math.max(1, Number(e.target.value)))}
                  className={`${fieldClass} w-1/2 font-semibold`}
                  required
                />
                <select
                  value={processingUnit}
                  onChange={(e) => setProcessingUnit(e.target.value as RefundProcessingUnit)}
                  className={`${fieldClass} w-1/2 cursor-pointer font-medium`}
                >
                  {PROCESSING_UNITS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Required Items Preview */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[#1A1F36]">Patient App Live Preview (Required Items)</h3>
            <span className="inline-flex items-center rounded-full bg-[#E0E7FF] px-2.5 py-0.5 text-xs font-semibold text-[#3730A3]">
              Fixed Required Wording
            </span>
          </div>
          <p className="mt-1 mb-3 text-[12px] text-[#6B7280]">
            The exact text generated for the patient app based on your configured values.
          </p>

          <div className="space-y-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex items-start gap-3 rounded-lg border border-[#CBD5E1] bg-white p-3 text-[13px] text-[#1E293B]">
              <span className="mt-0.5 text-base">⏱️</span>
              <div>
                <span className="font-semibold">Cancel within {fullRefundValue} {unitLabel}:</span> Full OP refund, no convenience fee refund.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[#CBD5E1] bg-white p-3 text-[13px] text-[#1E293B]">
              <span className="mt-0.5 text-base">💳</span>
              <div>
                <span className="font-semibold">Cancel after {fullRefundValue} {unitLabel}:</span> {afterPeriodRefundPercent}% OP refund, no convenience fee refund.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[#CBD5E1] bg-white p-3 text-[13px] text-[#1E293B]">
              <span className="mt-0.5 text-base">📅</span>
              <div>
                Refunds processed within <span className="font-semibold">{processingValue} {procUnitLabel}</span>.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[#CBD5E1] bg-white p-3 text-[13px] text-[#1E293B]">
              <span className="mt-0.5 text-base">🔄</span>
              <div>
                Cancellation cannot be reversed once confirmed.
              </div>
            </div>
          </div>
        </div>

        {/* Additional Custom Items */}
        <div className="border-t border-[#F0F3F7] pt-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-[15px] font-bold text-[#1A1F36]">Additional Policy Items (Optional)</h3>
              <p className="text-[12px] text-[#6B7280]">
                Add custom notes or instructions displayed below the standard cancellation items.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#93C5FD] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#1B64F2] transition hover:bg-[#F5F9FF]"
            >
              + Add Item
            </button>
          </div>

          {additionalItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] py-6 text-center text-[13px] text-[#64748B]">
              No additional policy items added. Click &ldquo;+ Add Item&rdquo; to add custom policies.
            </div>
          ) : (
            <div className="space-y-4">
              {additionalItems.map((item, idx) => (
                <div
                  key={item._id || idx}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 transition"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#475569]">
                      Additional Item #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(idx)}
                      className="text-xs font-semibold text-[#DC2626] hover:underline"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelClass}>Icon</label>
                      <select
                        value={item.icon}
                        onChange={(e) => handleUpdateItem(idx, 'icon', e.target.value)}
                        className={`${fieldClass} mt-1`}
                      >
                        {PREDEFINED_ICONS.map((ico) => (
                          <option key={ico.id} value={ico.id}>
                            {ico.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>Text (English)</label>
                      <input
                        type="text"
                        value={item.text.en}
                        onChange={(e) => handleUpdateItem(idx, 'en', e.target.value)}
                        placeholder="e.g. Please bring original token receipt"
                        maxLength={300}
                        className={`${fieldClass} mt-1`}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Text (Malayalam - Optional)</label>
                      <input
                        type="text"
                        value={item.text.ml}
                        onChange={(e) => handleUpdateItem(idx, 'ml', e.target.value)}
                        placeholder="മലയാളത്തിലുള്ള വിവരണം"
                        maxLength={300}
                        className={`${fieldClass} mt-1`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="text-[13px] font-medium text-[#DC2626]">{error}</p> : null}

        <div className="border-t border-[#F0F3F7] pt-4">
          <Button type="submit" variant="navy" fullWidth loading={saving}>
            Save Cancellation Policy
          </Button>
        </div>
      </div>
    </form>
  );
};
