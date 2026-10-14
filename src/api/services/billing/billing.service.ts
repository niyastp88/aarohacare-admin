import { apiClient } from '@/api/client';

export type DoctorWalletSummary = {
  _id: string;
  name: string;
  specialization: string;
  profileImage?: string;
  consultationFee: number;
  bankAccountDetails?: {
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    accountHolderName?: string;
    upiId?: string;
  };
  totalEarned: number;
  totalPaid: number;
  totalRefunds: number;
  pendingBalance: number;
  lastPayoutAt?: string;
  txCount: number;
  unrefundedCancellationsCount?: number;
  pendingPatientRefundAmount?: number;
};

export type DoctorTransaction = {
  _id: string;
  doctorId: string;
  amount: number;
  type: string;
  status: string;
  notes?: string;
  description?: string;
  createdAt: string;
};

export type DoctorTransactionsResponse = {
  doctor?: {
    _id: string;
    name: string;
    specialization: string;
  };
  summary: {
    totalPaid: number;
    pendingPayout: number;
  };
  transactions: DoctorTransaction[];
};

export type DoctorOrder = {
  _id: string;
  tokenNumber?: string;
  date: string;
  time: string;
  status: string;
  paymentStatus: string;
  consultationFee: number;
  consultationFeeAtBooking?: number;
  platformFee: number;
  patient?: {
    _id: string;
    name: string;
    phone: string;
    email?: string;
    profileImage?: string;
    age?: number;
    gender?: string;
  };
  cancellation?: {
    requestedAt?: string;
    cancelledBy?: string;
    refundPhone?: string;
    refundUpiId?: string;
    refundAmount?: number;
    refunded?: boolean;
    reason?: string;
  };
  arrivedAt?: string;
  cancellationReason?: string;
  isPendingRefund: boolean;
  createdAt: string;
};

export type DoctorOrdersSummary = {
  doctor: { _id: string; name: string; specialization: string };
  summary: {
    totalOrders: number;
    successOrdersCount: number;
    completedOrdersCount?: number;
    cancelledOrdersCount: number;
    unrefundedCancellationsCount: number;
    pendingPatientRefundAmount: number;
    totalRevenue?: number;
    successRevenue?: number;
    totalPlatformFee?: number;
  };
  orders: DoctorOrder[];
};

export type CancelledOrderDto = {
  _id: string;
  tokenNumber?: string;
  date: string;
  time: string;
  status: string;
  paymentStatus: string;
  consultationFee: number;
  platformFee: number;
  doctor?: { _id: string; name: string; specialization: string };
  patient?: { _id: string; name: string; phone: string; email?: string; healthCardId?: string; age?: number; gender?: string };
  cancellation?: {
    requestedAt?: string;
    cancelledBy?: string;
    refundPhone?: string;
    refundUpiId?: string;
    refundPolicy?: string;
    refundAmount?: number;
    refunded?: boolean;
    reason?: string;
  };
  arrivedAt?: string;
  cancellationReason?: string;
  isPendingRefund: boolean;
  createdAt: string;
};

export type FacilityCancelledOrdersResponse = {
  summary: {
    totalCancelledCount: number;
    pendingRefundCount: number;
    pendingRefundAmount: number;
    totalRefundedCount: number;
    totalRefundedAmount: number;
  };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: CancelledOrderDto[];
};

export type OfflineFeeRateGroup = {
  feePerAppt: number;
  count: number;
  totalFee: number;
};

export type AdminBillingSummary = {
  summary: {
    totalFeesAccrued: number;
    totalFeesPaid: number;
    totalPendingClaims?: number;
    totalRefundCredits: number;
    outstandingDues: number;
    displayDues?: number;
    surplusCredit?: number;
    status?: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'NO_DUES';
    offlineFeeBreakdown?: OfflineFeeRateGroup[];
  };
  bookingStats: {
    total: number;
    online: number;
    offline: number;
    cancelled: number;
  };
  transactions: {
    _id: string;
    adminId: string;
    appointmentId?: {
      _id: string;
      tokenNumber?: string;
      date?: string;
      consultationFee?: number;
      platformFee?: number;
    };
    amount: number;
    type: 'DEBIT_PLATFORM_FEE' | 'CREDIT_PAYMENT_TO_SUPERADMIN' | 'CREDIT_REFUND';
    approvalStatus?: 'CONFIRMED' | 'PENDING_APPROVAL' | 'REJECTED';
    paymentMethod?: string;
    referenceNumber?: string;
    notes?: string;
    rejectionReason?: string;
    description: string;
    createdAt: string;
  }[];
  labReportStats?: {
    total: number;
  };
  facilityType?: string;
};

