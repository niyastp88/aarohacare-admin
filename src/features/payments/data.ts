export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'FAILED' | 'NO_DUES';

export type PaymentRecord = {
  id: string;
  monthLabel: string;
  monthKey: string; // YYYY-MM
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  bookingCount: number;
  feePerBooking: number;
  paidAmount?: number;
  remainingAmount?: number;
  paidAt?: string;
  isCurrentMonth?: boolean;
};

export const CONVENIENCE_FEE = 3;

/** Demo billing data until facility settlement API ships. */
export const CURRENT_DUE: PaymentRecord = {
  id: 'TXN-2026-08',
  monthLabel: 'August 2026',
  monthKey: '2026-08',
  dueDate: '2026-08-31',
  amount: 129,
  status: 'PENDING',
  bookingCount: 43,
  feePerBooking: CONVENIENCE_FEE,
  isCurrentMonth: true,
};

export const PAYMENT_RECORDS: PaymentRecord[] = [
  CURRENT_DUE,
  {
    id: 'TXN-2026-07',
    monthLabel: 'July 2026',
    monthKey: '2026-07',
    dueDate: '2026-07-31',
    amount: 240,
    status: 'PAID',
    bookingCount: 80,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2026-07-28',
  },
  {
    id: 'TXN-2026-06',
    monthLabel: 'June 2026',
    monthKey: '2026-06',
    dueDate: '2026-06-30',
    amount: 850,
    status: 'PAID',
    bookingCount: 283,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2026-06-15',
  },
  {
    id: 'TXN-2026-05',
    monthLabel: 'May 2026',
    monthKey: '2026-05',
    dueDate: '2026-05-31',
    amount: 420,
    status: 'PAID',
    bookingCount: 140,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2026-05-29',
  },
  {
    id: 'TXN-2026-04',
    monthLabel: 'April 2026',
    monthKey: '2026-04',
    dueDate: '2026-04-30',
    amount: 315,
    status: 'FAILED',
    bookingCount: 105,
    feePerBooking: CONVENIENCE_FEE,
  },
  {
    id: 'TXN-2026-03',
    monthLabel: 'March 2026',
    monthKey: '2026-03',
    dueDate: '2026-03-31',
    amount: 198,
    status: 'PAID',
    bookingCount: 66,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2026-03-30',
  },
  {
    id: 'TXN-2026-02',
    monthLabel: 'February 2026',
    monthKey: '2026-02',
    dueDate: '2026-02-28',
    amount: 156,
    status: 'PAID',
    bookingCount: 52,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2026-02-27',
  },
  {
    id: 'TXN-2026-01',
    monthLabel: 'January 2026',
    monthKey: '2026-01',
    dueDate: '2026-01-31',
    amount: 270,
    status: 'PAID',
    bookingCount: 90,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2026-01-30',
  },
  {
    id: 'TXN-2025-12',
    monthLabel: 'December 2025',
    monthKey: '2025-12',
    dueDate: '2025-12-31',
    amount: 360,
    status: 'PAID',
    bookingCount: 120,
    feePerBooking: CONVENIENCE_FEE,
    paidAt: '2025-12-28',
  },
  {
    id: 'TXN-2025-11',
    monthLabel: 'November 2025',
    monthKey: '2025-11',
    dueDate: '2025-11-30',
    amount: 225,
    status: 'PENDING',
    bookingCount: 75,
    feePerBooking: CONVENIENCE_FEE,
  },
];

export const formatMoney = (amount: number) =>
  `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDueDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
