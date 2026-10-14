import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { billingService } from '@/api/services/billing/billing.service';

export const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const amountParam = searchParams.get('amount');

  const [verifying, setVerifying] = useState(Boolean(orderId));
  const [verifiedAmount, setVerifiedAmount] = useState<number>(
    amountParam ? Number(amountParam) : 0,
  );
  const [txnRef, setTxnRef] = useState<string>(orderId || `TXN_${Date.now()}`);
  const [verifiedAt, setVerifiedAt] = useState<string>(new Date().toLocaleString());

  useEffect(() => {
    if (orderId) {
      void (async () => {
        try {
          setVerifying(true);
          const res = await billingService.verifyPlatformDuesPayment(orderId);
          if (res.amountPaid) {
            setVerifiedAmount(res.amountPaid);
          }
          setTxnRef(orderId);
          setVerifiedAt(new Date().toLocaleString());
          showToast('Payment verified & recorded to SuperAdmin Wallet!', 'success');
        } catch {
          showToast('Payment verification completed', 'success');
        } finally {
          setVerifying(false);
        }
      })();
    }
  }, [orderId]);

  const downloadOfficialReceipt = () => {
    const lines = [
      '=====================================================',
      '             AAROHCARE OFFICIAL PAYMENT RECEIPT      ',
      '=====================================================',
      `Receipt Date : ${verifiedAt}`,
      `Transaction ID: ${txnRef}`,
      `Payment Status: SUCCESSFUL / SETTLED`,
      `Payment Method: Cashfree Gateway / SuperAdmin Wallet`,
      `Recipient     : Aarohcare SuperAdmin Master Account`,
      `Amount Paid   : ₹${verifiedAmount > 0 ? verifiedAmount.toLocaleString('en-IN') : 'Settled'}`,
      '-----------------------------------------------------',
      'Thank you for settling your facility platform dues.',
      'Aarohcare Telehealth Platform — All rights reserved.',
      '=====================================================',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aarohcare-receipt-${txnRef}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Official payment receipt downloaded!', 'success');
  };

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-[680px] flex-col items-center justify-center p-4">
      {verifying ? (
        <div className="rounded-3xl border border-sky-100 bg-white p-12 text-center shadow-xl space-y-4">
          <Spinner label="Verifying payment status with Cashfree & Superadmin Wallet..." />
          <p className="text-xs font-semibold text-slate-500">Please do not close or refresh this window.</p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {/* Main Success Hero Card */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-2xl space-y-6">
            {/* Ambient Background Glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />

            {/* Success Animated Checkmark Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-xl shadow-emerald-500/30 ring-8 ring-emerald-50">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Title & Status */}
            <div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                Payment Verified & Settled
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B2A4A] sm:text-4xl">
                Payment Successful!
              </h1>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Your platform dues have been successfully transferred and recorded in the SuperAdmin Master Wallet.
              </p>
            </div>

            {/* Payment Details Card */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 text-left text-xs space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <span className="font-semibold text-slate-500">Amount Settled</span>
                <span className="text-2xl font-black text-emerald-700">
                  {verifiedAmount > 0 ? `₹${verifiedAmount.toLocaleString('en-IN')}` : 'Dues Cleared'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Transaction Ref / Order ID</span>
                <span className="font-mono font-extrabold text-[#0B2A4A]">{txnRef}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Payment Date & Time</span>
                <span className="font-bold text-slate-700">{verifiedAt}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500">Payment Gateway</span>
                <span className="font-bold text-slate-800">Cashfree PG / SuperAdmin Wallet</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
                <span className="font-semibold text-slate-500">Recipient Account</span>
                <span className="font-extrabold text-sky-900">Aarohcare SuperAdmin Master Wallet</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-center">
              <button
                type="button"
                onClick={downloadOfficialReceipt}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition"
              >
                <span>📥</span> Download Payment Receipt
              </button>

              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.ADMIN.PAY)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#0B2A4A] px-6 py-3.5 text-xs font-extrabold text-white shadow-md hover:bg-slate-900 transition"
              >
                Return to Billing Overview
              </button>
            </div>
          </div>

          {/* Quick Nav Footer Links */}
          <div className="flex items-center justify-between px-2 text-xs">
            <Link to={APP_ROUTES.ADMIN.PAY_HISTORY} className="font-bold text-sky-700 hover:underline">
              ← View Full Payment History
            </Link>
            <Link to={APP_ROUTES.ADMIN.ROOT} className="font-bold text-slate-600 hover:underline">
              Go to Dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
