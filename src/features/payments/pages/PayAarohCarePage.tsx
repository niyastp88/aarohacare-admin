import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';

import { initialsOf } from '@/features/patients/utils';
import {
  billingService,
  type AdminBillingSummary,
} from '@/api/services/billing/billing.service';
import { apiClient } from '@/api/client';

const loadRazorpaySdk = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const PayAarohCarePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLab = useIsLabFacility();
  const location = useLocation();
  const isSummaryPage = location.pathname.includes('/summary');
  const [billingData, setBillingData] = useState<AdminBillingSummary | null>(null);

  // Track dynamic platform fee
  const [currentPlatformFee, setCurrentPlatformFee] = useState(0);

  // Direct Transfer State
  const [directAmount, setDirectAmount] = useState('');
  const [directNotes, setDirectNotes] = useState('');
  const [recordingDirect, setRecordingDirect] = useState(false);

  // Fetch the configured platform fee from the backend dynamically
  const loadBillingDues = async () => {
    try {
      const res = await billingService.getAdminBillingDues();
      setBillingData(res);

      const feeRes = await apiClient.get<{ platformServiceFee: number }>(
        `/appointments/platform-fee${user?.facility?._id ? `?facilityId=${user.facility._id}` : ''}`
      );
      setCurrentPlatformFee(feeRes.data.platformServiceFee);
    } catch {
      showToast('Failed to load platform billing dues', 'error');
    }
  };

  useEffect(() => {
    void loadBillingDues();
    void loadRazorpaySdk();
  }, []);

  const summary = billingData?.summary || {
    totalFeesAccrued: 0,
    totalFeesPaid: 0,
    totalRefundCredits: 0,
    outstandingDues: 0,
  };

  const transactions = billingData?.transactions || [];

  // Use authoritative booking or lab report statistics depending on facility domain
  const labReportCount = billingData?.labReportStats?.total || 0;
  const bookingCount = billingData?.bookingStats?.total || 0;
  const itemCount = isLab ? labReportCount : bookingCount;

  const displayDues = summary.displayDues !== undefined ? summary.displayDues : Math.max(0, summary.outstandingDues);
  const surplusCredit = summary.surplusCredit !== undefined ? summary.surplusCredit : (summary.outstandingDues < 0 ? Math.abs(summary.outstandingDues) : 0);

  const [paying, setPaying] = useState(false);

  const startPay = () => navigate(APP_ROUTES.ADMIN.PAY_SUMMARY);

  const confirmPay = async (targetAmount?: number, targetMonthKey?: string) => {
    const amountToPay = targetAmount && targetAmount > 0 ? targetAmount : summary.outstandingDues;
    if (amountToPay <= 0) {
      showToast('No outstanding platform dues to pay', 'error');
      return;
    }
    try {
      setPaying(true);
      showToast('Initiating platform dues payment order...');
      const order = await billingService.createPlatformDuesOrder(
        amountToPay,
        targetMonthKey || new Date().toISOString().slice(0, 7),
        window.location.pathname,
      );

      let rzpLoaded = Boolean((window as any).Razorpay);
      if (!rzpLoaded) {
        rzpLoaded = await loadRazorpaySdk();
      }

      if (rzpLoaded && (window as any).Razorpay) {
        const orderIdentifier = order.orderId || order.razorpayOrderId || '';
        const options: any = {
          key: order.razorpayKeyId || 'rzp_test_TWfJedMHco37nu',
          amount: order.amountPaise || Math.round(order.amount * 100),
          currency: order.currency || 'INR',
          name: 'AarohCare Platform Dues',
          description: `Platform dues settlement (${new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })})`,
          prefill: {
            name: user?.name || 'Facility Admin',
            email: user?.email || 'admin@aarohcare.com',
            contact: user?.phone || '9999999999',
          },
          handler: async function (response: any) {
            try {
              showToast('Verifying payment signature...');
              await billingService.verifyPlatformDuesPayment(
                orderIdentifier,
                {
                  razorpayPaymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
                  razorpaySignature: response.razorpay_signature || 'test_signature',
                },
                order.monthKey,
              );
              showToast('Successfully paid platform dues to Superadmin!', 'success');
              void loadBillingDues();
              if (isSummaryPage) {
                navigate(APP_ROUTES.ADMIN.PAY);
              }
            } catch {
              showToast('Payment verification failed', 'error');
            }
          },
          modal: {
            ondismiss: function () {
              showToast('Payment cancelled', 'error');
              void billingService.cancelPlatformDuesOrder(
                orderIdentifier,
                'Dismissed by admin',
              );
            },
          },
          theme: { color: '#3B82F6' },
        };

        // Attach order_id ONLY when a real order was registered on Razorpay servers
        if (order.razorpayOrderId) {
          options.order_id = order.razorpayOrderId;
        }

        try {
          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (resp: any) {
            showToast(resp.error?.description || 'Payment failed', 'error');
            void billingService.cancelPlatformDuesOrder(
              orderIdentifier,
              resp.error?.description,
            );
            navigate(APP_ROUTES.ADMIN.PAY_RETRY(orderIdentifier));
          });
          rzp.open();
          return;
        } catch (rzpOpenErr) {
          console.warn('[Razorpay] Popup open failed:', rzpOpenErr);
        }
      }

      showToast('Failed to open Razorpay payment gateway', 'error');
      return;
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as { message?: string })?.message || 'Payment failed';
      showToast(errMsg, 'error');
    } finally {
      setPaying(false);
    }
  };

  const handleRecordDirectPayment = async () => {
    const amt = Number(directAmount || summary.outstandingDues);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid transfer amount', 'error');
      return;
    }

    try {
      setRecordingDirect(true);
      await billingService.recordDirectDuesPayment(amt, directNotes || 'Direct Bank/UPI Transfer');
      showToast(`Direct payment of ₹${amt.toLocaleString('en-IN')} recorded to Superadmin Wallet!`, 'success');
      setDirectAmount('');
      setDirectNotes('');
      void loadBillingDues();
    } catch {
      showToast('Failed to record direct payment', 'error');
    } finally {
      setRecordingDirect(false);
    }
  };

  const downloadReceipt = () => {
    const lines = [
      'Aarohcare — Platform Fee Statement',
      `Date: ${new Date().toLocaleDateString()}`,
      `Total Fees Accrued: ₹${summary.totalFeesAccrued.toLocaleString('en-IN')}`,
      `Total Paid to Superadmin: ₹${summary.totalFeesPaid.toLocaleString('en-IN')}`,
      `Refund Credits: ₹${summary.totalRefundCredits.toLocaleString('en-IN')}`,
      `Net Outstanding Platform Dues: ₹${summary.outstandingDues.toLocaleString('en-IN')}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aarohcare-platform-dues-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Statement downloaded', 'success');
  };

  const superAdminUpi = 'superadmin@aarohcare';
  const superAdminUpiUri = `upi://pay?pa=${encodeURIComponent(superAdminUpi)}&pn=${encodeURIComponent('Superadmin Aarohcare')}&am=${encodeURIComponent(summary.outstandingDues || '0')}&cu=INR&tn=${encodeURIComponent('Platform Fee Dues Settlement')}`;
  const superAdminQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(superAdminUpiUri)}`;

  const currentBillingStatus =
    summary.status === 'PARTIALLY_PAID' || (summary.totalFeesPaid > 0 && summary.outstandingDues > 0)
      ? 'PARTIALLY_PAID'
      : summary.outstandingDues > 0
      ? 'PENDING'
      : 'PAID';

  const recordSummaryData = {
    id: 'CURRENT_BILLING',
    monthKey: new Date().toISOString().slice(0, 7),
    monthLabel: `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`,
    amount: summary.outstandingDues,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: currentBillingStatus,
    bookingCount: itemCount,
    feePerBooking: currentPlatformFee,
    paidAmount: summary.totalFeesPaid,
    remainingAmount: summary.outstandingDues,
    transactions,
    isLabFacility: isLab,
  };

  if (isSummaryPage) {
    return (
      <Outlet
        context={{
          record: recordSummaryData,
          onClose: () => navigate(APP_ROUTES.ADMIN.PAY),
          onPay: confirmPay,
          onDownloadReceipt: downloadReceipt,
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#0B2A4A] sm:text-[32px]">
            Pay Aarohcare Dues
          </h1>
          <p className="mt-1 text-[14px] text-[#64748B]">
            Manage convenience fee payments and settle outstanding platform dues to Superadmin Wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {user?.profileImage ? (
            <img
              src={user.profileImage}
              alt=""
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE] text-[12px] font-bold text-[#1D4ED8]">
              {initialsOf(user?.name || 'A')}
            </div>
          )}
        </div>
      </div>

      {/* Pending Approval Claims Notice */}
      {summary.totalPendingClaims && summary.totalPendingClaims > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⏳</span>
            <span>
              Payment claim of <span className="font-extrabold">₹{summary.totalPendingClaims.toLocaleString('en-IN')}</span> reported. Awaiting Super Admin verification and approval.
            </span>
          </div>
          <span className="rounded-lg bg-amber-200/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 uppercase tracking-wider">
            Approval Pending
          </span>
        </div>
      ) : null}

      {/* Amount due */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-[18px] font-bold text-[#0F172A]">Outstanding Platform Dues</h2>
              {summary.status === 'PAID' || summary.outstandingDues <= 0 ? (
                <span className="inline-flex rounded-full bg-[#10B981] px-2.5 py-1 text-[11px] font-bold text-white">
                  All Dues Settled
                </span>
              ) : summary.status === 'PARTIALLY_PAID' ? (
                <span className="inline-flex rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white">
                  Partially Paid
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-[#F59E0B] px-2.5 py-1 text-[11px] font-bold text-white">
                  Dues Pending
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[40px] font-bold leading-none tracking-tight text-[#0F172A]">
                ₹{displayDues.toLocaleString('en-IN')}
              </p>
              {surplusCredit > 0 && (
                <p className="mt-2 text-[13px] font-bold text-emerald-600 bg-emerald-50 inline-block px-2.5 py-1 rounded-lg border border-emerald-200">
                  Surplus Credit Balance: ₹{surplusCredit.toLocaleString('en-IN')}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={summary.outstandingDues <= 0 || paying}
              onClick={startPay}
              className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-6 py-3.5 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#2563EB] disabled:opacity-50"
            >
              <span>₹</span> {summary.outstandingDues > 0 ? (paying ? 'Processing...' : 'Pay Dues Online') : 'All Dues Settled'}
            </button>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[#64748B]">
              Total Fees Accrued: ₹{summary.totalFeesAccrued.toLocaleString('en-IN')} | Total Settled to Superadmin: ₹{summary.totalFeesPaid.toLocaleString('en-IN')}
            </p>
            {/* Adapt calculation terminology for Lab Admin using dynamic platform fee from backend without hardcoding */}
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.offlineFeeBreakdown && summary.offlineFeeBreakdown.length > 0 && !isLab ? (
                summary.offlineFeeBreakdown.map((group, idx) => (
                  <div key={idx} className="inline-flex rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2 text-[13px] text-[#475569]">
                    <span>
                      <span className="font-bold text-[#0F172A]">{group.count}</span> offline appointments × <span className="font-bold text-[#0F172A]">₹{group.feePerAppt}</span> fee rate = <span className="font-bold text-[#0F172A]">₹{group.totalFee.toLocaleString('en-IN')}</span> (includes cancelled offline bookings)
                    </span>
                  </div>
                ))
              ) : (
                <div className="inline-flex rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2 text-[13px] text-[#475569]">
                  <span>
                    {isLab ? (
                      <>
                        <span className="font-bold text-[#0F172A]">{itemCount}</span> total lab reports (Configured platform fee per lab report: <span className="font-bold text-[#0F172A]">₹{currentPlatformFee}</span>)
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-[#0F172A]">{itemCount}</span> total appointments (Configured platform fee: <span className="font-bold text-[#0F172A]">₹{currentPlatformFee}</span>)
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Superadmin Wallet Direct Transfer Card */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <div className="flex items-center justify-between border-b border-[#E5EAF0] pb-4 mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-[#0F172A] flex items-center gap-2">
              Direct Transfer to Superadmin Wallet
            </h3>
            <p className="text-[13px] text-[#64748B] mt-1">Transfer dues via UPI app / bank transfer and record your payment instantly.</p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-[12px] font-bold text-blue-700">Superadmin Wallet</span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Column: UPI Routing info */}
          <div className="rounded-xl border border-[#E5EAF0] p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold text-[#64748B]">Superadmin UPI ID:</span>
              <span className="text-[14px] font-bold text-[#0F172A]">{superAdminUpi}</span>
            </div>

            <a
              href={summary.outstandingDues > 0 ? superAdminUpiUri : '#'}
              onClick={(e) => {
                if (summary.outstandingDues <= 0) {
                  e.preventDefault();
                  showToast('No outstanding dues pending', 'error');
                }
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold text-white shadow-sm transition mb-6 ${
                summary.outstandingDues > 0 ? 'bg-[#10B981] hover:bg-[#059669]' : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              Open UPI App to Pay Dues (₹{displayDues.toLocaleString('en-IN')})
            </a>

            <div className="text-center mb-6">
              <div className="inline-block p-2 border border-[#E5EAF0] rounded-xl bg-white mb-3">
                <img src={superAdminQrUrl} alt="Superadmin UPI QR Code" className="h-[140px] w-[140px]" />
              </div>
              <p className="text-[12px] text-[#64748B] font-medium">Scan QR with Google Pay / PhonePe / Paytm</p>
            </div>

            <div className="mt-auto space-y-4 border-t border-[#E5EAF0] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#64748B] mb-0.5">Phone number</p>
                  <p className="text-[13px] font-bold text-[#0F172A]">+91 98765 43210</p>
                </div>
                <button className="rounded-lg bg-[#F1F5F9] px-3.5 py-1.5 text-[12px] font-semibold text-[#0B2A4A] hover:bg-[#E2E8F0] transition">Copy</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#64748B] mb-0.5">Account number</p>
                  <p className="text-[13px] font-bold text-[#0F172A]">1234567890123</p>
                </div>
                <button className="rounded-lg bg-[#F1F5F9] px-3.5 py-1.5 text-[12px] font-semibold text-[#0B2A4A] hover:bg-[#E2E8F0] transition">Copy</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#64748B] mb-0.5">IFSC code</p>
                  <p className="text-[13px] font-bold text-[#0F172A]">HDFC0001234</p>
                </div>
                <button className="rounded-lg bg-[#F1F5F9] px-3.5 py-1.5 text-[12px] font-semibold text-[#0B2A4A] hover:bg-[#E2E8F0] transition">Copy</button>
              </div>
            </div>
          </div>

          {/* Right Column: Record Transfer Input */}
          <div className="flex flex-col rounded-xl border border-[#E5EAF0] p-5">
            <h4 className="text-[15px] font-bold text-[#0F172A] mb-5">Record Direct UPI / Bank Settlement</h4>
            <div className="space-y-5 flex-1">
              <div>
                <label className="block text-[12px] font-semibold text-[#64748B] mb-2">Amount Transferred (₹)</label>
                <input
                  type="number"
                  value={directAmount}
                  onChange={(e) => setDirectAmount(e.target.value)}
                  placeholder={summary.outstandingDues > 0 ? String(summary.outstandingDues) : '0'}
                  className="w-full rounded-xl border border-[#E5EAF0] bg-white px-4 py-3 text-[14px] font-semibold text-[#0F172A] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] transition shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#64748B] mb-2">Reference Notes / UTR #</label>
                <input
                  type="text"
                  value={directNotes}
                  onChange={(e) => setDirectNotes(e.target.value)}
                  placeholder="e.g. UPI Ref #9988771122"
                  className="w-full rounded-xl border border-[#E5EAF0] bg-white px-4 py-3 text-[14px] font-medium text-[#0F172A] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6] transition shadow-sm"
                />
              </div>
            </div>
            <div className="mt-6 pt-2">
              <button
                type="button"
                disabled={recordingDirect || (summary.outstandingDues <= 0 && !directAmount)}
                onClick={() => void handleRecordDirectPayment()}
                className="w-full rounded-xl bg-[#0F172A] py-3.5 text-[14px] font-bold text-white shadow-sm hover:bg-[#1E293B] disabled:opacity-50 transition mb-3"
              >
                {recordingDirect ? 'Submitting Claim...' : 'Report Payment to Superadmin'}
              </button>
              <p className="text-[12px] text-[#64748B]">
                {summary.outstandingDues > 0
                  ? `Outstanding for this payment: ₹${summary.outstandingDues.toLocaleString('en-IN')}`
                  : surplusCredit > 0
                  ? `Surplus credit balance: ₹${surplusCredit.toLocaleString('en-IN')}`
                  : 'No dues pending'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3B82F6] mb-4">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <h3 className="text-[16px] font-bold text-[#0F172A] mb-2">Payment History & Ledger</h3>
          <p className="text-[13px] leading-relaxed text-[#64748B] flex-1 mb-6">
            Review past convenience fee settlements and download platform fee statements.
          </p>
          <div>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.ADMIN.PAY_HISTORY)}
              className="inline-flex items-center justify-center rounded-xl border border-[#E5EAF0] bg-white px-5 py-2.5 text-[13px] font-bold text-[#0F172A] transition hover:bg-[#F8FAFC] shadow-sm"
            >
              View History
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#3B82F6] mb-4">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <h3 className="text-[16px] font-bold text-[#0F172A] mb-2">Generate Record Summary</h3>
          <p className="text-[13px] leading-relaxed text-[#64748B] flex-1 mb-6">
            Review booking counts and platform fee calculations before settling dues.
          </p>
          <div>
            <button
              type="button"
              onClick={startPay}
              className="inline-flex items-center justify-center rounded-xl border border-[#E5EAF0] bg-white px-5 py-2.5 text-[13px] font-bold text-[#0F172A] transition hover:bg-[#F8FAFC] shadow-sm"
            >
              Review Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

