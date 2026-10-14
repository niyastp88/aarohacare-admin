import { useState, useRef, useEffect } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import { formatMoney } from '../data';
import type { PaymentRecord } from '../data';

export type RecordSummaryModalProps = {
  open: boolean;
  record: PaymentRecord;
  onClose: () => void;
  onPay: () => void;
  onDownloadReceipt?: () => void;
};

export const RecordSummaryModal = ({
  open,
  record,
  onClose,
  onPay,
  onDownloadReceipt,
}: RecordSummaryModalProps) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('All');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      window.scrollTo(0, 0);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#F8FAFC]">
      <div className="mx-auto max-w-[1100px] p-6 sm:p-8">
        <div className="w-full pb-10">
          <div className="w-full">
            <div className="mb-8">
              <BackButton onClick={onClose}>Back to Pay Aarohcare</BackButton>
            </div>
            
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-[28px] font-bold text-[#0F172A]">Record Summary</h1>
                <p className="mt-1 text-[14px] text-[#64748B]">Verify the session details before generating the secure payment link.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <select className="rounded-xl border border-[#E5EAF0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0F172A] outline-none shadow-sm">
                  <option>{new Date().getFullYear()}</option>
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
                      {['All', 'Completed', 'Not completed'].map((option) => (
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
              {record.status === 'PARTIALLY_PAID' ? (
                <span className="rounded-full bg-amber-100 px-3.5 py-1.5 text-[12px] font-bold text-amber-700">
                  Partially Paid
                </span>
              ) : record.amount > 0 ? (
                <span className="rounded-full bg-[#F59E0B]/10 px-3.5 py-1.5 text-[12px] font-bold text-[#F59E0B]">
                  Payment Pending
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3.5 py-1.5 text-[12px] font-bold text-emerald-700">
                  All Settled
                </span>
              )}
            </div>

            <h3 className="mb-5 text-[18px] font-bold text-[#0F172A]">Current Billing</h3>
            <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
              <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
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
                    {record.status === 'PARTIALLY_PAID' ? 'Partially Paid' : record.status === 'PAID' ? 'Paid' : 'Pending'}
                  </span>
                </div>
                <p className="mb-4 text-[13px] text-[#64748B]">{record.bookingCount} bookings</p>
                <p className="mb-1 text-[24px] font-bold text-[#0F172A]">
                  {formatMoney(record.amount)}
                </p>
                <p className="text-[12px] text-[#64748B]">
                  Calculation: {record.bookingCount} × {formatMoney(record.feePerBooking)}
                </p>
                <div className="mt-5 flex items-center gap-2.5">
                  <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-[#E5EAF0] text-[#3B82F6]" />
                  <span className="text-[13px] font-semibold text-[#0F172A]">Select to pay</span>
                </div>
              </div>
            </div>

            <h3 className="mb-5 text-[18px] font-bold text-[#0F172A]">Pay</h3>
            <div className="mb-8 rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border-2 border-[#3B82F6] bg-[#EFF6FF] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#3B82F6]">
                      <div className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                    </div>
                    <span className="text-[14px] font-bold text-[#0F172A]">Pay total remaining</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#0F172A]">{formatMoney(record.amount)}</span>
                </label>
                
                <label className="flex cursor-not-allowed items-center justify-between rounded-xl border border-[#E5EAF0] p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border-2 border-[#CBD5E1]" />
                    <span className="text-[14px] font-semibold text-[#0F172A]">Pay selected months (0)</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#0F172A]">₹0</span>
                </label>

                <label className="flex cursor-not-allowed items-center justify-between rounded-xl border border-[#E5EAF0] p-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border-2 border-[#CBD5E1]" />
                    <span className="text-[14px] font-semibold text-[#0F172A]">Pay part amount</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#64748B]">₹ amount</span>
                </label>
              </div>

              <p className="mt-5 text-[13px] font-medium text-[#64748B]">
                Only total payment is supported at this time.
              </p>

              <button
                type="button"
                onClick={onPay}
                disabled={record.amount <= 0}
                className="mt-5 w-full rounded-xl bg-[#3B82F6] py-4 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#2563EB] disabled:opacity-50"
              >
                Pay {formatMoney(record.amount)}
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
    </div>
  );
};
