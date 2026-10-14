export interface BankAccountDetailsDto {
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  accountHolderName?: string;
  upiId?: string;
  razorpayId?: string;
}

import type { FacilityApprovalStatus, FacilityType } from './auth.dto';
import type { LocationDto } from './common.dto';

export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WorkingHoursDto {
  from: string;
  to: string;
  is24Hours?: boolean;
}

export type CancellationTimeUnit = 'minutes' | 'hours' | 'days';
export type RefundProcessingUnit = 'working_days' | 'days' | 'hours';

export interface CancellationPolicyItemDto {
  _id?: string;
  icon: string;
  text: {
    en: string;
    ml: string;
  };
}

export interface CancellationPolicyDto {
  fullRefundWindow: {
    value: number;
    unit: CancellationTimeUnit;
  };
  afterPeriodRefundPercent: number;
  refundProcessingPeriod: {
    value: number;
    unit: RefundProcessingUnit;
  };
  additionalItems?: CancellationPolicyItemDto[];
}

export interface FacilityResponseDto {
  _id: string;
  name: string;
  facilityType: FacilityType;
  ownerId: string;
  phone: string;
  email?: string;
  place?: string;
  address?: string;
  location?: LocationDto;
  image?: string;
  workingHours?: WorkingHoursDto;
  openDays?: WeekDay[];
  globalAlert?: string;
  razorpayAccountId?: string;
  razorpayLinked?: boolean;
  bankAccountDetails?: BankAccountDetailsDto;
  isActive: boolean;
  approvalStatus?: FacilityApprovalStatus;
  cancellationPolicy?: CancellationPolicyDto;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateFacilityRequestDto {
  razorpayAccountId?: string;
  bankAccountDetails?: BankAccountDetailsDto;
  name?: string;
  place?: string;
  address?: string;
  location?: LocationDto;
  image?: string;
  phone?: string;
  email?: string;
  workingHours?: WorkingHoursDto;
  openDays?: WeekDay[];
  globalAlert?: string;
  cancellationPolicy?: CancellationPolicyDto;
}