export type AdminDuesMonthlyCard = {
  monthKey: string;
  monthLabel: string;
  monthName: string;
  count: number;
  amount: number;
  appointmentFee?: number;
  correctionFee?: number;
  paidAmount: number;
  pendingClaims?: number;
  remainingAmount: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'NO_DUES';
  feePerItem: number;
  feeBreakdown?: OfflineFeeRateGroup[];
  calculationText?: string;
};

export type AdminDuesMonthlySummaryResponse = {
  year: number;
  isLab: boolean;
  facilityType: string;
  configuredPlatformFee: number;
  months: AdminDuesMonthlyCard[];
};

export type LabReportDetailItem = {
  _id: string;
  date: string;
  fullDate: string;
  time: string;
  patientName: string;
  patientPhone: string;
  title: string;
  fee: number;
  createdAt?: string;
};

export type LabDateWiseItem = {
  date: string;
  count: number;
  fee: number;
};

// Extend AdminDuesBreakdown to include facility name, total reports, date-wise breakdown, and report list for Lab Admin monthly billing detail pages.
export type AdminDuesBreakdown = {
  monthKey: string;
  facilityName?: string;
  totalBookings: number;
  totalReports?: number;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  onlineTotal: number;
  offlineTotal: number;
  cancelledTotal: number;
  configuredPlatformFee: number;
  isLab?: boolean;
  facilityType?: string;
  doctors: {
    doctorId: string;
    doctorName: string;
    specialization?: string;
    profileImage?: string;
    bookingCount: number;
    onlineCount: number;
    offlineCount: number;
    cancelledCount: number;
    amount: number;
  }[];
  dateWise?: LabDateWiseItem[];
  reports?: LabReportDetailItem[];
};

export type AdminDuesDoctorOrder = {
  _id: string;
  date: string;
  time: string;
  status: string;
  type: 'Online' | 'Offline';
  serviceFee: number;
  patient: {
    _id: string;
    name: string;
    phone: string;
  } | null;
  cancellation?: {
    refundAmount?: number;
    refunded?: boolean;
    requestedAt?: string;
  };
};

export type AdminDuesDoctorOrdersResponse = {
  doctor: {
    _id: string;
    name: string;
  };
  configuredPlatformFee: number;
  orders: AdminDuesDoctorOrder[];
};

