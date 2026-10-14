/**
 * App types — request/response DTOs mirrored from the backend API.
 * Prefer importing from `@/types` or `@/types/dto`.
 */
export type {
  ApiErrorResponseDto,
  ApiMessageResponseDto,
  AppointmentResponseDto,
  AppointmentStatus,
  AuthResponseDto,
  CreateScheduleRequestDto,
  DoctorResponseDto,
  FacilityType,
  LocationDto,
  LoginRequestDto,
  MeResponseDto,
  RefreshRequestDto,
  RefreshResponseDto,
  RegisterAdminRequestDto,
  ScheduleResponseDto,
  ScheduleSlotDto,
  UpdateAppointmentStatusRequestDto,
  UserResponseDto,
  UserRole,
} from './dto';

/** Convenient aliases used in UI / auth state. */
export type { UserResponseDto as User } from './dto';
export type { DoctorResponseDto as Doctor } from './dto';
export type { LocationDto as GeoLocation } from './dto';
export type { ApiErrorResponseDto as ApiError } from './dto';
