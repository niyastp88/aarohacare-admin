import type { AppointmentStatus } from '@/types/dto';

export const APPOINTMENT_STATUS = {
  PENDING: 'PENDING',
  CONSULTING: 'CONSULTING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, AppointmentStatus>;

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: 'Pending',
  CONSULTING: 'Consulting',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: 'bg-waiting-soft text-waiting',
  CONSULTING: 'bg-primary-light text-primary-dark',
  COMPLETED: 'bg-success-soft text-success',
  CANCELLED: 'bg-error-soft text-error',
};