export type FacilityMonthlyBookingsResponse = {
  configuredPlatformFee: number;
  summary: {
    totalBookings: number;
    onlineCount: number;
    offlineCount: number;
    totalPayment: number;
    paymentStatus: string;
  };
  filters: {
    doctors: { _id: string; name: string }[];
    patients: { _id: string; name: string }[];
  };
  orders: (AdminDuesDoctorOrder & { doctor?: { _id: string; name: string; specialization: string } })[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const billingService = {
  getDoctorWallets: async (params?: { fromDate?: string; toDate?: string }): Promise<DoctorWalletSummary[]> => {
    const { data } = await apiClient.get<DoctorWalletSummary[]>('/billing/doctor-wallets', { params });
    return data;
  },

  getDoctorTransactions: async (
    doctorId: string,
    params?: { fromDate?: string; toDate?: string },
  ): Promise<DoctorTransactionsResponse> => {
    const { data } = await apiClient.get<DoctorTransactionsResponse>(
      `/billing/doctor-wallets/${doctorId}/transactions`,
      { params },
    );
    return data;
  },

  settleDoctorPayout: async (doctorId: string, amount: number, notes?: string): Promise<DoctorTransaction> => {
    const { data } = await apiClient.post<DoctorTransaction>(`/billing/doctor-wallets/${doctorId}/settle`, {
      amount,
      notes,
    });
    return data;
  },

  getDoctorOrders: async (
    doctorId: string,
    status?: string,
    params?: { fromDate?: string; toDate?: string },
  ): Promise<DoctorOrdersSummary> => {
    const { data } = await apiClient.get<DoctorOrdersSummary>(`/billing/doctor-wallets/${doctorId}/orders`, {
      params: { status, ...params },
    });
    return data;
  },

  getFacilityCancelledOrders: async (params?: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    monthKey?: string;
    refundStatus?: 'ALL' | 'PENDING_REFUND' | 'REFUNDED';
    doctorId?: string;
    type?: 'ALL' | 'Online' | 'Offline';
    page?: number;
    limit?: number;
  }): Promise<FacilityCancelledOrdersResponse> => {
    const { data } = await apiClient.get<FacilityCancelledOrdersResponse>('/billing/cancelled-orders', {
      params,
    });
    return data;
  },

  markPatientRefunded: async (appointmentId: string): Promise<unknown> => {
    const { data } = await apiClient.post(`/billing/doctor-wallets/appointments/${appointmentId}/refund-patient`);
    return data;
  },

  undoPatientRefund: async (appointmentId: string): Promise<unknown> => {
    const { data } = await apiClient.post(`/billing/doctor-wallets/appointments/${appointmentId}/undo-refund-patient`);
    return data;
  },

  getAdminBillingDues: async (): Promise<AdminBillingSummary> => {
    const { data } = await apiClient.get<AdminBillingSummary>('/billing/admin-dues');
    return data;
  },

  // Fetch monthly billing summary cards for Record Summary (supporting both Lab Admin and Clinic Admin)
  getAdminDuesMonthlySummary: async (year?: number): Promise<AdminDuesMonthlySummaryResponse> => {
    const { data } = await apiClient.get<AdminDuesMonthlySummaryResponse>('/billing/admin-dues/monthly-summary', {
      params: { year },
    });
    return data;
  },

  // Fetch the backend-calculated doctor-wise billing data so the page displays the actual ledger values instead of calculating payment amounts on the frontend.
  getAdminDuesBreakdownByDoctor: async (monthKey: string): Promise<AdminDuesBreakdown> => {
    const { data } = await apiClient.get<AdminDuesBreakdown>('/billing/admin-dues/breakdown', {
      params: { monthKey },
    });
    return data;
  },

  getAdminDuesDoctorOrders: async (doctorId: string, monthKey: string): Promise<AdminDuesDoctorOrdersResponse> => {
    const { data } = await apiClient.get<AdminDuesDoctorOrdersResponse>(`/billing/admin-dues/breakdown/${doctorId}`, {
      params: { monthKey },
    });
    return data;
  },

  getFacilityMonthlyBookings: async (params: { monthKey: string; doctorId?: string; patientId?: string; type?: string; page?: number; limit?: number; }): Promise<FacilityMonthlyBookingsResponse> => {
    const { data } = await apiClient.get<FacilityMonthlyBookingsResponse>('/billing/admin-dues/bookings', { params });
    return data;
  },

  createPlatformDuesOrder: async (
    amount?: number,
    monthKey?: string,
    returnUrl?: string,
  ): Promise<{
    gateway?: 'CASHFREE' | 'RAZORPAY';
    orderId?: string;
    razorpayOrderId?: string;
    razorpayKeyId?: string;
    cashfreeOrderId?: string;
    paymentSessionId?: string;
    cashfreeEnv?: string;
    amount: number;
    amountPaise: number;
    currency: string;
    monthKey?: string;
  }> => {
    const { data } = await apiClient.post(
      '/billing/admin-dues/create-order',
      { amount, monthKey, returnUrl },
    );
    return data;
  },

  getAdminBillingOrderDetails: async (
    orderId: string,
  ): Promise<{
    orderId: string;
    amount: number;
    monthKey: string;
    monthLabel: string;
    status: string;
    failureReason: string;
    returnUrl: string;
  }> => {
    const { data } = await apiClient.get(`/billing/admin-dues/orders/${orderId}`);
    return data;
  },

  cancelPlatformDuesOrder: async (
    orderId: string,
    reason?: string,
  ): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post(`/billing/admin-dues/orders/${orderId}/cancel`, { reason });
    return data;
  },

  verifyPlatformDuesPayment: async (
    orderId: string,
    gatewayDetails?: { razorpayPaymentId?: string; razorpaySignature?: string; cashfreePaymentId?: string },
    monthKey?: string,
  ): Promise<{ success: boolean; amountPaid: number }> => {
    const { data } = await apiClient.post<{ success: boolean; amountPaid: number }>(
      '/billing/admin-dues/verify-payment',
      { orderId, ...gatewayDetails, monthKey },
    );
    return data;
  },

  recordDirectDuesPayment: async (
    amount: number,
    paymentMethod: string = 'UPI',
    referenceNumber?: string,
    notes?: string,
    monthKey?: string,
  ): Promise<{ success: boolean; amountPaid: number }> => {
    const { data } = await apiClient.post<{ success: boolean; amountPaid: number }>(
      '/billing/admin-dues/direct-payment',
      { amount, paymentMethod, referenceNumber, notes, monthKey },
    );
    return data;
  },
};
