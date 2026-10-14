
import { useState } from 'react';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import type { AppointmentResponseDto, DoctorResponseDto } from '@/types/dto';
import { toTitleCase } from '@/utils/formatters';
import { OpConsultationPrintForm } from '@/components/print/OpConsultationPrintForm';

type Props = {
  appointment: AppointmentResponseDto | null;
  onClose: () => void;
  onMarkRefunded?: (appointmentId: string) => void;
  isMarkingRefunded?: boolean;
};

// Use the selected appointment's patient information so the consultation shows the person actually booked for the OP, not the account owner's name.
export const AppointmentDetailsModal = ({
  appointment,
  onClose,
  onMarkRefunded,
  isMarkingRefunded,
}: Props) => {
  const [isPrinting, setIsPrinting] = useState(false);
  if (!appointment) return null;

  const doctor = (typeof appointment.doctorId === 'object' ? appointment.doctorId : null) as DoctorResponseDto | null;
  const isOffline = appointment.time === 'QUEUE';
  const patientObj = (typeof appointment.patientId === 'object' ? appointment.patientId : null) as {
    name?: string;
    phone?: string;
    age?: number;
    gender?: string;
  } | null;

  const patientName = appointment.patientName || patientObj?.name || 'Unknown Patient';
  const patientPhone = appointment.patientPhone || patientObj?.phone;
  const patientAge = appointment.patientAge ?? patientObj?.age;
  const patientGender = (appointment as any).patientGender || patientObj?.gender;

  const isCancelled = appointment.status === 'CANCELLED';
  const isRefunded = appointment.cancellation?.refunded === true;
  const refundAmount = appointment.cancellation?.refundAmount;
  const refundPhone = appointment.cancellation?.refundPhone || patientPhone;
  const refundUpiId = appointment.cancellation?.refundUpiId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[24px] bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              Consultation Details
            </h3>
            <p className="text-xs text-slate-500">
              Token #{appointment.tokenNumber || '—'} · {isOffline ? 'Offline Walk-in' : 'Online Booking'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="Print OP Consultation Form"
              aria-label="Print OP Consultation Form"
              onClick={() => setIsPrinting(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E4287] bg-white text-[#1E4287] shadow-2xs transition hover:bg-blue-50/70 active:scale-95"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Patient Details
            </h4>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Name:</span>
                <span className="font-bold text-[#0F172A]">{toTitleCase(patientName)}</span>
              </div>
              {patientPhone && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Phone:</span>
                  <span className="font-bold text-[#0F172A]">{patientPhone}</span>
                </div>
              )}
              {patientAge != null && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Age:</span>
                  <span className="font-bold text-[#0F172A]">{patientAge} {patientAge === 1 ? 'year' : 'years'}</span>
                </div>
              )}
              {patientGender && (
                <div className="flex justify-between">
                  <span className="font-medium text-slate-500">Gender:</span>
                  <span className="font-bold text-[#0F172A] capitalize">{patientGender}</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Booking Info
            </h4>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">OP Number:</span>
                <span className="font-bold text-[#0F172A]">#{appointment.tokenNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Type:</span>
                <span className="font-bold text-[#0F172A]">{isOffline ? 'Offline' : 'Online'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Date:</span>
                <span className="font-bold text-[#0F172A]">
                  {appointment.date
                    ? new Date(`${appointment.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-500">Status:</span>
                <div className="flex flex-col items-end">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${appointment.status === 'CANCELLED'
                      ? 'bg-rose-100 text-rose-700'
                      : appointment.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : appointment.status === 'CONSULTING'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                  >
                    {appointment.status === 'CANCELLED'
                      ? (appointment.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                         appointment.cancellationReason === 'Patient Not Arrived')
                        ? 'Auto Cancelled'
                        : 'Cancelled'
                      : appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).toLowerCase()}
                  </span>
                  {/* Display Patient Not Arrived directly below the Auto Cancelled status as a separate label */}
                  {appointment.status === 'CANCELLED' && (
                    appointment.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                    appointment.cancellationReason === 'Patient Not Arrived'
                  ) && (
                    <PatientNotArrivedBadge className="mt-1" />
                  )}
                </div>
              </div>
              {/* Display historical Consultation Fee saved specifically for this appointment snapshot */}
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-500">Consultation Fee:</span>
                <span className="font-bold text-[#0F172A]">
                  {(appointment.consultationFeeAtBooking !== undefined && appointment.consultationFeeAtBooking !== null)
                    ? `₹${appointment.consultationFeeAtBooking}`
                    : (appointment.consultationFee !== undefined && appointment.consultationFee !== null)
                      ? `₹${appointment.consultationFee}`
                      : '—'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Assigned Doctor
            </h4>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-[14px] font-bold text-[#0F172A]">
                {doctor ? `Dr. ${toTitleCase(doctor.name.replace(/^dr\.?\s*/i, ''))}` : 'Doctor'}
              </p>
              <p className="text-[12px] text-slate-600">
                {doctor?.specialization || 'General'}
              </p>
            </div>
          </div>

          {isCancelled && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-1.5">
                Cancellation & Refund
              </h4>
              <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 space-y-2 text-[13px]">
                {appointment.cancelledAt && (
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">Cancelled At:</span>
                    <span className="text-slate-700 font-semibold">
                      {new Date(appointment.cancelledAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                {(appointment.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                appointment.cancellationReason === 'Patient Not Arrived') ? (
                  <div className="flex justify-between items-center pt-1 border-t border-rose-100">
                    <span className="font-medium text-slate-500">Refund Status:</span>
                    <PatientNotArrivedBadge />
                  </div>
                ) : (
                  <>
                    {refundPhone && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Refund Phone:</span>
                        <span className="text-slate-700 font-semibold">+91 {refundPhone}</span>
                      </div>
                    )}
                    {refundUpiId && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">UPI ID:</span>
                        <span className="text-[#0B2A4A] font-bold">{refundUpiId}</span>
                      </div>
                    )}
                    {typeof refundAmount === 'number' && (
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-500">Refund Amount:</span>
                        <span className="font-bold text-[#0F172A]">₹{refundAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {typeof refundAmount === 'number' && refundAmount > 0 ? (
                      <div className="flex justify-between items-center pt-1 border-t border-rose-100">
                        <span className="font-medium text-slate-500">Refund Status:</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            isRefunded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isRefunded ? 'Refund Completed' : `Refund Pending: ₹${refundAmount}`}
                        </span>
                      </div>
                    ) : typeof refundAmount === 'number' && refundAmount === 0 ? (
                      <div className="flex justify-between items-center pt-1 border-t border-rose-100">
                        <span className="font-medium text-slate-500">Refund Status:</span>
                        <span className="text-[12px] font-medium text-slate-500">
                          No refund applicable
                        </span>
                      </div>
                    ) : null}

                    {!isRefunded && (refundAmount ?? 0) > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {refundUpiId && refundAmount ? (
                          <a
                            href={`upi://pay?pa=${encodeURIComponent(refundUpiId)}&pn=${encodeURIComponent(patientName)}&am=${refundAmount}&cu=INR&tn=${encodeURIComponent('OP Cancellation Refund')}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                          >
                            Pay UPI (₹{refundAmount})
                          </a>
                        ) : null}
                        {onMarkRefunded && (
                          <button
                            type="button"
                            disabled={isMarkingRefunded}
                            onClick={() => onMarkRefunded(appointment._id)}
                            className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            Mark Refund Completed
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated A4 OP Consultation Form print overlay */}
      {isPrinting && (
        <OpConsultationPrintForm
          data={{
            doctorName: doctor?.name,
            department: doctor?.specialization || 'General Medicine',
            date: appointment.date,
            patientName,
            tokenNumber: appointment.tokenNumber,
            opNumber: appointment.tokenNumber ? `OP-${String(appointment.tokenNumber).padStart(6, '0')}` : undefined,
            age: patientAge,
            gender: patientGender,
            phone: patientPhone,
            place: (appointment as any).place || (patientObj as any)?.place,
          }}
          onClose={() => setIsPrinting(false)}
        />
      )}
    </div>
  );
};
