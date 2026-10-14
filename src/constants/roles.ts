export const USER_ROLES = {
  PATIENT: 'PATIENT',
  ADMIN: 'ADMIN',
} as const;

export type UserRoleValue = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const FACILITY_TYPES = {
  HOSPITAL: 'HOSPITAL',
  CLINIC: 'CLINIC',
  LAB: 'LAB',
} as const;

export type FacilityTypeValue = (typeof FACILITY_TYPES)[keyof typeof FACILITY_TYPES];

export const FACILITY_TYPE_OPTIONS = [
  {
    value: FACILITY_TYPES.HOSPITAL,
    label: 'Hospital',
    description: 'Multi-department hospital or medical centre',
  },
  {
    value: FACILITY_TYPES.CLINIC,
    label: 'Clinic',
    description: 'Clinic or outpatient care centre',
  },
  {
    value: FACILITY_TYPES.LAB,
    label: 'Lab',
    description: 'Diagnostic lab or pathology centre',
  },
] as const;
