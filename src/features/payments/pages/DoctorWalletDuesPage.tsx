import { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { APP_ROUTES } from '@/constants/routes';
import { BackButton } from '@/components/ui/BackButton';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { billingService, type AdminDuesBreakdown } from '@/api/services/billing/billing.service';
import type { SummaryContextType } from './PaymentSummaryPage';

// Adapt billing breakdown page to support both Facility Admin and Lab Admin domain terminology.
import { useIsLabFacility } from '@/hooks/useIsLabFacility';

export const DoctorWalletDuesPage = () => {
  const isLabFacility = useIsLabFacility();
  const { monthKey } = useParams<{ monthKey: string }>();
  const navigate = useNavigate();
  // Use the context provided by PayAarohCarePage's Outlet to get the overall month status
  const context = useOutletContext<SummaryContextType>();
  
  const [data, setData] = useState<AdminDuesBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the backend-calculated billing data so the page displays the actual ledger values instead of calculating payment amounts on the frontend.
  useEffect(() => {
    if (!monthKey) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await billingService.getAdminDuesBreakdownByDoctor(monthKey);
        setData(res);
      } catch {
        showToast(isLabFacility ? 'Failed to load lab report dues breakdown' : 'Failed to load doctor dues breakdown', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    void loadData();
  }, [monthKey, isLabFacility]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading breakdown..." />
      </div>
    );
  }

  if (!data) return null;

  const dateObj = new Date(`${monthKey}-01T00:00:00Z`);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const yearStr = dateObj.getUTCFullYear().toString();
  const displayTitle = `${monthName} ${yearStr}`;

  const prevDate = new Date(dateObj);
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const prevMonthKey = prevDate.toISOString().slice(0, 7);
  const prevMonthLabel = prevDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  const nextDate = new Date(dateObj);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
  const nextMonthKey = nextDate.toISOString().slice(0, 7);
  const nextMonthLabel = nextDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  // Since platform dues are paid globally by the facility, we use the parent record's status for the entire month.
  const isPaid = context?.record?.status === 'PAID';
  const paymentStatus = isPaid ? (data.totalAmount > 0 ? 'Payment Completed' : 'All Settled') : 'Payment Pending';

  // Render dedicated Lab Monthly Billing Detail view for Lab Admin with summary metrics, date-wise breakdown, and report details.
  if (isLabFacility) {
    const remaining = data.remainingAmount ?? Math.max(0, data.totalAmount - (data.paidAmount || 0));
    const isCompleted = remaining <= 0 && data.totalAmount >= 0;
    const dateWiseList = data.dateWise || [];
    const reportsList = data.reports || [];
    const facilityName = data.facilityName || 'Lab';

    return (
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 pb-10">
        <div>
          <BackButton onClick={() => navigate(APP_ROUTES.ADMIN.PAY_SUMMARY)}>Back to summary</BackButton>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#0F172A] sm:text-[32px]">
              {displayTitle}
            </h1>
            <p className="mt-1 text-[14px] font-medium text-[#64748B]">
              {facilityName} · lab reports and service fee for this month
            </p>
          </div>
          <div className="flex items-center">
            {isCompleted ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1.5 text-[12px] font-bold text-emerald-700">
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-4 py-1.5 text-[12px] font-bold text-amber-700">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* 4 Summary Cards using clean AarohCare theme */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">Lab reports</p>
            <p className="mt-2 text-[28px] font-bold text-[#0F172A]">{data.totalReports || 0}</p>
          </div>

          <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">Service fee</p>
            <p className="mt-2 text-[24px] font-bold text-[#0F172A]">
              ₹{data.configuredPlatformFee} <span className="text-[13px] font-normal text-[#64748B]">/ report</span>
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">Total</p>
            <p className="mt-2 text-[28px] font-bold text-[#0F172A]">₹{data.totalAmount.toLocaleString('en-IN')}</p>
          </div>

          <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">Remaining</p>
            <p className="mt-2 text-[28px] font-bold text-[#0F172A]">₹{remaining.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Date wise Breakdown */}
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="mb-4 text-[18px] font-bold text-[#0F172A]">Date wise</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#E5EAF0] text-[12px] font-bold text-[#64748B]">
                  <th className="pb-3 pr-4 font-semibold">Date</th>
                  <th className="pb-3 px-4 font-semibold">Lab reports</th>
                  <th className="pb-3 pl-4 font-semibold">Service fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0]">
                {dateWiseList.length > 0 ? (
                  dateWiseList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC]">
                      <td className="py-3.5 pr-4 font-semibold text-[#0F172A]">{item.date}</td>
                      <td className="py-3.5 px-4 font-medium text-[#0F172A]">{item.count}</td>
                      <td className="py-3.5 pl-4 font-semibold text-[#0F172A]">₹{item.fee}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-[#64748B] text-[13px]">
                      No lab report activity for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lab Reports List */}
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="mb-4 text-[18px] font-bold text-[#0F172A]">Lab reports</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#E5EAF0] text-[12px] font-bold text-[#64748B]">
                  <th className="pb-3 pr-3 font-semibold">Date</th>
                  <th className="pb-3 px-3 font-semibold">Patient</th>
                  <th className="pb-3 px-3 font-semibold">Phone</th>
                  <th className="pb-3 px-3 font-semibold">Report</th>
                  <th className="pb-3 px-3 font-semibold">Time</th>
                  <th className="pb-3 pl-3 font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0]">
                {reportsList.length > 0 ? (
                  reportsList.map((rep) => (
                    <tr key={rep._id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3.5 pr-3 font-semibold text-[#0F172A] whitespace-nowrap">{rep.date}</td>
                      <td className="py-3.5 px-3 font-medium text-[#0F172A] whitespace-nowrap">{rep.patientName}</td>
                      <td className="py-3.5 px-3 text-[#64748B] whitespace-nowrap">{rep.patientPhone}</td>
                      <td className="py-3.5 px-3 font-medium text-[#0F172A]">{rep.title}</td>
                      <td className="py-3.5 px-3 text-[#64748B] whitespace-nowrap">{rep.time}</td>
                      <td className="py-3.5 pl-3 font-semibold text-[#0F172A] whitespace-nowrap">₹{rep.fee}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#64748B] text-[13px]">
                      No lab reports found for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-center border-t border-[#E5EAF0] pt-6">
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.ADMIN.REPORTS)}
              className="inline-flex items-center justify-center rounded-xl bg-[#0F172A] px-6 py-3 text-[14px] font-bold text-white shadow-sm hover:bg-[#1E293B] transition"
            >
              Open in Lab Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 pb-10">
      <div>
        <BackButton onClick={() => navigate(APP_ROUTES.ADMIN.PAY_SUMMARY)}>Back to summary</BackButton>
      </div>

      <div>
        {/* Adapt title and subtitle based on whether facility is a Laboratory or Clinic/Hospital */}
        <h1 className="text-[28px] font-bold text-[#0F172A] sm:text-[32px]">
          Dr Wallet
        </h1>
        <p className="mt-1 text-[14px] font-medium text-[#64748B]">
          Choose a period to see what each doctor owes.
        </p>
      </div>

      {/* Filters mimicking the screenshot but using light theme */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <button 
            onClick={() => navigate(`/admin/pay/summary/${prevMonthKey}`)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition"
          >
            &lt;
          </button>
          <div className="flex flex-1 rounded-xl bg-[#F8FAFC] border border-[#E5EAF0] p-1">
             <button 
                onClick={() => navigate(`/admin/pay/summary/${prevMonthKey}`)}
                className="flex-1 rounded-lg py-2 text-center text-[13px] font-bold text-[#64748B] hover:bg-slate-200/50 transition w-full"
             >
               {prevMonthLabel}
             </button>
             <div className="flex-1 rounded-lg bg-[#3B82F6] py-2 text-center text-[13px] font-bold text-white shadow">
               {monthName} {yearStr}
             </div>
             <button 
                onClick={() => navigate(`/admin/pay/summary/${nextMonthKey}`)}
                className="flex-1 rounded-lg py-2 text-center text-[13px] font-bold text-[#64748B] hover:bg-slate-200/50 transition w-full"
             >
               {nextMonthLabel}
             </button>
          </div>
          <button 
            onClick={() => navigate(`/admin/pay/summary/${nextMonthKey}`)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5EAF0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition"
          >
            &gt;
          </button>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-[20px] font-bold text-[#0F172A]">{displayTitle}</h2>

        {/* Adapt card titles and terminology for Lab Admin billing */}
        <div className="mb-6 rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <h3 className="text-[18px] font-bold text-[#0F172A]">
              Total Booking
            </h3>
            <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-[#F59E0B]'}`}>
              {paymentStatus}
            </span>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div 
              className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm cursor-pointer hover:border-[#3B82F6] transition"
              onClick={() => navigate(APP_ROUTES.ADMIN.TOTAL_BOOKINGS(monthKey || '') + '?type=ALL')}
            >
              <p className="text-[12px] font-medium text-[#64748B]">
                Total bookings
              </p>
              <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{data.totalBookings}</p>
            </div>
            <div 
              className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm cursor-pointer hover:border-[#3B82F6] transition"
              onClick={() => navigate(APP_ROUTES.ADMIN.TOTAL_BOOKINGS(monthKey || '') + '?type=Online')}
            >
              <p className="text-[12px] font-medium text-[#64748B]">Online</p>
              <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{data.onlineTotal}</p>
            </div>
            <div 
              className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm cursor-pointer hover:border-[#3B82F6] transition"
              onClick={() => navigate(APP_ROUTES.ADMIN.TOTAL_BOOKINGS(monthKey || '') + '?type=Offline')}
            >
              <p className="text-[12px] font-medium text-[#64748B]">Offline</p>
              <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{data.offlineTotal}</p>
            </div>
            <div 
              className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm cursor-pointer hover:border-[#3B82F6] transition"
              onClick={() => navigate(APP_ROUTES.ADMIN.MONTH_CANCELLED(monthKey || ''))}
            >
              <p className="text-[12px] font-medium text-[#64748B]">Cancelled</p>
              <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{data.cancelledTotal}</p>
              <p className="mt-1 text-[11px] font-medium text-[#64748B]">(included in total)</p>
            </div>
          </div>

          <div>
            <p className="text-[28px] font-bold leading-none text-[#0F172A]">₹{data.totalAmount.toLocaleString('en-IN')}</p>
            {/* Display configured platform fee with dynamic lab report terminology */}
            <p className="mt-1 text-[13px] font-medium text-[#64748B]">
              Total accrued fees • {data.totalBookings} total appointments (Configured platform fee: ₹{data.configuredPlatformFee})
            </p>
          </div>
        </div>

        {/* Render doctor grid for Facility Admin */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.doctors.map((doc) => (
            <div
              key={doc.doctorId}
              onClick={() => navigate(`/admin/pay/summary/${monthKey}/doctor/${doc.doctorId}`)}
              className="flex flex-col rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-sm transition hover:border-[#3B82F6] hover:shadow-md cursor-pointer"
            >
              <div className="mb-4">
                <h4 className="text-[16px] font-bold text-[#0F172A]">{doc.doctorName}</h4>
                <p className="text-[13px] text-[#64748B]">{doc.specialization || 'Doctor'}</p>
              </div>

              <div className="mb-5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    isPaid ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FEF3C7] text-[#D97706]'
                  }`}
                >
                  {paymentStatus}
                </span>
              </div>

              <div className="mt-auto">
                <p className="text-[24px] font-bold text-[#0F172A] mb-1">₹{doc.amount.toLocaleString('en-IN')}</p>
                <p className="text-[12px] text-[#64748B]">
                  {doc.bookingCount} bookings • {doc.onlineCount} online • {doc.offlineCount} offline
                </p>
              </div>
            </div>
          ))}

          {data.doctors.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-[14px] font-medium text-slate-500">No bookings or platform fees accrued for this month.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
