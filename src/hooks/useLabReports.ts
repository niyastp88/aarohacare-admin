export const useSearchLabPatients = (query: string, enabled = true) =>
  useQuery({
    queryKey: [...QUERY_KEYS.labReports.all, 'search-patients', query] as const,
    queryFn: () => labReportsService.searchPatients(query),
    enabled: enabled && Boolean(query && query.trim().length >= 1),
    staleTime: 5000,
  });

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { labReportsService } from '@/api/services/labReports';
import { QUERY_KEYS } from '@/constants/queryKeys';

export const useLabReportStats = (enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.labReports.stats(),
    queryFn: () => labReportsService.stats(),
    enabled,
  });

export const useLabReports = (
  params?: { patientId?: string; fromDate?: string; toDate?: string; search?: string },
  enabled = true,
) =>
  useQuery({
    queryKey: QUERY_KEYS.labReports.list(params as Record<string, unknown>),
    queryFn: () => labReportsService.list(params),
    enabled,
  });

export const useLabReportPatients = (
  params: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  },
  enabled = true,
) =>
  useQuery({
    queryKey: QUERY_KEYS.labReports.patients(params as Record<string, unknown>),
    queryFn: () => labReportsService.listPatients(params),
    enabled,
  });

export const useLabPatient = (patientId: string, enabled = true) =>
  useQuery({
    queryKey: [...QUERY_KEYS.labReports.all, 'patient', patientId] as const,
    queryFn: () => labReportsService.getPatient(patientId),
    enabled: enabled && Boolean(patientId),
  });

export const useLookupLabPatientByPhone = () =>
  useMutation({
    mutationFn: (phone: string) => labReportsService.lookupPatientByPhone(phone),
  });

export const useCreateLabReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: labReportsService.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.labReports.all });
    },
  });
};

export const useDeleteLabReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => labReportsService.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.labReports.all });
    },
  });
};
