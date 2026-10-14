import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STYLES } from '@/constants/appointmentStatus';
import type { AppointmentStatus } from '@/types/dto';

export const StatusBadge = ({ status }: { status: AppointmentStatus }) => (
  <span
    className={`inline-block rounded-full px-3 py-1 text-[13px] font-semibold ${APPOINTMENT_STATUS_STYLES[status]}`}
  >
    {APPOINTMENT_STATUS_LABELS[status]}
  </span>
);
