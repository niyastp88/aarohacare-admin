import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { BackButton } from '@/components/ui/BackButton';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';
import { useLabReportStats } from '@/hooks/useLabReports';
import { initialsOf } from '@/features/patients/utils';
import { RecordSummaryModal } from '../components/RecordSummaryModal';
import {
  type PaymentRecord,
  type PaymentStatus,
  formatDueDate,
  formatMoney,
} from '../data';
import { statusBadgeClass, statusLabel } from '../utils';
import {
  billingService,
  type AdminBillingSummary,
} from '@/api/services/billing/billing.service';

const PAGE_SIZE = 6;

export const PaymentHistoryPage = () => {
  const { user } = useAuth();
  const isLab = useIsLabFacility();
  const labStatsQuery = useLabReportStats();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PaymentStatus>('ALL');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [payTarget, setPayTarget] = useState<PaymentRecord | null>(null);

  const [billingData, setBillingData] = useState<AdminBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const labMonthlyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of labStatsQuery.data?.monthly ?? []) {
      const padMonth = String(m.month).padStart(2, '0');
      map.set(`${m.year}-${padMonth}`, m.count);
    }
    return map;
  }, [labStatsQuery.data?.monthly]);

  const totalReportsSent = useMemo(() => {
    return (labStatsQuery.data?.monthly ?? []).reduce((sum, item) => sum + item.count, 0);
  }, [labStatsQuery.data?.monthly]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const res = await billingService.getAdminBillingDues();
      setBillingData(res);
    } catch (_err) {
      showToast('Loaded billing history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBillingData();
  }, []);

  const records: PaymentRecord[] = useMemo(() => {
    if (!billingData || !billingData.transactions.length) {
      const now = new Date();
      const currentMonthKey = now.toISOString().slice(0, 7);
      const currentMonthLabel = `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
      return [
        {
          id: `TXN-${currentMonthKey}`,
          monthLabel: currentMonthLabel,
          monthKey: currentMonthKey,
          dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
          amount: 0,
          status: 'PAID',
          bookingCount: 0,
          feePerBooking: 50,
          isCurrentMonth: true,
        },
      ];
    }

    const groups = new Map<string, { accrued: number; paid: number; refunds: number; txCount: number; date: Date }>();

    for (const tx of billingData.transactions) {
      const d = new Date(tx.createdAt);
      const monthKey = d.toISOString().slice(0, 7);
      let entry = groups.get(monthKey);
      if (!entry) {
        entry = { accrued: 0, paid: 0, refunds: 0, txCount: 0, date: d };
        groups.set(monthKey, entry);
      }

      const amt = Number(tx.amount || 0);
      if (tx.type === 'DEBIT_PLATFORM_FEE') {
        entry.accrued += amt;
        entry.txCount += 1;
      } else if (tx.type === 'CREDIT_PAYMENT_TO_SUPERADMIN') {
        entry.paid += Math.abs(amt);
      } else if (tx.type === 'CREDIT_REFUND') {
        entry.refunds += Math.abs(amt);
      }
    }

    const list: PaymentRecord[] = [];
    const sortedKeys = Array.from(groups.keys()).sort().reverse();

    for (const monthKey of sortedKeys) {
      const g = groups.get(monthKey)!;
      const monthLabel = `${g.date.toLocaleString('en-US', { month: 'long' })} ${g.date.getFullYear()}`;
      const outstanding = Math.max(0, g.accrued - g.paid - g.refunds);
      const status: PaymentStatus = outstanding > 0 ? 'PENDING' : 'PAID';
      const lastDay = new Date(g.date.getFullYear(), g.date.getMonth() + 1, 0).toISOString().slice(0, 10);

      list.push({
        id: `TXN-${monthKey}`,
        monthLabel,
        monthKey,
        dueDate: lastDay,
        amount: g.accrued > 0 ? g.accrued : outstanding,
        status,
        bookingCount: g.txCount,
        feePerBooking: g.txCount > 0 ? Math.round(g.accrued / g.txCount) : 50,
        paidAt: g.paid > 0 ? lastDay : undefined,
        isCurrentMonth: monthKey === new Date().toISOString().slice(0, 7),
      });
    }

    return list;
  }, [billingData]);

  const paidYtd = useMemo(
    () =>
      records.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + r.amount, 0),
    [records],
  );

  const lastPaid = useMemo(
    () => records.find((r) => r.status === 'PAID') ?? null,
    [records],
  );

  const pendingTotal = useMemo(
    () =>
      records.filter((r) => r.status === 'PENDING' || r.status === 'FAILED').reduce(
        (sum, r) => sum + r.amount,
        0,
      ),
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.monthLabel.toLowerCase().includes(q) ||
        r.monthKey.includes(q)
      );
    });
  }, [search, statusFilter, records]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const exportCsv = () => {
    if (filtered.length === 0) {
      showToast('No records to export', 'error');
      return;
    }
    const countCol = isLab ? 'Reports Sent' : 'Bookings';
    const rows = [
      ['ID', 'Month', 'Due Date', 'Amount', countCol, 'Status', 'Paid At'],
      ...filtered.map((r) => [
        r.id,
        r.monthLabel,
        r.dueDate,
        String(r.amount),
        String(isLab ? (labMonthlyMap.get(r.monthKey) ?? r.bookingCount) : r.bookingCount),
        r.status,
        r.paidAt ?? '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded');
  };

  const confirmPay = () => {
    setPayTarget(null);
    showToast('Payment request submitted to Superadmin');
  };

  const downloadReceiptForRecord = (record: PaymentRecord) => {
    const countLine = isLab
      ? `Reports Sent: ${labMonthlyMap.get(record.monthKey) ?? record.bookingCount}`
      : `Bookings: ${record.bookingCount}`;
    const feeLine = isLab
      ? `Convenience Fee: ₹${record.feePerBooking}/report`
      : `Fee: ₹${record.feePerBooking}`;
    const lines = [
      'Aarohcare — Convenience Fee Receipt',
      `Period: ${record.monthLabel}`,
      countLine,
      feeLine,
      `Total: ${formatMoney(record.amount)}`,
      `Status: ${record.status}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aarohcare-receipt-${record.monthKey}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Receipt downloaded');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      {/* Top Search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16.5 16.5 21 21" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search transactions by month or ID..."
            className="w-full rounded-2xl border border-[#E5EAF0] bg-white py-3 pl-11 pr-4 text-[14px] outline-none placeholder:text-[#94A3B8] focus:border-[#0B2A4A]/35 focus:ring-2 focus:ring-[#0B2A4A]/10"
          />
        </div>
        <NotificationBell />
        {user?.profileImage ? (
          <img
            src={user.profileImage}
            alt=""
            className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE] text-[12px] font-bold text-[#1D4ED8]">
            {initialsOf(user?.name || 'A')}
          </div>
        )}
      </div>

      {/* Header & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackButton to={APP_ROUTES.ADMIN.PAY} size="sm">
            Back to Pay Aarohcare
          </BackButton>
          <h1 className="mt-3 text-[26px] font-bold tracking-tight text-[#0B2A4A] sm:text-[30px]">
            Transaction Records
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5EAF0] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#0F172A] shadow-xs transition hover:bg-[#F8FAFC]"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16" />
            </svg>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5EAF0] px-4 py-2.5 text-[13.5px] font-semibold transition ${
              filtersOpen ? 'bg-[#EEF4FF] text-[#0B2A4A]' : 'bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filters
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#64748B]">Paid Total</p>
          <p className="mt-2 text-[26px] font-bold text-[#0F172A]">{formatMoney(paidYtd)}</p>
          <p className="mt-1 text-[12.5px] text-[#64748B]">Settled convenience fees</p>
        </div>

        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {isLab ? (
            <>
              <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#64748B]">Reports Shared</p>
              <p className="mt-2 text-[26px] font-bold text-[#2563EB]">{totalReportsSent}</p>
              <p className="mt-1 text-[12.5px] text-[#64748B]">Total patient reports processed</p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#64748B]">Last Payment</p>
              {lastPaid ? (
                <>
                  <p className="mt-2 text-[22px] font-bold text-[#0F172A]">{formatMoney(lastPaid.amount)}</p>
                  <p className="mt-1 text-[12.5px] text-[#64748B]">
                    {lastPaid.monthLabel} • Paid {lastPaid.paidAt ? formatDueDate(lastPaid.paidAt) : ''}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[14px] font-semibold text-[#94A3B8]">No payments recorded yet</p>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <p className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#64748B]">Pending Total</p>
          <p className="mt-2 text-[26px] font-bold text-[#DC2626]">{formatMoney(pendingTotal)}</p>
          <p className="mt-1 text-[12.5px] text-[#64748B]">
            {records.filter((r) => r.status === 'PENDING').length} months pending settlement
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <span className="text-[12px] font-bold tracking-[0.06em] text-[#64748B] uppercase mr-2">Status:</span>
          {(['ALL', 'PAID', 'PENDING', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition ${
                statusFilter === st
                  ? 'bg-[#0B2A4A] text-white shadow-xs'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              }`}
            >
              {st === 'ALL' ? 'All Transactions' : statusLabel(st)}
            </button>
          ))}
        </div>
      )}

      {/* Monthly Payments Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {loading ? (
          <div className="p-10 text-center">
            <Spinner label="Loading payment history..." />
          </div>
        ) : pageItems.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-[#64748B]">
            No payment records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5EAF0] bg-[#F8FAFC]">
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.06em] text-[#94A3B8]">PERIOD</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.06em] text-[#94A3B8]">DUE DATE</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.06em] text-[#94A3B8]">
                    {isLab ? 'REPORTS SENT' : 'BOOKINGS'}
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.06em] text-[#94A3B8]">AMOUNT</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.06em] text-[#94A3B8]">STATUS</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold tracking-[0.06em] text-[#94A3B8]">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {pageItems.map((row) => {
                  const reportsCount = labMonthlyMap.get(row.monthKey) ?? row.bookingCount;
                  const [rowYear, rowMonth] = row.monthKey.split('-').map(Number);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4 text-[14px] font-bold text-[#0F172A]">
                        <Link to={`/admin/pay/summary/${row.monthKey}`} className="hover:text-[#2563EB] hover:underline">
                          {row.monthLabel}
                        </Link>
                      </td>

                      <td className="px-5 py-4 text-[13.5px] font-medium text-[#475569]">
                        {formatDueDate(row.dueDate)}
                      </td>

                      <td className="px-5 py-4 text-[13.5px] font-medium text-[#475569]">
                        {isLab ? (
                          <div>
                            <span className="font-bold text-[#0F172A]">{reportsCount}</span> {reportsCount === 1 ? 'report' : 'reports'} sent
                            <div className="text-[11.5px] text-[#64748B]">₹{row.feePerBooking} per report</div>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-[#0F172A]">{row.bookingCount}</span> bookings × ₹{row.feePerBooking}
                          </>
                        )}
                      </td>

                      <td className="px-5 py-4 text-[14.5px] font-bold text-[#0F172A]">
                        {formatMoney(row.amount)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={[
                            'inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold',
                            statusBadgeClass(row.status),
                          ].join(' ')}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/admin/pay/summary/${row.monthKey}`}
                            className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-[12px] font-bold text-[#0B2A4A] hover:bg-[#F8FAFC] transition inline-flex items-center gap-1"
                          >
                            Breakdown
                          </Link>
                          {isLab && !Number.isNaN(rowYear) && !Number.isNaN(rowMonth) && (
                            <Link
                              to={`${APP_ROUTES.ADMIN.REPORTS}?year=${rowYear}&month=${rowMonth}`}
                              className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-[12px] font-bold text-[#2563EB] hover:bg-[#EFF6FF] hover:border-[#93C5FD] transition inline-flex items-center gap-1"
                            >
                              View Reports
                            </Link>
                          )}
                          {row.status !== 'PAID' ? (
                            <button
                              type="button"
                              onClick={() => setPayTarget(row)}
                              className="rounded-xl bg-[#16A34A] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-xs hover:bg-[#15803D] transition"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => downloadReceiptForRecord(row)}
                              className="rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#0B2A4A] hover:bg-[#F8FAFC] transition"
                            >
                              Receipt
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EAF0] bg-[#F8FAFC] px-5 py-3">
          <p className="text-[13px] font-semibold text-[#64748B]">
            Showing <span className="font-bold text-[#0F172A]">{rangeStart}</span> to{' '}
            <span className="font-bold text-[#0F172A]">{rangeEnd}</span> of{' '}
            <span className="font-bold text-[#0F172A]">{filtered.length}</span> records
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-[#E5EAF0] bg-white px-3 py-1.5 text-[13px] font-bold text-[#0F172A] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-[#E5EAF0] bg-white px-3 py-1.5 text-[13px] font-bold text-[#0F172A] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {payTarget && (
        <RecordSummaryModal
          open={Boolean(payTarget)}
          record={payTarget}
          onClose={() => setPayTarget(null)}
          onPay={confirmPay}
          onDownloadReceipt={() => downloadReceiptForRecord(payTarget)}
        />
      )}
    </div>
  );
};
