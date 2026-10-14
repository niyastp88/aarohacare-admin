/** TanStack Query keys — keep in one place so invalidation stays consistent. */
export const QUERY_KEYS = {
  doctors: {
    all: ['doctors'] as const,
    list: () => [...QUERY_KEYS.doctors.all, 'list'] as const,
  },
  schedules: {
    all: ['schedules'] as const,
    byDoctor: (doctorId: string) => [...QUERY_KEYS.schedules.all, doctorId] as const,
    byDoctorDate: (doctorId: string, date: string) =>
      [...QUERY_KEYS.schedules.all, doctorId, date] as const,
  },
  appointments: {
    all: ['appointments'] as const,
    list: (doctorId?: string) =>
      [...QUERY_KEYS.appointments.all, 'list', doctorId ?? 'all'] as const,
    patients: (filters?: Record<string, unknown>) =>
      [...QUERY_KEYS.appointments.all, 'patients', filters ?? {}] as const,
    patientDetail: (patientId: string) =>
      [...QUERY_KEYS.appointments.all, 'patient', patientId] as const,
    patientLookup: (phone: string) =>
      [...QUERY_KEYS.appointments.all, 'patientLookup', phone] as const,
  },
  liveQueue: {
    all: ['liveQueue'] as const,
    byDoctorDate: (doctorId: string, date: string) =>
      [...QUERY_KEYS.liveQueue.all, doctorId, date] as const,
    board: (date: string) => [...QUERY_KEYS.liveQueue.all, 'board', date] as const,
  },
  facility: {
    all: ['facility'] as const,
    mine: () => [...QUERY_KEYS.facility.all, 'mine'] as const,
  },
  labReports: {
    all: ['labReports'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...QUERY_KEYS.labReports.all, 'list', filters ?? {}] as const,
    stats: () => [...QUERY_KEYS.labReports.all, 'stats'] as const,
    patients: (filters?: Record<string, unknown>) =>
      [...QUERY_KEYS.labReports.all, 'patients', filters ?? {}] as const,
  },
} as const;
