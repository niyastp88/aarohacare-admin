/** Frontend route paths used by React Router. */
export const APP_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ADMIN: {
    ROOT: '/admin',
    DOCTORS: '/admin/doctors',
    DOCTORS_NEW: '/admin/doctors/new',
    DOCTOR_DETAIL: (doctorId: string) => `/admin/doctors/${doctorId}`,
    DOCTOR_EDIT: (doctorId: string) => `/admin/doctors/${doctorId}/edit`,
    SCHEDULES: '/admin/schedules',
    APPOINTMENTS: '/admin/appointments',
    PATIENTS: '/admin/patients',
    PATIENT_DIRECTORY: '/admin/patients/directory',
    PATIENT_CANCELLED: '/admin/patients/cancelled',
    PATIENT_DETAIL: (patientId: string) => `/admin/patients/${patientId}`,
    USERS: '/admin/users',
    USER_DETAIL: (patientId: string) => `/admin/users/${patientId}`,
    REPORTS: '/admin/reports',
    OP_CONTROL: '/admin/op-control',
    OFFLINE_BOOKING: '/admin/offline-booking',
    SETTINGS: '/admin/settings',
    PAY: '/admin/pay',
    PAY_SUCCESS: '/admin/pay/success',
    PAY_HISTORY: '/admin/pay/history',
    PAY_SUMMARY: '/admin/pay/summary',
    PAY_RETRY: (orderId: string) => `/admin/pay/retry/${orderId}`,
    TOTAL_BOOKINGS: (monthKey: string) => `/admin/pay/summary/${monthKey}/total-bookings`,
    MONTH_CANCELLED: (monthKey: string) => `/admin/pay/summary/${monthKey}/cancelled`,
    DOCTOR_WALLETS: '/admin/billing/doctor-wallets',
    DOCTOR_WALLET_DETAIL: (doctorId: string) => `/admin/billing/doctor-wallets/${doctorId}`,
    PLATFORM_DUES: '/admin/billing/platform-dues',
    CHAT: '/admin/chat',
    NOTIFICATIONS: '/admin/notifications',
  },
} as const;

/** Primary sidebar nav — clinic / hospital. */
export const ADMIN_PRIMARY_NAV = [
  {
    to: APP_ROUTES.ADMIN.ROOT,
    label: 'Home',
    end: true,
    icon: 'home',
  },
  {
    to: APP_ROUTES.ADMIN.OP_CONTROL,
    label: 'Queue Management',
    end: false,
    icon: 'queue',
  },
  {
    to: APP_ROUTES.ADMIN.DOCTORS,
    label: 'Manage Doctors',
    end: false,
    icon: 'doctors',
  },
  {
    to: APP_ROUTES.ADMIN.DOCTOR_WALLETS,
    label: 'Doctor Wallets',
    end: false,
    icon: 'wallet',
  },
  {
    to: APP_ROUTES.ADMIN.PATIENTS,
    label: 'Search Patients',
    end: false,
    icon: 'patients',
  },
] as const;

/** Lab facility sidebar — dashboard, reports, users only. */
export const LAB_PRIMARY_NAV = [
  {
    to: APP_ROUTES.ADMIN.ROOT,
    label: 'Dashboard',
    end: true,
    icon: 'home',
  },
  {
    to: APP_ROUTES.ADMIN.REPORTS,
    label: 'Reports',
    end: false,
    icon: 'reports',
  },
  {
    to: APP_ROUTES.ADMIN.USERS,
    label: 'User Management',
    end: false,
    icon: 'patients',
  },
] as const;

/** @deprecated Prefer ADMIN_PRIMARY_NAV — kept for any lingering imports. */
export const ADMIN_NAV_ITEMS = ADMIN_PRIMARY_NAV;
