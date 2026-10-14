export type LabReportPatientDto = {
  _id?: string;
  name?: string;
  phone?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  profileImage?: string;
  address?: string;
  place?: string;
};

export type LabReportDto = {
  _id: string;
  title: string;
  notes?: string;
  facilityId?: { _id?: string; name?: string; facilityType?: string } | string;
  patientId?: LabReportPatientDto | string;
  createdAt?: string;
  reportUrl?: string;
  fileUrl?: string;
};

export type LabReportStatsDto = {
  totalReports: number;
  newReports: number;
  pendingReports: number;
  allUsers: number;
  monthly: Array<{ year: number; month: number; count: number }>;
};

export type LabReportPatientRowDto = {
  _id: string;
  name?: string;
  phone?: string;
  place?: string;
  age?: number;
  gender?: string;
  profileImage?: string;
  address?: string;
  healthCardId?: string;
  reportCount: number;
  lastReportAt?: string;
  lastTitle?: string;
};

export type LabReportPatientsPageDto = {
  items: LabReportPatientRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
