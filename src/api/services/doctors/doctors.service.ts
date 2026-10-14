import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type {
  ApiMessageResponseDto,
  CreateDoctorRequestDto,
  CreateScheduleRequestDto,
  DoctorResponseDto,
  LiveBoardItemDto,
  LiveOpAction,
  LiveQueueResponseDto,
  ScheduleResponseDto,
  UpdateDoctorRequestDto,
} from '@/types/dto';

export const doctorsService = {
  list: async (): Promise<DoctorResponseDto[]> => {
    const { data } = await apiClient.get<DoctorResponseDto[]>(API_PATHS.DOCTORS.LIST);
    return data;
  },

  create: async (body: CreateDoctorRequestDto): Promise<DoctorResponseDto> => {
    const { data } = await apiClient.post<DoctorResponseDto>(API_PATHS.DOCTORS.CREATE, body);
    return data;
  },

  update: async (doctorId: string, body: UpdateDoctorRequestDto): Promise<DoctorResponseDto> => {
    const { data } = await apiClient.patch<DoctorResponseDto>(
      API_PATHS.DOCTORS.BY_ID(doctorId),
      body,
    );
    return data;
  },

  remove: async (doctorId: string): Promise<ApiMessageResponseDto> => {
    const { data } = await apiClient.delete<ApiMessageResponseDto>(
      API_PATHS.DOCTORS.BY_ID(doctorId),
    );
    return data;
  },

  listSchedules: async (doctorId: string): Promise<ScheduleResponseDto[]> => {
    const { data } = await apiClient.get<ScheduleResponseDto[]>(
      API_PATHS.DOCTORS.SCHEDULES(doctorId),
    );
    return data;
  },

  getSchedule: async (
    doctorId: string,
    date: string,
  ): Promise<ScheduleResponseDto | null> => {
    const { data } = await apiClient.get<ScheduleResponseDto | null>(
      API_PATHS.DOCTORS.SCHEDULE(doctorId, date),
    );
    return data;
  },

  createSchedule: async (body: CreateScheduleRequestDto): Promise<ScheduleResponseDto> => {
    const { data } = await apiClient.post<ScheduleResponseDto>(
      API_PATHS.DOCTORS.CREATE_SCHEDULE,
      body,
    );
    return data;
  },

  liveQueue: async (doctorId: string, date: string): Promise<LiveQueueResponseDto> => {
    const { data } = await apiClient.get<LiveQueueResponseDto>(
      API_PATHS.DOCTORS.LIVE_QUEUE(doctorId, date),
    );
    return data;
  },

  liveOverview: async (date: string): Promise<LiveBoardItemDto[]> => {
    const { data } = await apiClient.get<LiveBoardItemDto[]>(
      API_PATHS.DOCTORS.LIVE_OVERVIEW(date),
    );
    return data;
  },

  liveOpAction: async (
    doctorId: string,
    date: string,
    action: LiveOpAction,
  ): Promise<DoctorResponseDto> => {
    const { data } = await apiClient.patch<DoctorResponseDto>(API_PATHS.DOCTORS.LIVE_OP(doctorId), {
      date,
      action,
    });
    return data;
  },

  setScheduleClosed: async (
    doctorId: string,
    date: string,
    isClosed: boolean,
  ): Promise<ScheduleResponseDto> => {
    const { data } = await apiClient.patch<ScheduleResponseDto>(
      API_PATHS.DOCTORS.SCHEDULE(doctorId, date),
      { isClosed },
    );
    return data;
  },

  advanceLiveOp: async (doctorId: string, date: string): Promise<DoctorResponseDto> => {
    const { data } = await apiClient.patch<DoctorResponseDto>(API_PATHS.DOCTORS.LIVE_OP(doctorId), {
      date,
      action: 'next',
    });
    return data;
  },

  setLiveOp: async (
    doctorId: string,
    date: string,
    currentNumber: number,
  ): Promise<DoctorResponseDto> => {
    const { data } = await apiClient.patch<DoctorResponseDto>(API_PATHS.DOCTORS.LIVE_OP(doctorId), {
      date,
      currentNumber,
    });
    return data;
  },

  movePendingOps: async (
    fromDoctorId: string,
    body: {
      date: string;
      toDoctorId: string;
      fromOp: number;
      toOp: number;
      closeSource?: boolean;
    },
  ) => {
    const { data } = await apiClient.post<{
      movedCount: number;
      fromDoctorId: string;
      toDoctorId: string;
      date: string;
      fromOp: number;
      toOp: number;
      moved: Array<{ appointmentId: string; fromToken: string; toToken: string }>;
      scheduleClosed: boolean;
    }>(API_PATHS.DOCTORS.MOVE_OPS(fromDoctorId), body);
    return data;
  },
};
