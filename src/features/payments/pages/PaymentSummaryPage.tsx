import { useState, useRef, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/ui/BackButton';
import { formatMoney } from '../data';
import type { PaymentRecord } from '../data';
import {
  billingService,
  type AdminDuesMonthlySummaryResponse,
} from '@/api/services/billing/billing.service';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';

export type SummaryContextType = {
  record: PaymentRecord;
  onClose: () => void;
  onPay: (targetAmount?: number, monthKey?: string) => void;
  onDownloadReceipt: () => void;
};

export const PaymentSummaryPage = () => {
  const { record, onClose, onPay, onDownloadReceipt } = useOutletContext<SummaryContextType>();
  const isLabFacility = useIsLabFacility();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState<'All' | 'Completed' | 'Not completed'>('All');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [monthlySummary, setMonthlySummary] = useState<AdminDuesMonthlySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Month selection and payment option states
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<Set<string>>(new Set());
  const [paymentOption, setPaymentOption] = useState<'TOTAL_REMAINING' | 'SELECTED_MONTHS' | 'PART_AMOUNT'>('TOTAL_REMAINING');
  const [customPartAmount, setCustomPartAmount] = useState<string>('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch real backend monthly billing summary cards for the selected year and facility domain
  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const res = await billingService.getAdminDuesMonthlySummary(selectedYear);
        setMonthlySummary(res);
      } catch {
        // Fallback silently if offline/network error
      } finally {
        setLoading(false);
      }
    };
    void loadSummary();
  }, [selectedYear]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const displayedMonths = useMemo(() => {
    if (!monthlySummary?.months) return [];
    return monthlySummary.months.filter((m) => {
      if (filterValue === 'Completed') return m.status === 'PAID';
      if (filterValue === 'Not completed') return m.status === 'PENDING' || m.status === 'PARTIALLY_PAID';
      return true;
    });
  }, [monthlySummary, filterValue]);

  // Calculate total number of months with pending platform dues for the selected year
  const dueMonthsCount = useMemo(() => {
    if (!monthlySummary?.months) return 0;
    return monthlySummary.months.filter((m) => (m.status === 'PENDING' || m.status === 'PARTIALLY_PAID') && m.remainingAmount > 0).length;
  }, [monthlySummary]);

  // Calculate total remaining amount across selected months
  const selectedMonthsAmount = useMemo(() => {
    if (!monthlySummary?.months) return 0;
    return monthlySummary.months
      .filter((m) => selectedMonthKeys.has(m.monthKey))
      .reduce((sum, m) => sum + (m.remainingAmount > 0 ? m.remainingAmount : 0), 0);
  }, [monthlySummary, selectedMonthKeys]);

  const finalPayAmount = useMemo(() => {
    if (paymentOption === 'SELECTED_MONTHS') return selectedMonthsAmount;
    if (paymentOption === 'PART_AMOUNT') return Number(customPartAmount) || 0;
    return record.amount;
  }, [paymentOption, selectedMonthsAmount, customPartAmount, record.amount]);

  const targetMonthKey = useMemo(() => {
    if (paymentOption === 'SELECTED_MONTHS' && selectedMonthKeys.size > 0) {
      return Array.from(selectedMonthKeys).join(',');
    }
    if (paymentOption === 'PART_AMOUNT' && selectedMonthKeys.size === 1) {
      return Array.from(selectedMonthKeys)[0];
    }
    return undefined;
  }, [paymentOption, selectedMonthKeys]);

  const toggleMonthSelection = (mKey: string) => {
    const next = new Set(selectedMonthKeys);
    if (next.has(mKey)) {
      next.delete(mKey);
    } else {
      next.add(mKey);
    }
    setSelectedMonthKeys(next);
    if (next.size > 0) {
      setPaymentOption('SELECTED_MONTHS');
    } else {
      setPaymentOption('TOTAL_REMAINING');
    }
  };

  const isLab = monthlySummary?.isLab ?? isLabFacility;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <div className="w-full pb-10">
        <div className="w-full">
          <div className="mb-8">
            <BackButton onClick={onClose}>Back to Pay Aarohcare</BackButton>
          </div>

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-[28px] font-bold text-[#0F172A]">Record Summary</h1>
              <p className="mt-1 text-[14px] text-[#64748B]">
                {isLab
                  ? 'Verify lab report platform dues and monthly billing breakdown before settling dues.'
                  : 'Verify the session details before generating the secure payment link.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Adapt year selection dynamically from backend records */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-[#E5EAF0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0F172A] outline-none shadow-sm cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={`flex w-[140px] items-center justify-between rounded-xl border bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0F172A] shadow-sm outline-none transition ${
                    filterOpen ? 'border-[#3B82F6] ring-1 ring-[#3B82F6]' : 'border-[#E5EAF0] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span>{filterValue}</span>
                  <svg className="h-4 w-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 z-10 w-[140px] overflow-hidden rounded-xl border border-[#E5EAF0] bg-white shadow-lg">
                    {(['All', 'Completed', 'Not completed'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => {
                          setFilterValue(option);
                          setFilterOpen(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[13px] font-medium transition ${
                          filterValue === option
                            ? 'bg-[#EEF4FF] text-[#3B82F6]'
                            : 'text-[#0F172A] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-10 flex items-center justify-between rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-sm">
            <div>
              <p className="mb-1 text-[13px] font-medium text-[#64748B]">Remaining payment</p>
              <p className="text-[32px] font-bold tracking-tight text-[#0F172A]">
                {formatMoney(record.amount)}
              </p>
            </div>
            {/* Display number of due months alongside overall dues status */}
            <div className="flex items-center gap-2">
              {dueMonthsCount > 0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-bold text-slate-700">
                  {dueMonthsCount} {dueMonthsCount === 1 ? 'month' : 'months'} due
                </span>
              )}
              {record.status === 'PARTIALLY_PAID' ? (
                <span className="rounded-full bg-amber-100 px-3.5 py-1.5 text-[12px] font-bold text-amber-700">
                  Partially Paid
                </span>
              ) : record.amount > 0 ? (
                <span className="rounded-full bg-[#F59E0B]/10 px-3.5 py-1.5 text-[12px] font-bold text-[#F59E0B]">
                  Dues Pending
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3.5 py-1.5 text-[12px] font-bold text-emerald-700">
                  All Dues Settled
                </span>
              )}
            </div>
          </div>

          <h3 className="mb-5 text-[18px] font-bold text-[#0F172A]">
            {isLab ? 'Monthly Billing Cards' : 'Current Billing'}
          </h3>

          {loading ? (
            <div className="py-8 text-center text-[14px] text-[#64748B]">Loading monthly records...</div>
          ) : (
            <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
              {displayedMonths.length > 0 ? (
                displayedMonths.map((m) => {
                  const isPaid = m.status === 'PAID';
                  const isPartiallyPaid = m.status === 'PARTIALLY_PAID';
                  const isNoDues = m.status === 'NO_DUES';
                  const isSelectable = !isPaid && !isNoDues && m.remainingAmount > 0;
                  const isChecked = selectedMonthKeys.has(m.monthKey);

                  const badgeText = isPaid
                    ? 'Paid'
                    : isNoDues
                    ? 'No dues'
                    : isPartiallyPaid
                    ? `Partially paid · ${formatMoney(m.remainingAmount)} remaining`
                    : `Pending · ${formatMoney(m.remainingAmount)} remaining`;

                  const calcText = m.calculationText || `${m.count} × ${formatMoney(m.feePerItem)}`;

                  return (
                    <div
                      key={m.monthKey}
                      className={`rounded-2xl border bg-white p-5 shadow-sm cursor-pointer transition ${
                        isChecked
                          ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/20'
                          : 'border-[#E5EAF0] hover:border-[#3B82F6] hover:shadow-md'
                      }`}
                      onClick={() => navigate(`/admin/pay/summary/${m.monthKey}`)}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-[16px] font-bold text-[#0F172A]">{m.monthLabel}</h4>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-700'
                              : isNoDues
                              ? 'bg-slate-100 text-slate-600'
                              : isPartiallyPaid
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-[#E0F2FE] text-[#0284C7]'
                          }`}
                        >
                          {badgeText}
                        </span>
                      </div>
                      {/* Render domain-appropriate terminology for Lab Reports vs Offline Bookings */}
                      <p className="mb-4 text-[13px] text-[#64748B]">
                        {m.count} {isLab ? 'lab reports' : 'offline bookings'}
                      </p>
                      <p className="mb-1 text-[24px] font-bold text-[#0F172A]">
                        {formatMoney(m.amount)}
                      </p>
                      <p className="text-[12px] text-[#64748B]">
                        Calculation: {calcText}
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-[#64748B]">
                        Paid so far: <span className="font-bold text-[#0F172A]">{formatMoney(m.paidAmount || 0)}</span>
                      </p>
                      <div className="mt-5 flex items-center justify-between gap-2.5">
                        <div
                          className={`flex items-center gap-2.5 ${
                            isSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelectable) toggleMonthSelection(m.monthKey);
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={!isSelectable}
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (isSelectable) toggleMonthSelection(m.monthKey);
                            }}
                            className="h-4 w-4 rounded border-[#E5EAF0] text-[#3B82F6] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="text-[13px] font-semibold text-[#0F172A]">Select to pay</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#3B82F6]">
                          {isLab ? 'View Reports \u2192' : 'View Doctors \u2192'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm cursor-pointer transition hover:border-[#3B82F6] hover:shadow-md"
                  onClick={() => navigate(`/admin/pay/summary/${record.monthKey}`)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-[16px] font-bold text-[#0F172A]">{record.monthLabel}</h4>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        record.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-700'
                          : record.status === 'PARTIALLY_PAID'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[#E0F2FE] text-[#0284C7]'
                      }`}
                    >
                      {record.status === 'PARTIALLY_PAID'
                        ? `Partially paid · ${formatMoney(record.amount)} remaining`
                        : record.status === 'PAID'
                        ? 'Paid'
                        : 'Pending'}
                    </span>
                  </div>
                  <p className="mb-4 text-[13px] text-[#64748B]">
                    {record.bookingCount} {isLab ? 'lab reports' : 'bookings'}
                  </p>
                  <p className="mb-1 text-[24px] font-bold text-[#0F172A]">
                    {formatMoney(record.amount)}
                  </p>
                  <p className="text-[12px] text-[#64748B]">
                    Configured platform fee: {formatMoney(record.feePerBooking)}
                  </p>
                  {record.paidAmount !== undefined && record.paidAmount > 0 && (
                    <p className="mt-1 text-[12px] font-medium text-[#64748B]">
                      Paid so far: <span className="font-bold text-[#0F172A]">{formatMoney(record.paidAmount)}</span>
                    </p>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-[#E5EAF0] text-[#3B82F6] cursor-pointer" />
                      <span className="text-[13px] font-semibold text-[#0F172A]">Select to pay</span>
                    </div>
                    <span className="text-[12px] font-bold text-[#3B82F6]">
                      {isLab ? 'View Reports \u2192' : 'View Doctors \u2192'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <h3 className="mb-5 text-[18px] font-bold text-[#0F172A]">Pay</h3>
          <div className="mb-8 rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-sm">
            <div className="space-y-4">
              {/* Pay total remaining */}
              <label
                className={`flex items-center justify-between rounded-xl border-2 p-4 transition ${
                  paymentOption === 'TOTAL_REMAINING'
                    ? 'border-[#3B82F6] bg-[#EFF6FF]'
                    : 'border-[#E5EAF0] bg-white hover:bg-[#F8FAFC]'
                } ${record.amount <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  if (record.amount > 0) setPaymentOption('TOTAL_REMAINING');
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      paymentOption === 'TOTAL_REMAINING' ? 'border-[#3B82F6]' : 'border-[#CBD5E1]'
                    }`}
                  >
                    {paymentOption === 'TOTAL_REMAINING' && <div className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />}
                  </div>
                  <span className="text-[14px] font-bold text-[#0F172A]">Pay total remaining</span>
                </div>
                <span className="text-[14px] font-bold text-[#0F172A]">{formatMoney(record.amount)}</span>
              </label>

              {/* Pay selected months */}
              <label
                className={`flex items-center justify-between rounded-xl border-2 p-4 transition ${
                  paymentOption === 'SELECTED_MONTHS'
                    ? 'border-[#3B82F6] bg-[#EFF6FF]'
                    : 'border-[#E5EAF0] bg-white hover:bg-[#F8FAFC]'
                } ${selectedMonthKeys.size === 0 || selectedMonthsAmount <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => {
                  if (selectedMonthKeys.size > 0 && selectedMonthsAmount > 0) {
                    setPaymentOption('SELECTED_MONTHS');
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      paymentOption === 'SELECTED_MONTHS' ? 'border-[#3B82F6]' : 'border-[#CBD5E1]'
                    }`}
                  >
                    {paymentOption === 'SELECTED_MONTHS' && <div className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />}
                  </div>
                  <span className="text-[14px] font-semibold text-[#0F172A]">
                    Pay selected {selectedMonthKeys.size === 1 ? 'month' : 'months'} ({selectedMonthKeys.size})
                  </span>
                </div>
                <span className="text-[14px] font-bold text-[#0F172A]">{formatMoney(selectedMonthsAmount)}</span>
              </label>

              {/* Pay part amount */}
              <div
                className={`rounded-xl border-2 p-4 transition ${
                  paymentOption === 'PART_AMOUNT'
                    ? 'border-[#3B82F6] bg-[#EFF6FF]'
                    : 'border-[#E5EAF0] bg-white hover:bg-[#F8FAFC]'
                } ${record.amount <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className="flex cursor-pointer items-center justify-between"
                  onClick={() => {
                    if (record.amount > 0) setPaymentOption('PART_AMOUNT');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        paymentOption === 'PART_AMOUNT' ? 'border-[#3B82F6]' : 'border-[#CBD5E1]'
                      }`}
                    >
                      {paymentOption === 'PART_AMOUNT' && <div className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />}
                    </div>
                    <span className="text-[14px] font-semibold text-[#0F172A]">Pay part amount</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#0F172A]">
                    {customPartAmount ? formatMoney(Number(customPartAmount)) : '₹ Custom'}
                  </span>
                </div>
                {paymentOption === 'PART_AMOUNT' && (
                  <div className="mt-3 pl-8">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[#0F172A]">₹</span>
                      <input
                        type="number"
                        min="1"
                        max={record.amount}
                        value={customPartAmount}
                        onChange={(e) => setCustomPartAmount(e.target.value)}
                        placeholder={`Enter custom amount (max ${formatMoney(record.amount)})`}
                        className="w-full rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#0F172A] outline-none focus:border-[#3B82F6] shadow-sm"
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#64748B]">
                      Enter a custom partial amount up to total remaining dues ({formatMoney(record.amount)}).
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onPay(finalPayAmount, targetMonthKey)}
              disabled={finalPayAmount <= 0}
              className="mt-6 w-full rounded-xl bg-[#3B82F6] py-4 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              Pay {formatMoney(finalPayAmount)}
            </button>

            {onDownloadReceipt && (
              <button
                type="button"
                onClick={onDownloadReceipt}
                className="mt-6 w-full text-center text-[13px] font-bold tracking-wide text-[#3B82F6] hover:underline"
              >
                DOWNLOAD THE RECEIPT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
