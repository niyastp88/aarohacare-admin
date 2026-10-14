import { apiClient } from '@/api/client';
import { API_PATHS } from '@/constants/paths';
import type {
  LabReportDto,
  LabReportPatientRowDto,
  LabReportPatientsPageDto,
  LabReportStatsDto,
} from '@/types/dto';

export const labReportsService = {
  list: async (params?: {
    patientId?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
  }) => {
    const { data } = await apiClient.get<LabReportDto[]>(API_PATHS.LAB_REPORTS.LIST, { params });
    return data;
  },

  stats: async () => {
    const { data } = await apiClient.get<LabReportStatsDto>(API_PATHS.LAB_REPORTS.STATS);
    return data;
  },

  listPatients: async (params?: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const { data } = await apiClient.get<LabReportPatientsPageDto>(API_PATHS.LAB_REPORTS.PATIENTS, {
      params,
    });
    return data;
  },

    searchPatients: async (query: string) => {
    const { data } = await apiClient.get<LabReportPatientRowDto[]>(
      API_PATHS.LAB_REPORTS.LOOKUP_PATIENT,
      { params: { query } },
    );
    return data;
  },
  lookupPatientByPhone: async (phone: string) => {
    const { data } = await apiClient.post<LabReportPatientRowDto>(
      API_PATHS.LAB_REPORTS.LOOKUP_PATIENT,
      { phone },
    );
    return data;
  },

  getPatient: async (patientId: string) => {
    const { data } = await apiClient.get<LabReportPatientRowDto>(
      API_PATHS.LAB_REPORTS.PATIENT(patientId),
    );
    return data;
  },

  create: async (payload: {
    patientId?: string;
    phone?: string;
    title: string;
    reportUrl?: string;
    notes?: string;
  }) => {
    const { data } = await apiClient.post<LabReportDto>(API_PATHS.LAB_REPORTS.CREATE, payload);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(API_PATHS.LAB_REPORTS.DELETE(id));
    return data;
  },
};
