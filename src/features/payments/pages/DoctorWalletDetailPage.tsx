import { useEffect, useMemo, useState } from 'react';
import { format12Hour, todayIsoIst } from '@/utils/dateTime';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import {
  billingService,
  type DoctorOrder,
  type DoctorOrdersSummary,
  type DoctorWalletSummary,
} from '@/api/services/billing/billing.service';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import { PatientBookingCard } from '../components/PatientBookingCard';

export const DoctorWalletDetailPage = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();

  const [wallet, setWallet] = useState<DoctorWalletSummary | null>(null);
  
  // Default the wallet date to the current local date so the field is not blank when opened.
  const [fromDate, setFromDate] = useState<string>(todayIsoIst());
  const [toDate, setToDate] = useState<string>(todayIsoIst());

  const [ordersData, setOrdersData] = useState<DoctorOrdersSummary | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  // Support switching between All, Online, Offline, Cancelled, and Completed appointment filters
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'CANCELLED' | 'COMPLETED'>('ALL');
  const [search, setSearch] = useState('');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DoctorOrder | null>(null);

  const [settleDoctor, setSettleDoctor] = useState<DoctorWalletSummary | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (doctorId) {
      void loadWalletData();
      void loadDoctorOrders(fromDate, toDate);
    }
  }, [doctorId, fromDate, toDate]);

  const loadWalletData = async () => {
    try {
      const data = await billingService.getDoctorWallets();
      const doc = data.find((w) => w._id === doctorId);
      if (doc) setWallet(doc);
    } catch {
      showToast('Failed to load doctor wallet info', 'error');
    }
  };

  const loadDoctorOrders = async (from?: string, to?: string) => {
    if (!doctorId) return;
    try {
      setLoadingOrders(true);
      const data = await billingService.getDoctorOrders(doctorId, undefined, from || to ? { fromDate: from, toDate: to } : undefined);
      
      // Filter appointments using scheduled appointment date consistently with existing cards
      if (from || to) {
        data.orders = data.orders.filter((o) => {
          const dateStr = o.date || (o.createdAt ? o.createdAt.slice(0, 10) : '');
          if (!dateStr) return false;
          if (from && dateStr < from) return false;
          if (to && dateStr > to) return false;
          return true;
        });
        
        data.summary.totalOrders = data.orders.length;
        // Only COMPLETED appointments contribute to revenue and success count.
        // Previously CONFIRMED and CONSULTING were included, inflating the earned total.
        data.summary.successOrdersCount = data.orders.filter(
          (o) => o.status === 'COMPLETED'
        ).length;
        data.summary.completedOrdersCount = data.orders.filter((o) => o.status === 'COMPLETED').length;
        data.summary.cancelledOrdersCount = data.orders.filter((o) => o.status === 'CANCELLED').length;
        data.summary.unrefundedCancellationsCount = data.orders.filter(
          (o) => o.status === 'CANCELLED' && o.isPendingRefund
        ).length;
        // totalRevenue = sum of consultation fees from COMPLETED appointments only.
        data.summary.totalRevenue = data.orders
          .filter((o) => o.status === 'COMPLETED')
          .reduce((sum, o) => sum + (o.consultationFee || 0), 0);
      } else {
        data.summary.completedOrdersCount = data.orders.filter((o) => o.status === 'COMPLETED').length;
        // totalRevenue = sum of consultation fees from COMPLETED appointments only.
        data.summary.totalRevenue = data.orders
          .filter((o) => o.status === 'COMPLETED')
          .reduce((sum, o) => sum + (o.consultationFee || 0), 0);
      }
      
      setOrdersData(data);
    } catch {
      showToast('Failed to load doctor OP orders', 'error');
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleMarkPatientRefunded = async (appointmentId: string) => {
    try {
      setRefundingId(appointmentId);
      await billingService.markPatientRefunded(appointmentId);
      showToast('Patient refund recorded successfully!', 'success');
      void loadDoctorOrders(fromDate, toDate);
      void loadWalletData();
      if (selectedOrder?._id === appointmentId) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                isPendingRefund: false,
                cancellation: { ...prev.cancellation, refunded: true },
              }
            : null
        );
      }
    } catch {
      showToast('Failed to record patient refund', 'error');
    } finally {
      setRefundingId(null);
    }
  };

  const openSettleModal = (doc: DoctorWalletSummary) => {
    setSettleDoctor(doc);
    setSettleAmount(String(doc.pendingBalance || ''));
    setSettleNotes('');
  };

  const handleSettlePayout = async () => {
    if (!settleDoctor) return;

    if (settleDoctor.unrefundedCancellationsCount && settleDoctor.unrefundedCancellationsCount > 0) {
      showToast(
        `Cannot process payout until all patient refunds for cancelled bookings (${settleDoctor.unrefundedCancellationsCount} pending) are settled.`,
        'error',
      );
      return;
    }

    const amt = Number(settleAmount);
    if (!amt || amt <= 0) {
      showToast('Please enter a valid payout amount', 'error');
      return;
    }

    try {
      setSettling(true);
      await billingService.settleDoctorPayout(settleDoctor._id, amt, settleNotes);
      showToast(`Payout of ₹${amt.toLocaleString('en-IN')} marked as paid for Dr. ${settleDoctor.name}`, 'success');
      setSettleDoctor(null);
      void loadWalletData();
      void loadDoctorOrders(fromDate, toDate);
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to record payout settlement';
      showToast(errMsg, 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleSetToday = () => {
    const todayStr = todayIsoIst();
    setFromDate(todayStr);
    setToDate(todayStr);
  };

  const handleSetThisMonth = () => {
    const todayStr = todayIsoIst();
    const startOfMonth = todayStr.slice(0, 8) + '01';
    setFromDate(startOfMonth);
    setToDate(todayStr);
  };

  const handleClearDateFilter = () => {
    setFromDate('');
    setToDate('');
  };

  const getOrderBookingType = (ord: DoctorOrder): 'Offline' | 'Online' => {
    if (
      ord.paymentStatus === 'OFFLINE' ||
      ord.paymentStatus === 'PAY_AT_CLINIC' ||
      ord.time === 'QUEUE' ||
      (ord as any).type === 'Offline'
    ) {
      return 'Offline';
    }
    return 'Online';
  };

  // Derive counts for the 4 distinct summary boxes: Online, Offline, Cancelled, and Completed
  const cancelledOrdersCount = useMemo(() => {
    return ordersData?.orders.filter((o) => o.status === 'CANCELLED').length ?? 0;
  }, [ordersData?.orders]);

  const onlineOrdersCount = useMemo(() => {
    return ordersData?.orders.filter((o) => o.status !== 'CANCELLED' && getOrderBookingType(o) === 'Online').length ?? 0;
  }, [ordersData?.orders]);

  const offlineOrdersCount = useMemo(() => {
    return ordersData?.orders.filter((o) => o.status !== 'CANCELLED' && getOrderBookingType(o) === 'Offline').length ?? 0;
  }, [ordersData?.orders]);

  // Total appointments with persisted COMPLETED status, filtered by the active date range
  const completedOrdersCount = useMemo(() => {
    return ordersData?.orders.filter((o) => o.status === 'COMPLETED').length ?? 0;
  }, [ordersData?.orders]);

  // Filter orders according to active 4-box selection and text search query
  const filteredOrders = useMemo(() => {
    if (!ordersData?.orders) return [];
    let list = [...ordersData.orders];

    if (bookingTypeFilter === 'ONLINE') {
      list = list.filter((o) => o.status !== 'CANCELLED' && getOrderBookingType(o) === 'Online');
    } else if (bookingTypeFilter === 'OFFLINE') {
      list = list.filter((o) => o.status !== 'CANCELLED' && getOrderBookingType(o) === 'Offline');
    } else if (bookingTypeFilter === 'CANCELLED') {
      list = list.filter((o) => o.status === 'CANCELLED');
    } else if (bookingTypeFilter === 'COMPLETED') {
      list = list.filter((o) => o.status === 'COMPLETED');
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.patient?.name?.toLowerCase().includes(q) ||
          o.patient?.phone?.includes(q) ||
          String(o.tokenNumber || '').includes(q),
      );
    }

    return list;
  }, [ordersData?.orders, bookingTypeFilter, search]);

  const upiId = settleDoctor?.bankAccountDetails?.upiId?.trim() || '';
  const upiUri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(settleDoctor?.name || 'Doctor')}&am=${encodeURIComponent(settleAmount || '0')}&cu=INR&tn=${encodeURIComponent(`Doctor Payout - ${settleDoctor?.name || ''}`)}`
    : '';
  const qrCodeUrl = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`
    : '';

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-6 overflow-hidden pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.ADMIN.DOCTOR_WALLETS)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#0B2A4A]">
            {ordersData?.doctor?.name || wallet?.name || 'Doctor Patient List'}
          </h1>
          <p className="text-sm font-medium text-[#64748B]">
            {ordersData?.doctor?.specialization || wallet?.specialization || 'Consultant'} • Full Patient & Booking Records
          </p>
        </div>
        <div className="ml-auto">
          {wallet && wallet.pendingBalance > 0 && !((wallet.unrefundedCancellationsCount || 0) > 0) && (
            <button
              type="button"
              onClick={() => openSettleModal(wallet)}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Mark as Paid (₹{wallet.pendingBalance.toLocaleString('en-IN')})
            </button>
          )}
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-[#E2E8F0] p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-extrabold text-[#0B2A4A] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Filter Records by Date:
          </span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-[#CBD5E1] rounded-xl px-3 py-1.5">
            <span className="text-slate-500 font-semibold text-[11px]">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="font-bold text-[#0F172A] outline-none text-xs bg-transparent"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-[#CBD5E1] rounded-xl px-3 py-1.5">
            <span className="text-slate-500 font-semibold text-[11px]">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="font-bold text-[#0F172A] outline-none text-xs bg-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSetToday}
            className={`rounded-xl border px-3 py-1.5 font-bold transition ${fromDate && fromDate === toDate ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'}`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleSetThisMonth}
            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 font-bold text-sky-800 hover:bg-sky-100 transition"
          >
            This Month
          </button>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleClearDateFilter}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary Boxes in a single row on desktop: Online, Offline, Cancelled, and Completed */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Online Box */}
        <button
          type="button"
          onClick={() => setBookingTypeFilter(bookingTypeFilter === 'ONLINE' ? 'ALL' : 'ONLINE')}
          className={`group flex flex-col rounded-2xl border-2 p-5 text-left transition shadow-sm hover:shadow-md cursor-pointer ${
            bookingTypeFilter === 'ONLINE'
              ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-200'
              : 'border-slate-200 bg-white hover:border-sky-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Online</span>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
              Bookings
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900">{onlineOrdersCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {bookingTypeFilter === 'ONLINE' ? 'Filtering online patients (Click to reset)' : 'Click to filter online'}
          </p>
        </button>

        {/* Offline Box */}
        <button
          type="button"
          onClick={() => setBookingTypeFilter(bookingTypeFilter === 'OFFLINE' ? 'ALL' : 'OFFLINE')}
          className={`group flex flex-col rounded-2xl border-2 p-5 text-left transition shadow-sm hover:shadow-md cursor-pointer ${
            bookingTypeFilter === 'OFFLINE'
              ? 'border-violet-500 bg-violet-50/70 ring-2 ring-violet-200'
              : 'border-slate-200 bg-white hover:border-violet-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-700">Offline</span>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800">
              Walk-ins
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-900">{offlineOrdersCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {bookingTypeFilter === 'OFFLINE' ? 'Filtering offline patients (Click to reset)' : 'Click to filter offline'}
          </p>
        </button>

        {/* Cancelled Box */}
        <button
          type="button"
          onClick={() => setBookingTypeFilter(bookingTypeFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
          className={`group flex flex-col rounded-2xl border-2 p-5 text-left transition shadow-sm hover:shadow-md cursor-pointer ${
            bookingTypeFilter === 'CANCELLED'
              ? 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-200'
              : 'border-slate-200 bg-white hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Cancelled</span>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
              Bookings
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-rose-600">{cancelledOrdersCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {bookingTypeFilter === 'CANCELLED' ? 'Filtering cancelled patients (Click to reset)' : 'Click to filter cancelled'}
          </p>
        </button>

        {/* Completed Box */}
        <button
          type="button"
          onClick={() => setBookingTypeFilter(bookingTypeFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          className={`group flex flex-col rounded-2xl border-2 p-5 text-left transition shadow-sm hover:shadow-md cursor-pointer ${
            bookingTypeFilter === 'COMPLETED'
              ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200'
              : 'border-slate-200 bg-white hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Completed</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Consultations
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-600">{completedOrdersCount}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {bookingTypeFilter === 'COMPLETED' ? 'Filtering completed patients (Click to reset)' : 'Click to filter completed'}
          </p>
        </button>
      </div>

      {/* Unrefunded Patient Notice Banner if any */}
      {ordersData?.summary.unrefundedCancellationsCount ? ordersData.summary.unrefundedCancellationsCount > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-bold text-rose-800 shadow-xs">
          ⚠️ {ordersData.summary.unrefundedCancellationsCount} Cancelled bookings require refund (Total ₹{ordersData.summary.pendingPatientRefundAmount})
        </div>
      ) : null}

      {/* Search and Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient by name, phone number, or token..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-semibold text-[#0F172A] shadow-xs outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {(
            [
              { id: 'ALL', label: `All (${ordersData?.orders.length ?? 0})` },
              { id: 'ONLINE', label: `Online (${onlineOrdersCount})` },
              { id: 'OFFLINE', label: `Offline (${offlineOrdersCount})` },
              { id: 'CANCELLED', label: `Cancelled (${cancelledOrdersCount})` },
              { id: 'COMPLETED', label: `Completed (${completedOrdersCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBookingTypeFilter(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                bookingTypeFilter === tab.id
                  ? 'bg-[#0B2A4A] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient Cards List (Cards with double-sized text, clear border/stroke, and entire card clickable) */}
      <div className="flex-1 overflow-y-auto">
        {loadingOrders ? (
          <div className="p-16 text-center">
            <Spinner label="Loading patient bookings..." />
          </div>
        ) : !filteredOrders.length ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">
            No patient records found for the current search and filters.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredOrders.map((ord) => (
              <PatientBookingCard
                key={ord._id}
                order={ord}
                onClick={() => setSelectedOrder(ord)}
                onMarkRefunded={handleMarkPatientRefunded}
                refundingId={refundingId}
              />
            ))}
          </div>

        )}
      </div>

      {/* Selected Patient Details Modal (opened when any card is clicked) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <span className="inline-flex items-center rounded-xl bg-[#0B2A4A] px-3 py-1 text-sm font-black text-white">
                  Token #{selectedOrder.tokenNumber || '—'}
                </span>
                <h3 className="mt-1.5 text-xl font-black text-[#0B2A4A]">
                  {selectedOrder.patient?.name || 'Patient Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Contact Phone:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedOrder.patient?.phone ? (
                    <a href={`tel:${selectedOrder.patient.phone}`} className="text-blue-600 hover:underline">
                      +91 {selectedOrder.patient.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>

              {selectedOrder.patient?.age && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Age:</span>
                  <span className="font-bold text-[#0F172A]">{selectedOrder.patient.age} years</span>
                </div>
              )}

              {selectedOrder.patient?.gender && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-semibold">Gender:</span>
                  <span className="font-bold text-[#0F172A]">{selectedOrder.patient.gender}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Booking Date & Time:</span>
                <span className="font-bold text-[#0F172A]">
                  {selectedOrder.date} {selectedOrder.time ? `(${selectedOrder.time === 'QUEUE' ? 'Queue' : format12Hour(selectedOrder.time)})` : ''}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Booking Channel:</span>
                <span className="font-bold text-[#0F172A]">
                  {getOrderBookingType(selectedOrder) === 'Offline' ? 'Offline Walk-in' : 'Online Booking'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Consultation Fee:</span>
                <span className="text-lg font-black text-[#0B2A4A]">₹{selectedOrder.consultationFee}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-semibold">Consultation Status:</span>
                <div className="flex flex-col items-end">
                  {/* Display Auto Cancelled for automatically cancelled appointments, Cancelled for manual/patient cancellations */}
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      selectedOrder.status === 'CANCELLED'
                        ? 'bg-[#FFE4E6] text-[#BE123C]'
                        : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}
                  >
                    {/* Primary status is always 'Cancelled' regardless of refund state.
                        Refund completion is surfaced in the dedicated Refund Status block below. */}
                    {selectedOrder.status === 'CANCELLED'
                      ? (selectedOrder.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                         selectedOrder.cancellationReason === 'Patient Not Arrived')
                        ? 'Auto Cancelled'
                        : 'Cancelled'
                      : selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1).toLowerCase()}
                  </span>
                  {selectedOrder.status === 'CANCELLED' && (
                    selectedOrder.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                    selectedOrder.cancellationReason === 'Patient Not Arrived'
                  ) && (
                    <PatientNotArrivedBadge className="mt-1" />
                  )}
                </div>
              </div>

              {selectedOrder.status === 'CANCELLED' && (
                (selectedOrder.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                selectedOrder.cancellationReason === 'Patient Not Arrived') ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-700">Refund Status:</span>
                      <PatientNotArrivedBadge />
                    </div>
                    <p className="text-xs text-slate-500">
                      Patient did not arrive for consultation. No refund is applicable or created.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-rose-900">Refund Status:</span>
                      <span className="font-extrabold text-rose-700">
                        {selectedOrder.cancellation?.refunded ? '✓ Refunded' : '⚠️ Pending Refund'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-rose-800">Refund Amount:</span>
                      <span className="font-bold text-rose-900">
                        ₹{selectedOrder.cancellation?.refundAmount || selectedOrder.consultationFee}
                      </span>
                    </div>

                    {selectedOrder.cancellation?.refundPhone && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-rose-800">Refund Phone:</span>
                        <span className="font-bold text-rose-900">+91 {selectedOrder.cancellation.refundPhone}</span>
                      </div>
                    )}

                    {!selectedOrder.cancellation?.refunded && (
                      <div className="pt-2 flex flex-col gap-2">
                        {selectedOrder.cancellation?.refundUpiId && (
                          <a
                            href={`upi://pay?pa=${encodeURIComponent(selectedOrder.cancellation.refundUpiId)}&pn=${encodeURIComponent(selectedOrder.patient?.name || 'Patient')}&am=${selectedOrder.cancellation?.refundAmount || selectedOrder.consultationFee}&cu=INR&tn=${encodeURIComponent('OP Booking Cancel Refund')}`}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                          >
                            ⚡ 1-Click Pay UPI Refund
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={refundingId === selectedOrder._id}
                          onClick={() => void handleMarkPatientRefunded(selectedOrder._id)}
                          className="w-full rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition"
                        >
                          {refundingId === selectedOrder._id ? 'Recording...' : 'Mark Patient Refund as Settled'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Payout Modal */}
      {settleDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-[#0B2A4A]">Mark Doctor Payout as Paid</h3>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Settle doctor payout for <span className="font-extrabold text-[#0B2A4A]">{settleDoctor.name}</span>.
              </p>
            </div>

            {/* Unrefunded Lock Warning */}
            {(settleDoctor.unrefundedCancellationsCount || 0) > 0 && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 space-y-2">
                <p className="font-extrabold text-rose-900">
                  ⚠️ Payout Locked: {settleDoctor.unrefundedCancellationsCount} Pending Patient Refund(s)
                </p>
                <p className="text-[11px] font-medium text-rose-800">
                  You must fully settle patient refund amounts (Total ₹{settleDoctor.pendingPatientRefundAmount}) for cancelled bookings before paying doctor earnings.
                </p>
              </div>
            )}

            {/* Doctor Bank & UPI Section */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-900">Doctor Payout Routing</span>
                <span className="text-[10px] font-bold text-sky-700">Bank & UPI</span>
              </div>

              {settleDoctor.bankAccountDetails?.accountNumber || settleDoctor.bankAccountDetails?.upiId ? (
                <div className="space-y-2 text-xs">
                  {upiId && (
                    <div className="rounded-xl bg-white p-3 border border-sky-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F172A]">UPI ID:</span>
                        <span className="font-mono font-extrabold text-emerald-700">{upiId}</span>
                      </div>

                      <a
                        href={upiUri}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 transition"
                      >
                        ⚡ 1-Click Pay via UPI App
                      </a>

                      <div className="flex items-center justify-center pt-1 border-t border-slate-100">
                        <div className="text-center space-y-1">
                          <img src={qrCodeUrl} alt="UPI QR Code" className="mx-auto h-32 w-32 rounded-lg border border-slate-200 shadow-xs" />
                          <p className="text-[10px] font-semibold text-slate-500">Scan with Google Pay / PhonePe / Paytm</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {settleDoctor.bankAccountDetails?.accountNumber && (
                    <div className="space-y-1 pt-1 border-t border-sky-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B] font-semibold">Account No:</span>
                        <span className="font-mono font-bold text-[#0F172A]">{settleDoctor.bankAccountDetails.accountNumber}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B] font-semibold">IFSC Code:</span>
                        <span className="font-mono font-bold text-[#0F172A]">{settleDoctor.bankAccountDetails.ifscCode}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-[#64748B] font-medium">
                  No bank or UPI linked yet. You can transfer manually and record settlement below.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-[#0F172A]">Amount to Mark Paid (₹)</label>
                <input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="Enter payout amount"
                  className="mt-1 w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-sm font-bold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-[#0F172A]">Settlement Notes / Ref (Optional)</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. UPI / Bank Transfer Ref #123456"
                  className="mt-1 w-full rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettleDoctor(null)}
                className="rounded-xl border border-[#CBD5E1] px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={settling || (settleDoctor.unrefundedCancellationsCount || 0) > 0}
                onClick={() => void handleSettlePayout()}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {settling ? 'Recording...' : 'Confirm Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
