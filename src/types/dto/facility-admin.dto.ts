import type { AppointmentResponseDto } from './appointment.dto';
import type { DoctorResponseDto } from './doctor.dto';
import type { UserResponseDto } from './auth.dto';

// Breakdown of OP bookings grouped by actual booked patientName snapshot per patient directory card.
export interface PatientBreakdownDto {
  name: string;
  total: number;
  online: number;
  offline: number;
  age?: number;
  hasCancelled?: boolean;
  hasPendingRefund?: boolean;
}

export interface FacilityPatientDto {
  _id: string;
  name: string;
  phone: string;
  place?: string;
  age?: number;
  gender?: string;
  profileImage?: string;
  address?: string;
  healthCardId?: string;
  createdAt?: string;
  lastBookingAt?: string;
  lastVisitAt?: string;
  firstBookingAt?: string;
  bookingCount: number;
  // Online and offline breakdown counts for unique patient directory card display
  onlineBookingCount?: number;
  offlineBookingCount?: number;
  patientBreakdown?: PatientBreakdownDto[];
  doctorCount?: number;
  lastDoctorName?: string;
  lastBookingType?: 'Online' | 'Offline';
  lastStatus?: string;
  latestOpStatus?: 'Pending' | 'Completed' | 'Cancelled' | 'Auto Cancelled';
  lastCancellationReason?: string;
  lastArrivedAt?: string;
  lastRefunded?: boolean;
  lastRefundAmount?: number;
  lastRefundPhone?: string;
  lastRefundUpiId?: string;
  lastCancelledBy?: string;
  pendingRefundCount?: number;
  pendingRefundAmount?: number;
  hasPendingRefund?: boolean;
}

export interface FacilityPatientsStatsDto {
  confirmedBookings: number;
  onlineBookings: number;
  offlineBookings: number;
  cancelled: number;
  registered: number;
  registeredUsers?: number;
  pendingRefunds?: number;
  pendingRefundAmount?: number;
  allUsers: number;
  // Canonical distinct normalized phone count for All Patients card
  allPatients?: number;
}

export interface FacilityPatientsTotalsDto {
  confirmedBookings: number;
  allUsers: number;
}

export interface FacilityPatientsPageDto {
  items: FacilityPatientDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats?: FacilityPatientsStatsDto;
  totals?: FacilityPatientsTotalsDto;
}

export interface FacilityPatientDetailDto {
  patient: UserResponseDto;
  bookingCount: number;
  doctors: Array<{
    doctor: DoctorResponseDto;
    bookingCount: number;
  }>;
  appointments: AppointmentResponseDto[];
}

export interface FacilityPatientsQuery {
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  /** Filter cancelled bookings by refund state */
  refundStatus?: 'pending' | 'refunded';
  bookingType?: 'online' | 'offline';
  patientType?: 'registered' | 'walkin';
  status?: string;
  dayOfWeek?: number;
}

export interface OfflineBookingRequestDto {
  doctorId: string;
  date: string;
  tokenNumber: number;
  patientName: string;
  patientPhone: string;
  patientAge?: number;
}

export interface LiveQueueResponseDto {
  doctor: DoctorResponseDto;
  date: string;
  liveOpNumber: number;
  appointments: AppointmentResponseDto[];
}

export type LiveOpAction = 'next' | 'previous' | 'break' | 'resume';

/** One doctor's live board entry on the OP control page. */
export interface LiveBoardItemDto {
  doctor: DoctorResponseDto;
  date: string;
  liveOpNumber: number;
  onBreak: boolean;
  /** True when new bookings are closed for this doctor/date. */
  isClosed?: boolean;
  totalBooked: number;
  onlineCount?: number;
  offlineCount?: number;
  cancelledCount?: number;
  /** Patients called (token < live OP) who have not been marked arrived. */
  waitingCount?: number;
  current?: AppointmentResponseDto | null;
  /** Still in the OP list — not called yet (token > live OP). */
  queue?: AppointmentResponseDto[];
  /** Called via Next without Mark Arrived. */
  waiting?: AppointmentResponseDto[];
  upcoming: AppointmentResponseDto[];
  /** Mark Arrived, then Next Patient — consulted. */
  served?: AppointmentResponseDto[];
}
