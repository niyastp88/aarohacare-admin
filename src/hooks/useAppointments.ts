import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsService } from '@/api/services/appointments';
import { doctorsService } from '@/api/services/doctors';
import { QUERY_KEYS } from '@/constants/queryKeys';
import type {
  AppointmentStatus,
  FacilityPatientsQuery,
  LiveOpAction,
  OfflineBookingRequestDto,
} from '@/types/dto';

export const useAppointments = (doctorId?: string, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.appointments.list(doctorId),
    queryFn: () => appointmentsService.list(doctorId),
    enabled,
  });

export const useFacilityPatients = (params: FacilityPatientsQuery, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.appointments.patients(params as Record<string, unknown>),
    queryFn: () => appointmentsService.listPatients(params),
    enabled,
  });

export const useFacilityPatientDetail = (patientId: string) =>
  useQuery({
    queryKey: QUERY_KEYS.appointments.patientDetail(patientId),
    queryFn: () => appointmentsService.getPatientDetail(patientId),
    enabled: Boolean(patientId),
  });

export const usePatientLookup = (phone: string, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.appointments.patientLookup(phone),
    queryFn: () => appointmentsService.lookupPatientByPhone(phone),
    enabled: enabled && /^\d{10}$/.test(phone.replace(/\D/g, '')),
    staleTime: 30000,
  });

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      status,
      refundPhone,
      refunded,
      refundAmount,
    }: {
      appointmentId: string;
      status: AppointmentStatus;
      refundPhone?: string;
      refunded?: boolean;
      refundAmount?: number;
    }) =>
      appointmentsService.updateStatus(appointmentId, status, {
        refundPhone,
        refunded,
        refundAmount,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
    },
  });
};

export const useMarkAppointmentArrived = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => appointmentsService.markArrived(appointmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
    },
  });
};

export const useUnmarkAppointmentArrived = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => appointmentsService.unmarkArrived(appointmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
    },
  });
};

export const useMarkAppointmentRefunded = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      refunded = true,
    }: {
      appointmentId: string;
      refunded?: boolean;
    }) => appointmentsService.markRefunded(appointmentId, refunded),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
    },
  });
};

export const useOfflineBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: OfflineBookingRequestDto) => appointmentsService.bookOffline(body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schedules.byDoctorDate(variables.doctorId, variables.date),
      });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schedules.byDoctor(variables.doctorId),
      });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.liveQueue.byDoctorDate(variables.doctorId, variables.date),
      });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.liveQueue.board(variables.date),
      });
    },
  });
};

export const useLiveQueue = (
  doctorId: string,
  date: string,
  options?: { refetchInterval?: number | false },
) =>
  useQuery({
    queryKey: QUERY_KEYS.liveQueue.byDoctorDate(doctorId, date),
    queryFn: () => doctorsService.liveQueue(doctorId, date),
    enabled: Boolean(doctorId && date),
    refetchInterval: options?.refetchInterval ?? 8000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

export const useLiveBoard = (date: string, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.liveQueue.board(date),
    queryFn: () => doctorsService.liveOverview(date),
    enabled: Boolean(date) && enabled,
    refetchInterval: 8000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

export const useLiveOpAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      doctorId,
      date,
      action,
    }: {
      doctorId: string;
      date: string;
      action: LiveOpAction;
    }) => doctorsService.liveOpAction(doctorId, date, action),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.doctors.all });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.appointments.list(variables.doctorId),
      });
    },
  });
};

export const useAdvanceLiveOp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doctorId, date }: { doctorId: string; date: string }) =>
      doctorsService.advanceLiveOp(doctorId, date),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.doctors.all });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.appointments.list(variables.doctorId),
      });
    },
  });
};
