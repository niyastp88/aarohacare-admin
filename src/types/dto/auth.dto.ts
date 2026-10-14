import type { LocationDto } from './common.dto';

export type UserRole = 'PATIENT' | 'ADMIN';
export type FacilityType = 'HOSPITAL' | 'CLINIC' | 'LAB';
export type FacilityApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface FacilityAccessDto {
  _id: string;
  name: string;
  facilityType: FacilityType;
  approvalStatus: FacilityApprovalStatus;
  isActive: boolean;
  image?: string;
}

/** Public user returned by the API (no password). */
export interface UserResponseDto {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  place?: string;
  facilityType?: FacilityType;
  location?: LocationDto;
  bankAccountDetails?: BankAccountDetailsDto;
  razorpayAccountId?: string;
  address?: string;
  age?: number;
  bloodGroup?: string;
  profileImage?: string;
  gender?: string;
  healthCardId?: string;
  createdAt?: string;
  updatedAt?: string;
  facility?: FacilityAccessDto;
}

export interface LoginRequestDto {
  phone?: string;
  email?: string;
  password: string;
}

/** Admin register — place + map location selected via Google Places / Maps. */
export interface BankAccountDetailsDto {
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  accountHolderName?: string;
  upiId?: string;
  razorpayId?: string;
}

export interface RegisterAdminRequestDto {
  name: string;
  phone: string;
  email: string;
  password: string;
  role: 'ADMIN';
  facilityType: FacilityType;
  place?: string;
  location?: LocationDto;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  password: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResponseDto {
  /** Mobile only (`X-Client: mobile`). Web uses httpOnly cookies. */
  token?: string;
  refreshToken?: string;
  user: UserResponseDto;
  csrfToken?: string;
}

export interface RefreshRequestDto {
  refreshToken?: string;
}

export interface RefreshResponseDto {
  token?: string;
  ok?: boolean;
  csrfToken?: string;
}

export interface MeResponseDto {
  user: UserResponseDto;
  csrfToken?: string;
}

export interface CsrfResponseDto {
  csrfToken: string;
}
