import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorsService } from '@/api/services/doctors';
import { QUERY_KEYS } from '@/constants/queryKeys';
import type {
  CreateDoctorRequestDto,
  CreateScheduleRequestDto,
  UpdateDoctorRequestDto,
} from '@/types/dto';

export const useDoctors = (enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.doctors.list(),
    queryFn: doctorsService.list,
    enabled,
  });

export const useAddDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDoctorRequestDto) => doctorsService.create(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.doctors.all });
    },
  });
};

export const useUpdateDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      doctorId,
      body,
    }: {
      doctorId: string;
      body: UpdateDoctorRequestDto;
    }) => doctorsService.update(doctorId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.doctors.all });
    },
  });
};

export const useRemoveDoctor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doctorId: string) => doctorsService.remove(doctorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.doctors.all });
    },
  });
};

export const useDoctorSchedules = (doctorId: string) =>
  useQuery({
    queryKey: QUERY_KEYS.schedules.byDoctor(doctorId),
    queryFn: () => doctorsService.listSchedules(doctorId),
    enabled: Boolean(doctorId),
  });

export const useDoctorSchedule = (doctorId: string, date: string) =>
  useQuery({
    queryKey: QUERY_KEYS.schedules.byDoctorDate(doctorId, date),
    queryFn: () => doctorsService.getSchedule(doctorId, date),
    enabled: Boolean(doctorId && date),
  });

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateScheduleRequestDto) => doctorsService.createSchedule(body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schedules.byDoctor(variables.doctorId),
      });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schedules.byDoctorDate(variables.doctorId, variables.date),
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules.all });
    },
  });
};

export const useSetScheduleClosed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      doctorId,
      date,
      isClosed,
    }: {
      doctorId: string;
      date: string;
      isClosed: boolean;
    }) => doctorsService.setScheduleClosed(doctorId, date, isClosed),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schedules.byDoctor(variables.doctorId),
      });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.schedules.byDoctorDate(variables.doctorId, variables.date),
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
    },
  });
};

export const useMovePendingOps = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromDoctorId,
      date,
      toDoctorId,
      fromOp,
      toOp,
      closeSource,
    }: {
      fromDoctorId: string;
      date: string;
      toDoctorId: string;
      fromOp: number;
      toOp: number;
      closeSource?: boolean;
    }) =>
      doctorsService.movePendingOps(fromDoctorId, {
        date,
        toDoctorId,
        fromOp,
        toOp,
        closeSource,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.liveQueue.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments.all });
    },
  });
};
