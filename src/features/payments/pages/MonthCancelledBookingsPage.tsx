import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billingService, type CancelledOrderDto, type FacilityCancelledOrdersResponse } from '@/api/services/billing/billing.service';
import { PatientDetailsModal } from '@/features/payments/components/PatientDetailsModal';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';

// Adapt month cancelled bookings page to support Lab Admin terminology and hide Doctor details when viewed by Lab Admin.
import { useIsLabFacility } from '@/hooks/useIsLabFacility';

export const MonthCancelledBookingsPage = () => {
  const isLabFacility = useIsLabFacility();
  const { monthKey } = useParams<{ monthKey: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<FacilityCancelledOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<CancelledOrderDto | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  useEffect(() => {
    if (!monthKey) return;
    const fetchCancelled = async () => {
      try {
        setLoading(true);
        // Apply monthKey to the backend query so cancelled records are scoped to the selected month.
        const res = await billingService.getFacilityCancelledOrders({ monthKey, page, limit: 20 });
        setData(res);
      } catch (err: any) {
        showToast(err.response?.data?.message || (isLabFacility ? 'Failed to fetch cancelled lab reports' : 'Failed to fetch cancelled bookings'), 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchCancelled();
  }, [monthKey, page, isLabFacility]);

  const formattedMonth = monthKey ? new Date(`${monthKey}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '';

  const handleMarkRefunded = async (appointmentId: string) => {
    try {
      setRefundingId(appointmentId);
      await billingService.markPatientRefunded(appointmentId);
      showToast('Patient marked as refunded successfully', 'success');
      
      if (monthKey) {
        const res = await billingService.getFacilityCancelledOrders({ monthKey, page, limit: 20 });
        setData(res);
      }
      setSelectedOrder(null);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to mark as refunded', 'error');
    } finally {
      setRefundingId(null);
    }
  };

  if (loading && !data) return <div className="flex h-64 items-center justify-center min-h-screen bg-slate-50"><Spinner /></div>;
  if (!data) return null;

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen font-sans">
      <button 
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center text-[14px] font-bold text-blue-600 hover:text-blue-700 transition"
      >
        ← Back
      </button>

      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-[#0F172A]">
          {isLabFacility ? 'Cancelled lab reports' : 'Cancelled bookings'}
        </h1>
        <p className="mt-1 text-[14px] font-medium text-slate-500">{formattedMonth}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
          <p className="text-[13px] font-medium text-[#64748B]">Cancelled</p>
          <p className="mt-1 text-[32px] font-bold leading-none text-[#0F172A]">{data.summary.totalCancelledCount}</p>
          <p className="mt-1 text-[11px] font-medium text-[#64748B]">(included in total)</p>
        </div>
        <div className="rounded-xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
          <p className="text-[13px] font-medium text-[#64748B]">Refunded</p>
          <p className="mt-1 text-[32px] font-bold leading-none text-[#0F172A]">{data.summary.totalRefundedCount}</p>
        </div>
        <div className="rounded-xl border border-[#E5EAF0] bg-white p-5 shadow-sm">
          <p className="text-[13px] font-medium text-[#64748B]">Refund pending</p>
          <p className="mt-1 text-[32px] font-bold leading-none text-[#0F172A]">{data.summary.pendingRefundCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5EAF0] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto p-5">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E5EAF0] text-[#64748B] bg-slate-50/50">
                <th className="py-3 font-medium">Patient</th>
                <th className="py-3 font-medium">Phone number</th>
                {!isLabFacility && <th className="py-3 font-medium">Doctor</th>}
                <th className="py-3 font-medium">Date</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 font-medium">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={isLabFacility ? 5 : 6} className="py-8 text-center text-slate-500">
                    {isLabFacility ? `No cancelled lab reports found for ${formattedMonth}.` : `No cancelled bookings found for ${formattedMonth}.`}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => {
                  const isRefunded = item.cancellation?.refunded === true || item.paymentStatus === 'REFUNDED';
                  const isPending = item.paymentStatus === 'PAID' && !isRefunded;

                  return (
                    <tr 
                      key={item._id} 
                      onClick={() => setSelectedOrder(item)}
                      className="cursor-pointer transition hover:bg-slate-50 text-[#0F172A]"
                    >
                      <td className="py-4 font-bold">{item.patient?.name || 'Unknown'}</td>
                      <td className="py-4">{item.patient?.phone ? `+91 ${item.patient.phone}` : '—'}</td>
                      {!isLabFacility && <td className="py-4">{item.doctor?.name || 'Unknown'}</td>}
                      <td className="py-4">{new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                      <td className="py-4">
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 border border-red-200">
                          Cancelled
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          {isRefunded ? (
                            <span className="text-[13px] font-bold text-emerald-600">Refunded</span>
                          ) : isPending ? (
                            <>
                              <span className="text-[13px] font-bold text-amber-600">Pending</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkRefunded(item._id);
                                }}
                                disabled={refundingId === item._id}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                              >
                                {refundingId === item._id ? 'Saving...' : 'Mark refunded'}
                              </button>
                            </>
                          ) : (
                            <span className="text-[12px] text-slate-500">N/A</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E5EAF0] bg-white px-5 py-4">
            <span className="text-[12px] font-medium text-slate-500">
              Showing Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={data.page === 1}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={data.page === data.totalPages}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <PatientDetailsModal 
        appointment={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onRefund={(id) => {
          void handleMarkRefunded(id);
        }}
        isRefunding={refundingId === selectedOrder?._id}
      />
    </div>
  );
};
