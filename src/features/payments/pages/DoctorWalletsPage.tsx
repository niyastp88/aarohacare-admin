import { useEffect, useState } from 'react';
import { todayIsoIst } from '@/utils/dateTime';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import {
  billingService,
  type DoctorWalletSummary,
} from '@/api/services/billing/billing.service';

export const DoctorWalletsPage = () => {
  const [wallets, setWallets] = useState<DoctorWalletSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Default the wallet date to the current local date so the field is not blank when opened.
  const [mainFromDate, setMainFromDate] = useState<string>(todayIsoIst());
  const [mainToDate, setMainToDate] = useState<string>(todayIsoIst());

  const loadWallets = async (fromDate?: string, toDate?: string) => {
    try {
      setLoading(true);
      const data = await billingService.getDoctorWallets({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setWallets(data);
    } catch {
      showToast('Failed to load doctor wallet balances', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMainDateFilter = (from: string, to: string) => {
    setMainFromDate(from);
    setMainToDate(to);
    void loadWallets(from, to);
  };

  const handleSetMainToday = () => {
    const todayStr = todayIsoIst();
    handleApplyMainDateFilter(todayStr, todayStr);
  };

  const handleSetMainThisMonth = () => {
    const todayStr = todayIsoIst();
    const startOfMonth = todayStr.slice(0, 8) + '01';
    handleApplyMainDateFilter(startOfMonth, todayStr);
  };

  const handleClearMainDateFilter = () => {
    handleApplyMainDateFilter('', '');
  };

  useEffect(() => {
    void loadWallets(mainFromDate, mainToDate);
  }, []);

  const openDoctorDetail = (doctorId: string) => {
    navigate(APP_ROUTES.ADMIN.DOCTOR_WALLET_DETAIL(doctorId));
  };

  const filteredWallets = wallets.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.specialization.toLowerCase().includes(search.toLowerCase()),
  );

  const totalEarned = wallets.reduce((sum, w) => sum + w.totalEarned, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      {/* Page Header + Hero Stat */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[#0B2A4A] sm:text-[32px]">
            Doctor Wallets & Payouts
          </h1>
          <p className="mt-1 text-[14px] font-medium text-[#64748B]">
            Click any doctor to view their OP bookings, ledger, and process payouts.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 px-6 py-4 shadow-sm text-right">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">Total Earnings</p>
          <p className="mt-1 text-[32px] font-black leading-none text-[#0B2A4A]">
            ₹{totalEarned.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">
            {wallets.length} doctor{wallets.length !== 1 ? 's' : ''} • All accumulated fees
          </p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-[#E2E8F0] p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-extrabold text-[#0B2A4A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Filter by Date:
          </span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-[#CBD5E1] rounded-xl px-3 py-1.5">
            <span className="text-slate-500 font-semibold text-[11px]">From</span>
            <input
              type="date"
              value={mainFromDate}
              onChange={(e) => handleApplyMainDateFilter(e.target.value, mainToDate)}
              className="font-bold text-[#0F172A] outline-none text-xs bg-transparent"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-[#CBD5E1] rounded-xl px-3 py-1.5">
            <span className="text-slate-500 font-semibold text-[11px]">To</span>
            <input
              type="date"
              value={mainToDate}
              onChange={(e) => handleApplyMainDateFilter(mainFromDate, e.target.value)}
              className="font-bold text-[#0F172A] outline-none text-xs bg-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSetMainToday}
            className={`rounded-xl border px-3 py-1.5 font-bold transition ${mainFromDate && mainFromDate === mainToDate ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'}`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleSetMainThisMonth}
            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 font-bold text-sky-800 hover:bg-sky-100 transition"
          >
            This Month
          </button>
          {(mainFromDate || mainToDate) && (
            <button
              type="button"
              onClick={handleClearMainDateFilter}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16.5 16.5 21 21" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doctor by name or specialization..."
          className="w-full rounded-2xl border border-[#E2E8F0] bg-white py-3 pl-12 pr-4 text-sm font-medium text-[#0F172A] shadow-sm outline-none placeholder:text-[#94A3B8] focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
        />
      </div>

      {/* Doctor Cards Grid */}
      {loading ? (
        <div className="p-12 text-center">
          <Spinner label="Loading doctor wallets..." />
        </div>
      ) : filteredWallets.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center text-sm font-semibold text-[#64748B]">
          No doctors found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWallets.map((doc) => {
            const hasUnrefunded = (doc.unrefundedCancellationsCount || 0) > 0;

            return (
              <button
                key={doc._id}
                type="button"
                onClick={() => openDoctorDetail(doc._id)}
                className="group relative flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm text-left transition hover:border-sky-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                {/* Pending refund indicator */}
                {hasUnrefunded && (
                  <span className="absolute top-3 right-3 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                  </span>
                )}

                {/* Avatar + Name */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-blue-100 text-lg font-black text-[#2563EB] shadow-sm ring-1 ring-sky-100">
                    {doc.profileImage ? (
                      <img src={doc.profileImage} alt={doc.name} className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      doc.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-extrabold text-[#0B2A4A] group-hover:text-[#2563EB] transition">
                      {doc.name}
                    </p>
                    <p className="truncate text-[12px] font-semibold text-[#64748B]">
                      {doc.specialization}
                    </p>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl bg-[#F8FAFC] px-3 py-2.5 border border-[#F1F5F9]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Total Earned</p>
                    <p className="mt-0.5 text-[17px] font-black text-[#0B2A4A]">
                      ₹{doc.totalEarned.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F8FAFC] px-3 py-2.5 border border-[#F1F5F9]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Fee / Visit</p>
                    <p className="mt-0.5 text-[17px] font-black text-[#475569]">
                      ₹{doc.consultationFee}
                    </p>
                  </div>
                </div>

                {/* Pending & Settled row */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    {doc.pendingBalance > 0 ? (
                      <span className="inline-flex items-center rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-extrabold text-amber-700">
                        ₹{doc.pendingBalance.toLocaleString('en-IN')} due
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                        ✓ Settled
                      </span>
                    )}
                    {hasUnrefunded && (
                      <span className="inline-flex items-center rounded-lg bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        ⚠️ {doc.unrefundedCancellationsCount} refund
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-sky-600 group-hover:text-sky-700 transition">
                    View Details →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
