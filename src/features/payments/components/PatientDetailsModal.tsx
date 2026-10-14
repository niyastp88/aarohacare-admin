import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';



type ModalAppointment = {
  _id: string;
  date: string;
  time?: string;
  type?: string;
  status: string;
  arrivedAt?: string;
  cancellationReason?: string;
  consultationFee?: number;
  patient?: { name?: string; phone?: string } | null;
  doctor?: { name?: string; specialization?: string } | null;
  cancellation?: {
    refunded?: boolean;
    refundAmount?: number;
    cancelledBy?: string;
    reason?: string;
  } | null;
};

type Props = {
  // Pass the selected appointment/booking data to the new component through props
  appointment: ModalAppointment | null;
  doctorName?: string;
  onClose: () => void;
  onRefund: (appointmentId: string) => void;
  isRefunding: boolean;
};

// Update the existing cancelled-booking modal to match the reference design while keeping the existing `/admin/patients/cancelled` page unchanged.
export const PatientDetailsModal = ({ appointment, doctorName, onClose, onRefund, isRefunding }: Props) => {
  if (!appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h3 className="text-lg font-bold text-[#0F172A]">
            Cancelled booking
          </h3>
          <button 
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="max-h-[75vh] overflow-y-auto px-6 pb-6 space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <p className="text-[13px] font-medium text-slate-500">Patient</p>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {appointment.patient?.name || 'Unknown'}
            </p>
          </div>
          
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <p className="text-[13px] font-medium text-slate-500">Phone number</p>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {appointment.patient?.phone ? `+91 ${appointment.patient.phone}` : '—'}
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <p className="text-[13px] font-medium text-slate-500">Doctor</p>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {doctorName || appointment.doctor?.name || 'Unknown'}
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <p className="text-[13px] font-medium text-slate-500">Date</p>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {new Date(appointment.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <p className="text-[13px] font-medium text-slate-500">Type</p>
            <p className="text-[13px] font-bold text-[#0F172A]">
              {appointment.type || (appointment.time === 'QUEUE' ? 'Offline' : 'Online')}
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <p className="text-[13px] font-medium text-slate-500">Status</p>
            <div className="flex flex-col items-end">
              {/* Display Auto Cancelled for automatically cancelled appointments, Cancelled for manual/patient cancellations */}
              <span className={`text-[13px] font-bold ${
                appointment.status === 'CANCELLED' ? 'text-red-500' : 'text-emerald-500'
              }`}>
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

          {appointment.status === 'CANCELLED' && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-6">
                <p className="text-[13px] font-medium text-slate-500">Refund</p>
                {appointment.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                appointment.cancellationReason === 'Patient Not Arrived' ? (
                  <PatientNotArrivedBadge />
                ) : appointment.cancellation?.cancelledBy === 'PATIENT' ||
                (appointment.time !== 'QUEUE' && appointment.cancellation?.cancelledBy !== 'ADMIN') ? (
                  <span className="text-[13px] font-bold text-slate-600">Online Cancelled</span>
                ) : appointment.cancellation?.refunded ? (
                  <span className="text-[13px] font-bold text-emerald-600">Refund Completed</span>
                ) : (appointment.cancellation?.refundAmount ?? appointment.consultationFee ?? 0) > 0 ? (
                  <span className="text-[13px] font-bold text-amber-600">
                    Refund Pending: ₹{appointment.cancellation?.refundAmount ?? appointment.consultationFee}
                  </span>
                ) : (
                  <span className="text-[13px] font-medium text-slate-400">No Refund Applicable</span>
                )}
              </div>
              
              {!appointment.cancellation?.refunded &&
                !(
                  appointment.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                  appointment.cancellationReason === 'Patient Not Arrived'
                ) &&
                !(
                  appointment.cancellation?.cancelledBy === 'PATIENT' ||
                  (appointment.time !== 'QUEUE' && appointment.cancellation?.cancelledBy !== 'ADMIN')
                ) &&
                ((appointment.cancellation?.refundAmount ?? appointment.consultationFee ?? 0) > 0) && (
                // Reuse the existing refund action so the redesigned details view continues using the application's authoritative backend refund workflow.
                <button 
                  onClick={() => onRefund(appointment._id)}
                  disabled={isRefunding}
                  className="w-full rounded-[14px] bg-[#162C4E] py-3.5 text-[14px] font-bold text-white transition hover:bg-[#162C4E]/90 disabled:opacity-50"
                >
                  {isRefunding ? 'Processing...' : 'Mark refunded'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
