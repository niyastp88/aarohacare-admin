import type { UserResponseDto } from './auth.dto';
import type { DoctorResponseDto } from './doctor.dto';

export type AppointmentStatus = 'PENDING' | 'CONSULTING' | 'COMPLETED' | 'CANCELLED';

export interface AppointmentCancellationDto {
  requestedAt?: string;
  cancelledBy?: 'PATIENT' | 'ADMIN';
  refundPhone?: string;
  refundUpiId?: string;
  policyAgreedAt?: string;
  within30Minutes?: boolean;
  refundPolicy?: 'FULL_OP_NO_CONVENIENCE' | 'PARTIAL_90_NO_CONVENIENCE';
  refundAmount?: number;
  refunded?: boolean;
  reason?: string;
}

/** Matches backend AppointmentResponseDto (populated doctorId / patientId). */
export interface AppointmentResponseDto {
  _id: string;
  doctorId: string | DoctorResponseDto;
  patientId: string | UserResponseDto;
  patientName?: string;
  patientAge?: number;
  patientPhone?: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  tokenNumber?: string;
  consultationFee?: number;
  consultationFeeAtBooking?: number;
  platformFee?: number;
  arrivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancellation?: AppointmentCancellationDto;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateAppointmentStatusRequestDto {
  status: AppointmentStatus;
  refundPhone?: string;
  refunded?: boolean;
  refundAmount?: number;
}
