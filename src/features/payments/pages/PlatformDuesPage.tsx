import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { billingService, type AdminBillingSummary } from '@/api/services/billing/billing.service';

export const PlatformDuesPage = () => {
  const [data, setData] = useState<AdminBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDues = async () => {
    try {
      setLoading(true);
      const res = await billingService.getAdminBillingDues();
      setData(res);
    } catch (err) {
      showToast('Failed to load platform billing dues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDues();
  }, []);

  const summary = data?.summary || {
    totalFeesAccrued: 0,
    totalFeesPaid: 0,
    totalRefundCredits: 0,
    outstandingDues: 0,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#0B2A4A] sm:text-[32px]">
            Platform Dues & Billing
          </h1>
          <p className="mt-1 text-[14px] font-medium text-[#64748B]">
            Track platform fees accrued per booking, refund adjustments, and payments to Superadmin.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Fees Accrued</p>
          <p className="mt-2 text-2xl font-black text-[#0B2A4A]">₹{summary.totalFeesAccrued.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-[#64748B]">₹3–₹50 per booking</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Settled</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">₹{summary.totalFeesPaid.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-[#64748B]">Paid to Superadmin</p>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Refund Credits</p>
          <p className="mt-2 text-2xl font-black text-slate-700">₹{summary.totalRefundCredits.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-[#64748B]">Reversed on cancellations</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Outstanding Platform Dues</p>
          <p className="mt-2 text-2xl font-black text-amber-600">₹{summary.outstandingDues.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-amber-700 font-semibold">Owed to Superadmin</p>
        </div>
      </div>

      {/* Dues Settlement Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 p-5 border border-sky-100 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-extrabold text-[#0B2A4A] text-base">Monthly Billing Cycle</h3>
          <p className="mt-0.5 text-xs font-medium text-[#475569]">
            Platform fees are calculated automatically per booking. You can settle outstanding dues manually with Superadmin at the end of each billing period.
          </p>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-[#0B2A4A]">Platform Billing Ledger</h2>

        {loading ? (
          <div className="p-8 text-center">
            <Spinner label="Loading billing ledger..." />
          </div>
        ) : !data?.transactions.length ? (
          <div className="p-8 text-center text-sm font-semibold text-[#64748B]">
            No platform billing transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {data.transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3.5 font-semibold text-[#475569]">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-extrabold ${
                          tx.type === 'DEBIT_PLATFORM_FEE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : tx.type === 'CREDIT_PAYMENT_TO_SUPERADMIN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#0F172A]">{tx.description}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#0F172A]">
                      {tx.type === 'DEBIT_PLATFORM_FEE' ? '+' : '-'}₹{Math.abs(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
