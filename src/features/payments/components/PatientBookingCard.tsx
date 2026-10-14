import type { DoctorOrder } from '@/api/services/billing/billing.service';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import { format12Hour } from '@/utils/dateTime';
import { toTitleCase } from '@/utils/formatters';

const initialsOf = (name?: string) => {
  if (!name) return 'P';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export interface PatientBookingCardProps {
  order: DoctorOrder;
  onClick: () => void;
  onMarkRefunded?: (appointmentId: string) => void;
  refundingId?: string | null;
}

/**
 * Reusable single-patient booking card matching AarohCare's standard patient row design.
 */
export const PatientBookingCard = ({
  order,
  onClick,
  onMarkRefunded,
  refundingId,
}: PatientBookingCardProps) => {
  const isOffline =
    order.paymentStatus === 'OFFLINE' ||
    order.paymentStatus === 'PAY_AT_CLINIC' ||
    order.time === 'QUEUE' ||
    (order as any).type === 'Offline';
  const isCancelled = order.status === 'CANCELLED';
  const isRefunded = order.cancellation?.refunded === true;
  const patientName = order.patient?.name || 'Patient';
  const initials = initialsOf(patientName);

  return (
    <div
      onClick={onClick}
      className="flex flex-col gap-3.5 rounded-2xl border border-[#E5EAF0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] cursor-pointer hover:border-[#CBD5E1] hover:shadow-sm transition"
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {/* Left: Avatar + Name + Phone */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          {order.patient?.profileImage ? (
            <img
              src={order.patient.profileImage}
              alt={patientName}
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[13px] font-bold text-[#1D4ED8]">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-[#0B2A4A]">
              {toTitleCase(patientName)}
            </p>
            <p className="truncate text-[13px] font-medium text-[#64748B]">
              {order.patient?.phone ? `+91 ${order.patient.phone}` : 'No phone provided'}
            </p>
          </div>
        </div>

        {/* Columns: Token, Age, Date & Time, Channel, Fee, Status */}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-end sm:gap-6">
          {/* Token # */}
          <div className="w-[70px] shrink-0">
            <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">TOKEN</p>
            <p className="text-[15px] font-black text-[#0B2A4A]">
              #{order.tokenNumber || '—'}
            </p>
          </div>

          {/* Age */}
          <div className="w-[50px] shrink-0">
            <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">AGE</p>
            <p className="text-[15px] font-bold text-[#0F172A]">
              {order.patient?.age != null ? order.patient.age : '—'}
            </p>
          </div>

          {/* Date & Time */}
          <div className="w-[120px] shrink-0">
            <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">DATE & TIME</p>
            <p className="text-[13.5px] font-bold text-[#0F172A]">{order.date}</p>
            <p className="text-[11.5px] font-medium text-[#64748B]">
              {order.time ? (order.time === 'QUEUE' ? 'Queue' : format12Hour(order.time)) : 'Queue'}
            </p>
          </div>

          {/* Channel Type */}
          <div className="w-[90px] shrink-0">
            <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">TYPE</p>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isOffline
                ? 'bg-violet-50 text-violet-700 border border-violet-200'
                : 'bg-sky-50 text-sky-700 border border-sky-200'
                }`}
            >
              {isOffline ? 'Offline' : 'Online'}
            </span>
          </div>

          {/* Fee */}
          <div className="w-[75px] shrink-0 text-right sm:text-left">
            <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">FEE</p>
            <p className="text-[15px] font-extrabold text-[#0B2A4A]">₹{order.consultationFee}</p>
          </div>

          {/* Status */}
          <div className="w-[135px] shrink-0 sm:flex sm:flex-col sm:items-center sm:justify-center text-center">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold ${isCancelled
                ? 'bg-[#FFE4E6] text-[#BE123C]'
                : order.status === 'COMPLETED' || order.status === 'CONFIRMED' || order.status === 'CONSULTING'
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : 'bg-[#FEF3C7] text-[#B45309]'
                }`}
            >
              {order.status === 'CANCELLED'
                ? (order.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                   order.cancellationReason === 'Patient Not Arrived')
                  ? 'Auto Cancelled'
                  // Primary badge is always 'Cancelled'; refund completion is shown as sub-text below.
                  : 'Cancelled'
                : order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()}
            </span>
            {/* Display Patient Not Arrived directly below the Auto Cancelled status */}
            {isCancelled && (
              order.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
              order.cancellationReason === 'Patient Not Arrived'
            ) && (
              <PatientNotArrivedBadge className="mt-1" />
            )}
            {/* Refund Completed sub-text: shown only when refunded=true and not auto-cancelled.
                Primary status remains 'Cancelled'; 'Refund Completed' mirrors the PatientNotArrivedBadge style. */}
            {isCancelled && isRefunded && !(
              order.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
              order.cancellationReason === 'Patient Not Arrived'
            ) && (
              <span className="mt-1 inline-block text-[11px] font-bold text-[#16A34A] whitespace-nowrap tracking-tight leading-none">
                Refund Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cancelled & Refund Warning Banner if applicable */}
      {isCancelled && order.isPendingRefund && !(
        order.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
        order.cancellationReason === 'Patient Not Arrived'
      ) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900"
        >
          <div>
            <span className="font-extrabold text-rose-900">
              ⚠️ Refund Owed: ₹{order.cancellation?.refundAmount || order.consultationFee}
            </span>
            {order.cancellation?.refundPhone && (
              <span className="ml-2 font-medium text-rose-800">
                (Mobile: +91 {order.cancellation.refundPhone})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order.cancellation?.refundUpiId && (
              <a
                href={`upi://pay?pa=${encodeURIComponent(order.cancellation.refundUpiId)}&pn=${encodeURIComponent(order.patient?.name || 'Patient')}&am=${order.cancellation?.refundAmount || order.consultationFee}&cu=INR&tn=${encodeURIComponent('OP Booking Cancel Refund')}`}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 transition"
              >
                ⚡ 1-Click Pay UPI
              </a>
            )}
            {onMarkRefunded && (
              <button
                type="button"
                disabled={refundingId === order._id}
                onClick={() => void onMarkRefunded(order._id)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {refundingId === order._id ? 'Saving...' : 'Mark Refunded'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
