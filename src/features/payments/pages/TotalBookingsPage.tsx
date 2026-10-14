import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { BackButton } from '@/components/ui/BackButton';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { 
  billingService,
  type FacilityMonthlyBookingsResponse
} from '@/api/services/billing/billing.service';
import { PatientDetailsModal } from '../components/PatientDetailsModal';
import { getApiErrorMessage } from '@/api/client';

// Adapt total bookings / lab reports page for Lab Admin terminology and facility type.
import { useIsLabFacility } from '@/hooks/useIsLabFacility';

export const TotalBookingsPage = () => {
  const isLabFacility = useIsLabFacility();
  const { monthKey } = useParams<{ monthKey: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const queryParams = new URLSearchParams(location.search);
  const initialType = queryParams.get('type') || 'ALL';
  const initialDoctor = queryParams.get('doctorId') || 'ALL';
  const initialPatient = queryParams.get('patientId') || 'ALL';

  const [data, setData] = useState<FacilityMonthlyBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [patientFilter, setPatientFilter] = useState(initialPatient);
  const [doctorFilter, setDoctorFilter] = useState(initialDoctor);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [page, setPage] = useState(1);
  
  // State for cancelled details modal
  const [selectedOrder, setSelectedOrder] = useState<FacilityMonthlyBookingsResponse['orders'][0] | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  // Use the API to fetch paginated records for the selected facility/month.
  const loadData = async () => {
    if (!monthKey) return;
    try {
      setLoading(true);
      const res = await billingService.getFacilityMonthlyBookings({
        monthKey,
        doctorId: doctorFilter !== 'ALL' ? doctorFilter : undefined,
        patientId: patientFilter !== 'ALL' ? patientFilter : undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        page,
        limit: 20
      });
      setData(res);
    } catch {
      showToast(isLabFacility ? 'Failed to load total lab reports' : 'Failed to load total bookings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [monthKey, doctorFilter, patientFilter, typeFilter, page]);

  // When filters change, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [doctorFilter, patientFilter, typeFilter]);

  // Reuse the existing cancellation/refund modal action so cancelled details remain consistent across the application.
  const handleRefund = async (appointmentId: string) => {
    try {
      setIsRefunding(true);
      await billingService.markPatientRefunded(appointmentId);
      showToast('Patient refund recorded as completed!', 'success');
      
      // Update the modal and list with fresh backend data so the user sees the 'Refunded' state
      await loadData();
      
      if (selectedOrder) {
        setSelectedOrder(prev => prev ? { 
          ...prev, 
          cancellation: { ...prev.cancellation, refunded: true, isPendingRefund: false } as any
        } : null);
      }
    } catch (err) {
      showToast(getApiErrorMessage(err) || 'Failed to process refund', 'error');
    } finally {
      setIsRefunding(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label={isLabFacility ? "Loading lab reports..." : "Loading bookings..."} />
      </div>
    );
  }

  if (!data) return null;

  const dateObj = new Date(`${monthKey}-01T00:00:00Z`);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const yearStr = dateObj.getUTCFullYear().toString();

  const totalPages = data.totalPages || 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = (safePage - 1) * data.limit + 1;
  const rangeEnd = Math.min(safePage * data.limit, data.total);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 pb-10">
      <div>
        <BackButton onClick={() => navigate(`/admin/pay/summary/${monthKey}`)}>Back</BackButton>
      </div>

      <div>
        {/* Adapt titles for Lab Admin */}
        <h1 className="text-[28px] font-bold text-[#0F172A] sm:text-[32px]">
          {isLabFacility ? `Total Lab Reports ${monthName} ${yearStr}` : `Total Bookings ${monthName} ${yearStr}`}
        </h1>
        <p className="mt-1 text-[14px] font-medium text-[#64748B]">
          {isLabFacility ? 'Overview of all lab reports for the laboratory' : 'Overview of all appointments for the facility'}
        </p>
      </div>

      {/* Filter and summary cards */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white p-6 text-[#0F172A] shadow-sm">
        <div className={`mb-6 grid grid-cols-1 gap-4 ${isLabFacility ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} border-b border-[#E5EAF0] pb-6`}>
          {!isLabFacility && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#64748B]">Doctor</label>
              <select 
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="rounded-xl border border-[#E5EAF0] bg-white px-3 py-2 text-[14px] font-medium text-[#0F172A] outline-none focus:border-[#3B82F6] shadow-sm transition-all cursor-pointer"
              >
                <option value="ALL">All doctors</option>
                {data.filters.doctors.map(doc => (
                  <option key={doc._id} value={doc._id}>{doc.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-[#64748B]">Patient</label>
            <select 
              value={patientFilter}
              onChange={(e) => setPatientFilter(e.target.value)}
              className="rounded-xl border border-[#E5EAF0] bg-white px-3 py-2 text-[14px] font-medium text-[#0F172A] outline-none focus:border-[#3B82F6] shadow-sm transition-all cursor-pointer"
            >
              <option value="ALL">All patients</option>
              {data.filters.patients.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">
              {isLabFacility ? 'Lab Reports' : 'Bookings'}
            </p>
            <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{data.summary.totalBookings}</p>
          </div>
          <div className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">Online / Offline</p>
            <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">{data.summary.onlineCount} / {data.summary.offlineCount}</p>
          </div>
          <div className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-medium text-[#64748B]">Payment</p>
            <p className="mt-1 text-[28px] font-bold leading-none text-[#0F172A]">₹{data.summary.totalPayment}</p>
          </div>
          <div className="rounded-xl border border-[#E5EAF0] bg-white p-4 shadow-sm flex flex-col justify-center items-start">
            <p className="text-[12px] font-medium text-[#64748B] mb-2">Status</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
              data.summary.paymentStatus === 'All Settled' || data.summary.paymentStatus === 'Paid' ? 'bg-[#D1FAE5] text-[#047857]' : 
              data.summary.paymentStatus === 'No Bookings' || data.summary.paymentStatus === 'No Dues' ? 'bg-slate-100 text-[#64748B]' : 'bg-[#FEF3C7] text-[#D97706]'
            }`}>
              {data.summary.paymentStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Table view with conditional doctor column based on facility type */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white shadow-sm overflow-hidden text-[#0F172A] mt-2">
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E5EAF0] text-[#64748B]">
                <th className="py-3 font-medium">Date</th>
                <th className="py-3 font-medium">Patient</th>
                {!isLabFacility && <th className="py-3 font-medium">Doctor</th>}
                <th className="py-3 font-medium">
                  <div className="flex items-center gap-2">
                    Type
                    <select 
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="rounded border border-[#E5EAF0] bg-[#F8FAFC] px-1 py-0.5 text-[11px] font-medium text-[#0F172A] outline-none cursor-pointer"
                    >
                      <option value="ALL">All</option>
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                </th>
                <th className="py-3 font-medium">Service fee</th>
                <th className="py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={isLabFacility ? 5 : 6} className="py-8 text-center text-[#64748B]">
                    {isLabFacility ? 'No lab reports found for the selected filters.' : 'No bookings found for the selected filters.'}
                  </td>
                </tr>
              ) : (
                data.orders.map(order => {
                  const dateStr = new Date(order.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                  return (
                    <tr 
                      key={order._id} 
                      className="border-b border-[#E5EAF0] transition cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="py-4">{dateStr}</td>
                      <td className="py-4 font-medium">{order.patient?.name || '-'}</td>
                      {!isLabFacility && <td className="py-4">{order.doctor?.name || '-'}</td>}
                      <td className="py-4">
                        <span className="inline-flex rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-[12px] font-bold text-[#0369A1]">
                          {order.type}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-[#0F172A]">₹{order.serviceFee}</td>
                      <td className="py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                          order.status === 'CANCELLED' ? 'text-red-700 bg-red-100' : 
                          order.status === 'COMPLETED' ? 'text-[#047857] bg-[#D1FAE5]' : 
                          'text-[#D97706] bg-[#FEF3C7]'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EAF0] bg-[#F8FAFC] px-5 py-3">
            <p className="text-[13px] font-semibold text-[#64748B]">
              Showing <span className="font-bold text-[#0F172A]">{rangeStart}</span> to{' '}
              <span className="font-bold text-[#0F172A]">{rangeEnd}</span> of{' '}
              <span className="font-bold text-[#0F172A]">{data.total}</span> records
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
        )}
      </div>

      <PatientDetailsModal 
        appointment={selectedOrder as any}
        doctorName={selectedOrder?.doctor?.name}
        onClose={() => setSelectedOrder(null)}
        onRefund={handleRefund}
        isRefunding={isRefunding}
      />
    </div>
  );
};
