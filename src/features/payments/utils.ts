import type { PaymentStatus } from './data';

export const statusLabel = (status: PaymentStatus) => {
  if (status === 'PAID') return 'Paid';
  if (status === 'FAILED') return 'Payment Failed';
  return 'Payment Pending';
};

export const statusBadgeClass = (status: PaymentStatus) => {
  if (status === 'PAID') return 'bg-[#DCFCE7] text-[#15803D]';
  if (status === 'FAILED') return 'bg-[#FEE2E2] text-[#DC2626]';
  return 'bg-[#FEE2E2] text-[#DC2626]';
};
