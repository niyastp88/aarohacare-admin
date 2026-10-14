import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { BackButton } from '@/components/ui/BackButton';
import { showToast } from '@/components/ui/Toast';
import { formatMoney } from '../data';
import { billingService } from '@/api/services/billing/billing.service';
import { APP_ROUTES } from '@/constants/routes';

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

export const AdminPaymentRetryPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const returnUrlParam = searchParams.get('returnUrl');

  const [attempt, setAttempt] = useState<{
    orderId: string;
    amount: number;
    monthKey: string;
    monthLabel: string;
    status: string;
    failureReason: string;
    returnUrl: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  // Validate return path to ensure it navigates only to an allowed AarohCare Admin route
  const safeReturnUrl = useMemo(() => {
    const candidate = returnUrlParam || attempt?.returnUrl;
    if (candidate && candidate.startsWith('/admin/') && !candidate.includes('//')) {
      const allowedPrefixes = [
        '/admin/pay',
        '/admin/pay/summary',
        '/admin/pay/history',
        '/admin/billing/platform-dues',
        '/admin',
      ];
      if (allowedPrefixes.some((prefix) => candidate === prefix || candidate.startsWith('/admin/pay/summary/'))) {
        return candidate;
      }
    }
    return APP_ROUTES.ADMIN.PAY_SUMMARY;
  }, [returnUrlParam, attempt]);

  useEffect(() => {
    window.scrollTo(0, 0);
    void loadRazorpaySdk();

    const fetchAttemptDetails = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await billingService.getAdminBillingOrderDetails(orderId);
        setAttempt(data);
      } catch {
        showToast('Could not load payment attempt details', 'error');
      } finally {
        setLoading(false);
      }
    };
    void fetchAttemptDetails();
  }, [orderId]);

  const handleTryAgain = async () => {
    if (!attempt || retrying) return;

    try {
      setRetrying(true);
      showToast('Initiating new Razorpay payment attempt...');
      
      // Backend recalculates and validates the outstanding amount before order creation
      const order = await billingService.createPlatformDuesOrder(
        attempt.amount,
        attempt.monthKey || undefined,
        safeReturnUrl,
      );

      const rzpLoaded = await loadRazorpaySdk();
      if (!rzpLoaded || !(window as any).Razorpay) {
        showToast('Failed to load Razorpay SDK. Please check your network connection.', 'error');
        return;
      }

      const orderIdentifier = order.orderId || order.razorpayOrderId || orderId || '';
      const options: any = {
        key: order.razorpayKeyId || 'rzp_test_TWfJedMHco37nu',
        amount: order.amountPaise || Math.round(attempt.amount * 100),
        currency: order.currency || 'INR',
        name: 'AarohCare Platform Dues',
        description: attempt.monthLabel || 'Platform Dues Payment Retry',
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
            showToast('Payment verified successfully!', 'success');
            navigate(safeReturnUrl, { replace: true });
          } catch {
            showToast('Payment verification failed', 'error');
          }
        },
        modal: {
          ondismiss: function () {
            showToast('Payment attempt cancelled', 'error');
            void billingService.cancelPlatformDuesOrder(orderIdentifier, 'User dismissed checkout modal');
          },
        },
        theme: {
          color: '#3B82F6',
        },
      };

      if (order.razorpayOrderId) {
        options.order_id = order.razorpayOrderId;
      }

      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          showToast(resp.error?.description || 'Payment attempt failed', 'error');
          void billingService.cancelPlatformDuesOrder(orderIdentifier, resp.error?.description);
        });
        rzp.open();
        return;
      } catch {
        showToast('Failed to open Razorpay payment gateway', 'error');
        return;
      }
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (err as { message?: string })?.message || 'Failed to start payment';
      showToast(errMsg, 'error');
    } finally {
      setRetrying(false);
    }
  };

  const handlePayLater = () => {
    navigate(safeReturnUrl, { replace: true });
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-5 py-12 text-center text-[#64748B]">
        Loading payment attempt details...
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 pb-12">
      <div>
        <BackButton onClick={handlePayLater}>Back to Dues Summary</BackButton>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-[20px] font-bold text-red-900">Payment Attempt Unsuccessful</h1>
            <p className="mt-1 text-[14px] text-red-700">
              {attempt?.failureReason || 'Your Razorpay checkout was not completed or was cancelled before verification.'}
            </p>
          </div>
        </div>
      </div>

      {/* Attempt Details Card */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-[16px] font-bold text-[#0F172A]">Payment Attempt Summary</h2>
        <div className="space-y-3 divide-y divide-[#F1F5F9]">
          <div className="flex items-center justify-between pb-3">
            <span className="text-[13px] font-medium text-[#64748B]">Order Reference</span>
            <span className="font-mono text-[13px] font-bold text-[#0F172A]">{attempt?.orderId || orderId || 'N/A'}</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] font-medium text-[#64748B]">Target Period</span>
            <span className="text-[14px] font-semibold text-[#0F172A]">{attempt?.monthLabel || 'Platform Fee Dues'}</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-[13px] font-medium text-[#64748B]">Outstanding Payable Dues</span>
            <span className="text-[20px] font-bold text-[#0F172A]">{formatMoney(attempt?.amount || 0)}</span>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-[13px] font-medium text-[#64748B]">Payment Gateway</span>
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[12px] font-bold text-blue-700">
              Razorpay Secure Checkout
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={retrying}
            onClick={() => void handleTryAgain()}
            className="flex-1 rounded-xl bg-[#3B82F6] py-3.5 text-[15px] font-bold text-white shadow-sm transition hover:bg-[#2563EB] disabled:opacity-50"
          >
            {retrying ? 'Starting Razorpay...' : 'Try again'}
          </button>

          <button
            type="button"
            onClick={handlePayLater}
            className="flex-1 rounded-xl border border-[#CBD5E1] bg-white py-3.5 text-[15px] font-bold text-[#475569] shadow-sm transition hover:bg-[#F8FAFC]"
          >
            Pay later
          </button>
        </div>
      </div>
    </div>
  );
};
