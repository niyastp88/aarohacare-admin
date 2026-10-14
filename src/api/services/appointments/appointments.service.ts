import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type {
  AppointmentResponseDto,
  AppointmentStatus,
  FacilityPatientDetailDto,
  FacilityPatientsPageDto,
  FacilityPatientsQuery,
  OfflineBookingRequestDto,
  UpdateAppointmentStatusRequestDto,
} from '@/types/dto';

const toPatientsQuery = (params: FacilityPatientsQuery = {}) => {
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.fromDate) search.set('fromDate', params.fromDate);
  if (params.toDate) search.set('toDate', params.toDate);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.refundStatus) search.set('refundStatus', params.refundStatus);
  if (params.bookingType) search.set('bookingType', params.bookingType);
  if (params.patientType) search.set('patientType', params.patientType);
  if (params.status) search.set('status', params.status);
  // Include the selected weekday so the backend can apply the Day filter.
  if (params.dayOfWeek) search.set('dayOfWeek', String(params.dayOfWeek));
  const qs = search.toString();
  return qs ? `${API_PATHS.APPOINTMENTS.PATIENTS}?${qs}` : API_PATHS.APPOINTMENTS.PATIENTS;
};

export const appointmentsService = {
  list: async (doctorId?: string): Promise<AppointmentResponseDto[]> => {
    const path = doctorId
      ? API_PATHS.APPOINTMENTS.LIST_BY_DOCTOR(doctorId)
      : API_PATHS.APPOINTMENTS.LIST;
    const { data } = await apiClient.get<AppointmentResponseDto[]>(path);
    return data;
  },

  listPatients: async (params: FacilityPatientsQuery = {}): Promise<FacilityPatientsPageDto> => {
    const { data } = await apiClient.get<FacilityPatientsPageDto>(toPatientsQuery(params));
    return data;
  },

  getPatientDetail: async (patientId: string): Promise<FacilityPatientDetailDto> => {
    const { data } = await apiClient.get<FacilityPatientDetailDto>(
      API_PATHS.APPOINTMENTS.PATIENT_DETAIL(patientId),
    );
    return data;
  },

  bookOffline: async (body: OfflineBookingRequestDto): Promise<AppointmentResponseDto> => {
    const { data } = await apiClient.post<AppointmentResponseDto>(
      API_PATHS.APPOINTMENTS.OFFLINE,
      body,
    );
    return data;
  },

  lookupPatientByPhone: async (
    phone: string,
  ): Promise<Array<{ name: string; age?: number; phone: string }>> => {
    const { data } = await apiClient.get<Array<{ name: string; age?: number; phone: string }>>(
      `${API_PATHS.APPOINTMENTS.PATIENT_LOOKUP}?phone=${encodeURIComponent(phone)}`,
    );
    return data;
  },

  updateStatus: async (
    appointmentId: string,
    status: AppointmentStatus,
    extras?: { refundPhone?: string; refunded?: boolean; refundAmount?: number },
  ): Promise<AppointmentResponseDto> => {
    const body: UpdateAppointmentStatusRequestDto = {
      status,
      refundPhone: extras?.refundPhone,
      refunded: extras?.refunded,
      refundAmount: extras?.refundAmount,
    };
    const { data } = await apiClient.patch<AppointmentResponseDto>(
      API_PATHS.APPOINTMENTS.UPDATE_STATUS(appointmentId),
      body,
    );
    return data;
  },

  markArrived: async (appointmentId: string): Promise<AppointmentResponseDto> => {
    const { data } = await apiClient.patch<AppointmentResponseDto>(
      API_PATHS.APPOINTMENTS.MARK_ARRIVED(appointmentId),
    );
    return data;
  },

  unmarkArrived: async (appointmentId: string): Promise<AppointmentResponseDto> => {
    const { data } = await apiClient.patch<AppointmentResponseDto>(
      API_PATHS.APPOINTMENTS.UNMARK_ARRIVED(appointmentId),
    );
    return data;
  },

  markRefunded: async (
    appointmentId: string,
    refunded = true,
  ): Promise<AppointmentResponseDto> => {
    const { data } = await apiClient.patch<AppointmentResponseDto>(
      API_PATHS.APPOINTMENTS.MARK_REFUNDED(appointmentId),
      { refunded },
    );
    return data;
  },
};
