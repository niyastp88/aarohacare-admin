import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { format12Hour } from '@/utils/dateTime';
import { APP_ROUTES } from '@/constants/routes';
import { APP } from '@/constants/app';
import {
  billingService,
  type CancelledOrderDto,
  type FacilityCancelledOrdersResponse,
  type DoctorWalletSummary,
} from '@/api/services/billing/billing.service';
import { PatientDetailsModal } from '@/features/payments/components/PatientDetailsModal';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import { sweetAlert } from '@/components/ui/SweetAlert';

export const CancelledPatientsPage = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  // Keep the current year, month, and date selected by default so the Search Patient page opens with the latest refund period.
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const currentDay = currentDate.getDate().toString().padStart(2, '0');

  const [filterMode, setFilterMode] = useState<'YEAR' | 'MONTH' | 'DATE'>('DATE');
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(`${currentYear}-${currentMonth}`); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState<string>(`${currentYear}-${currentMonth}-${currentDay}`); // YYYY-MM-DD

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [refundStatus, setRefundStatus] = useState<'ALL' | 'PENDING_REFUND' | 'REFUNDED'>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'Online' | 'Offline'>('ALL');
  const [page, setPage] = useState(1);
  const [doctors, setDoctors] = useState<DoctorWalletSummary[]>([]);

  useEffect(() => {
    billingService.getDoctorWallets().then(setDoctors).catch(() => {});
  }, []);

  // Filter refund statistics by the selected year/month/day so the summary cards reflect the active period.
  useEffect(() => {
    if (filterMode === 'DATE' && selectedDate) {
      setFromDate(`${selectedDate}T00:00:00.000Z`);
      setToDate(`${selectedDate}T23:59:59.999Z`);
    } else if (filterMode === 'MONTH' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      setFromDate(`${year}-${month}-01T00:00:00.000Z`);
      setToDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`);
    } else if (filterMode === 'YEAR' && selectedYear) {
      setFromDate(`${selectedYear}-01-01T00:00:00.000Z`);
      setToDate(`${selectedYear}-12-31T23:59:59.999Z`);
    } else {
      setFromDate('');
      setToDate('');
    }
  }, [filterMode, selectedYear, selectedMonth, selectedDate]);

  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [data, setData] = useState<FacilityCancelledOrdersResponse | null>(null);
  
  // State for the modal
  const [selectedOrder, setSelectedOrder] = useState<CancelledOrderDto | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCancelledOrders = async () => {
    try {
      setLoading(true);
      const res = await billingService.getFacilityCancelledOrders({
        search: search || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        refundStatus,
        doctorId: selectedDoctorId === 'ALL' ? undefined : selectedDoctorId,
        type: selectedType,
        page,
        limit: 15,
      });
      setData(res);
    } catch {
      showToast('Failed to load cancelled patient orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCancelledOrders();
  }, [search, fromDate, toDate, refundStatus, selectedDoctorId, selectedType, page]);

  const handleMarkRefunded = async (appointmentId: string) => {
    try {
      setRefundingId(appointmentId);
      await billingService.markPatientRefunded(appointmentId);
      showToast('Patient refund recorded as completed!', 'success');
      void loadCancelledOrders();
    } catch {
      showToast('Failed to mark patient as refunded', 'error');
    } finally {
      setRefundingId(null);
    }
  };

  // Replace the browser-native confirmation with the shared AarohCare modal so refund actions use the application's UI consistently.
  const handleUndoRefund = (appointmentId: string) => {
    sweetAlert.confirm(
      'Undo Refund',
      'Are you sure you want to undo this refund and mark it as pending again?',
      async () => {
        try {
          setRefundingId(appointmentId);
          await billingService.undoPatientRefund(appointmentId);
          showToast('Refund marked as pending again', 'success');
          void loadCancelledOrders();
        } catch {
          showToast('Failed to undo patient refund', 'error');
        } finally {
          setRefundingId(null);
        }
      },
      {
        tone: 'warning',
        confirmText: 'Undo Refund',
        cancelText: 'Cancel',
      },
    );
  };

  const summary = data?.summary || {
    totalCancelledCount: 0,
    pendingRefundCount: 0,
    pendingRefundAmount: 0,
    totalRefundedCount: 0,
    totalRefundedAmount: 0,
  };

  // Export 1: Microsoft Excel (.xls / .xlsx)
  const exportExcelDocument = () => {
    if (!data || data.items.length === 0) {
      showToast('No cancelled patient orders to export', 'error');
      return;
    }

    // Use the application's official company name so Search Patient exports remain consistent with the rest of AarohaCare.
    const title = `${APP.NAME} — Cancelled OP Patients & Refund Settlement Statement`;
    const dateStr = new Date().toLocaleDateString();

    const headers = [
      'Token #',
      'Patient Name',
      'Mobile Phone',
      'Refund Mobile Phone',
      'Refund UPI ID',
      'Doctor Name',
      'Specialization',
      'OP Date',
      'Cancellation Date',
      'Consultation Fee (INR)',
      'Cancellation Source',
      'Net Refund Owed (INR)',
      'Refund Status',
    ];

    const xmlRows = data.items
      .map((item: CancelledOrderDto) => {
        const isRefunded = item.cancellation?.refunded === true || item.paymentStatus === 'REFUNDED';
        const isPatientCancelled =
          item.cancellation?.cancelledBy === 'PATIENT' ||
          (item.time !== 'QUEUE' && item.cancellation?.cancelledBy !== 'ADMIN');
        const refundAmt = isPatientCancelled
          ? 0
          : (typeof item.cancellation?.refundAmount === 'number'
              ? item.cancellation.refundAmount
              : (item.consultationFee ?? 0));
        const statusText = isRefunded ? 'REFUNDED' : item.isPendingRefund && refundAmt > 0 ? 'PENDING_REFUND' : 'NOT_PAID';
        const refundPhone = item.cancellation?.refundPhone ? `+91 ${item.cancellation.refundPhone}` : item.patient?.phone || 'N/A';
        const refundUpi = item.cancellation?.refundUpiId || 'N/A';
        const cancelDate = item.cancellation?.requestedAt ? new Date(item.cancellation.requestedAt).toLocaleString() : item.createdAt;
        const sourceLabel = isPatientCancelled ? 'Online Cancelled' : 'Offline (Admin)';

        return `
      <Row>
        <Cell><Data ss:Type="String">${item.tokenNumber || 'N/A'}</Data></Cell>
        <Cell><Data ss:Type="String">${item.patient?.name || 'Patient'}</Data></Cell>
        <Cell><Data ss:Type="String">${item.patient?.phone || ''}</Data></Cell>
        <Cell><Data ss:Type="String">${refundPhone}</Data></Cell>
        <Cell><Data ss:Type="String">${refundUpi}</Data></Cell>
        <Cell><Data ss:Type="String">${item.doctor?.name || 'Doctor'}</Data></Cell>
        <Cell><Data ss:Type="String">${item.doctor?.specialization || ''}</Data></Cell>
        <Cell><Data ss:Type="String">${item.date}</Data></Cell>
        <Cell><Data ss:Type="String">${cancelDate}</Data></Cell>
        <Cell><Data ss:Type="Number">${item.consultationFee}</Data></Cell>
        <Cell><Data ss:Type="String">${sourceLabel}</Data></Cell>
        <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${refundAmt}</Data></Cell>
        <Cell><Data ss:Type="String">${statusText}</Data></Cell>
      </Row>`;
      })
      .join('\n');

    const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="HeaderStyle">
    <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/>
    <Interior ss:Color="#0B2A4A" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TitleStyle">
    <Font ss:Bold="1" ss:Size="16" ss:Color="#0B2A4A"/>
  </Style>
  <Style ss:ID="CurrencyCell">
    <Font ss:Bold="1" ss:Color="#B45309"/>
  </Style>
</Styles>
<Worksheet ss:Name="Cancelled Refunds">
<Table>
  <Row ss:Height="24">
    <Cell ss:MergeAcross="12" ss:StyleID="TitleStyle"><Data ss:Type="String">${title} (${dateStr})</Data></Cell>
  </Row>
  <Row ss:Height="20">
    <Cell><Data ss:Type="String">Total Cancelled: ${summary.totalCancelledCount}</Data></Cell>
    <Cell><Data ss:Type="String">Pending Refunds: ${summary.pendingRefundCount} (₹${summary.pendingRefundAmount})</Data></Cell>
    <Cell><Data ss:Type="String">Settled Refunds: ${summary.totalRefundedCount} (₹${summary.totalRefundedAmount})</Data></Cell>
  </Row>
  <Row ss:Height="22">
    ${headers.map((h) => `<Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${h}</Data></Cell>`).join('')}
  </Row>
  ${xmlRows}
</Table>
</Worksheet>
</Workbook>`;

    const blob = new Blob([excelXml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cancelled-op-refunds-statement-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Cancelled OP Refunds Excel spreadsheet downloaded!', 'success');
  };

  // Export 2: Printable PDF Statement (.pdf)
  const exportPdfDocument = () => {
    if (!data || data.items.length === 0) {
      showToast('No cancelled patient orders to export', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Pop-up blocked. Please allow pop-ups to print or save PDF.', 'error');
      return;
    }

    const tableRows = data.items
      .map((item) => {
        const isRefunded = item.cancellation?.refunded === true || item.paymentStatus === 'REFUNDED';
        const isPatientCancelled =
          item.cancellation?.cancelledBy === 'PATIENT' ||
          (item.time !== 'QUEUE' && item.cancellation?.cancelledBy !== 'ADMIN');
        const refundAmt = isPatientCancelled
          ? 0
          : (typeof item.cancellation?.refundAmount === 'number'
              ? item.cancellation.refundAmount
              : (item.consultationFee ?? 0));
        const statusText = isRefunded ? '✓ REFUNDED' : item.isPendingRefund && refundAmt > 0 ? '⚠️ PENDING REFUND' : 'NOT PAID';
        const refundPhone = item.cancellation?.refundPhone ? `+91 ${item.cancellation.refundPhone}` : item.patient?.phone || 'N/A';
        const refundUpi = item.cancellation?.refundUpiId || 'N/A';

        return `
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">#${item.tokenNumber || '—'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">
            <strong>${item.patient?.name || 'Patient'}</strong><br/>
            <small style="color: #64748B;">📱 ${item.patient?.phone || ''}</small>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">
            <strong>${item.doctor?.name || 'Doctor'}</strong><br/>
            <small style="color: #64748B;">${item.doctor?.specialization || ''}</small>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">
            📱 ${refundPhone}<br/>
            <strong style="color: #0c4a6e;">⚡ ${refundUpi}</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">
            <span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
              ${isPatientCancelled ? 'Online Cancelled' : 'Offline (Admin)'}
            </span>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #b45309; text-align: right;">
            ${isPatientCancelled ? '—' : `₹${refundAmt}`}
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: bold; ${isRefunded ? 'color: #15803D;' : 'color: #B45309;'}">
            ${statusText}
          </td>
        </tr>
      `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <!-- Use the application's official company name so Search Patient exports remain consistent with the rest of AarohaCare. -->
          <title>${APP.NAME} Cancelled OP Refunds Statement</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0b2a4a; padding-bottom: 16px; margin-bottom: 20px; }
            .logo { font-size: 22px; font-weight: 800; color: #0b2a4a; }
            .sub { font-size: 12px; color: #64748b; }
            .metrics { display: flex; gap: 16px; margin-bottom: 20px; }
            .metric-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
            .metric-title { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; }
            .metric-val { font-size: 18px; font-weight: 800; color: #0b2a4a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #0b2a4a; color: white; padding: 10px; border: 1px solid #0b2a4a; text-align: left; font-size: 11px; }
            .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; pt-16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${window.location.origin}/aarohcare-logo.png" alt="${APP.NAME} Logo" style="height: 48px; width: 48px; object-fit: contain;" />
              <div>
                <!-- Use the application's official company name so Search Patient exports remain consistent with the rest of AarohaCare. -->
                <div class="logo">${APP.NAME.toUpperCase()} TELEHEALTH</div>
                <div class="sub">Cancelled OP Patients & Refund Settlement Statement</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #475569;">
              <strong>Statement Date:</strong> ${new Date().toLocaleDateString()}<br/>
              <strong>Facility Admin Portal</strong>
            </div>
          </div>

          <div class="metrics">
            <div class="metric-box">
              <div class="metric-title">Total Cancelled OPs</div>
              <div class="metric-val">${summary.totalCancelledCount}</div>
            </div>
            <div class="metric-box" style="background: #fffbeb; border-color: #fde68a;">
              <div class="metric-title" style="color: #b45309;">Pending Patient Refunds</div>
              <div class="metric-val" style="color: #b45309;">₹${summary.pendingRefundAmount.toLocaleString('en-IN')} (${summary.pendingRefundCount} Orders)</div>
            </div>
            <div class="metric-box" style="background: #f0fdf4; border-color: #bbf7d0;">
              <div class="metric-title" style="color: #15803d;">Settled Refunds</div>
              <div class="metric-val" style="color: #15803d;">₹${summary.totalRefundedAmount.toLocaleString('en-IN')} (${summary.totalRefundedCount} Orders)</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Token #</th>
                <th>Patient Details</th>
                <th>Doctor</th>
                <th>Refund Phone & UPI ID</th>
                <th>Cancellation Source</th>
                <th style="text-align: right;">Refund Amount</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <!-- Use the application's official company name so Search Patient exports remain consistent with the rest of AarohaCare. -->
            <div>${APP.NAME} Platform — Official Refund Record Statement</div>
            <div>Generated: ${new Date().toLocaleString()}</div>
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast('Cancelled OP Refunds PDF Statement generated!', 'success');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.ADMIN.PATIENTS)}
              className="text-xs font-bold text-slate-500 hover:text-[#0B2A4A] hover:underline"
            >
              ← Search Patients
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-rose-700">Cancelled OP Patients</span>
          </div>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight text-[#0B2A4A] sm:text-[32px]">
            Cancelled OP Patients & Refunds
          </h1>
          <p className="mt-1 text-[14px] text-[#64748B]">
            Manage cancelled OP bookings, calculate 1-week sliding refunds, send UPI refunds, and export statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={exportExcelDocument}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-800 transition"
          >
            <span>📊</span> Export Excel (.xls)
          </button>
          <button
            type="button"
            onClick={exportPdfDocument}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2A4A] px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-900 transition"
          >
            <span>📄</span> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Filter Bar (Moved to Top) */}
      <div className="rounded-2xl border border-[#E5EAF0] bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-4">
          {/* Row 1: Unified Date Filter */}
          {/* Merged mode selector and native date picker into a single horizontal row on desktop to prevent wrapping and reduce vertical space. Removed the 'SELECT MONTH' label to keep it inline. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setFilterMode('YEAR')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${filterMode === 'YEAR' ? 'bg-[#0B2A4A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Full Year
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('MONTH')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${filterMode === 'MONTH' ? 'bg-[#0B2A4A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Full Month
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('DATE')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${filterMode === 'DATE' ? 'bg-[#0B2A4A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Specific Date
              </button>

              {/* Dynamic Native Picker inline */}
              {filterMode === 'YEAR' && (
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-bold text-[#0B2A4A] outline-none focus:border-sky-500 min-w-[140px] shadow-sm cursor-pointer"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              )}

              {filterMode === 'MONTH' && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(e.target.value); setPage(1); }}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-bold text-[#0B2A4A] outline-none focus:border-sky-500 min-w-[140px] shadow-sm cursor-pointer"
                />
              )}

              {filterMode === 'DATE' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-bold text-[#0B2A4A] outline-none focus:border-sky-500 min-w-[140px] shadow-sm cursor-pointer"
                />
              )}
            </div>

            {(selectedYear !== currentYear.toString() || selectedMonth !== `${currentYear}-${currentMonth}` || selectedDate !== `${currentYear}-${currentMonth}-${currentDay}` || search || filterMode !== 'DATE') && (
              <button
                type="button"
                onClick={() => {
                  setFilterMode('DATE');
                  setSelectedYear(currentYear.toString());
                  setSelectedMonth(`${currentYear}-${currentMonth}`);
                  setSelectedDate(`${currentYear}-${currentMonth}-${currentDay}`);
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 shadow-sm transition"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Row 3: Doctor & Mode Filters */}
          <div className="flex flex-wrap items-end gap-4 border-b border-slate-100 pb-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => { setSelectedDoctorId(e.target.value); setPage(1); }}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-sm font-bold text-[#0B2A4A] outline-none focus:border-sky-500 min-w-[180px] shadow-sm cursor-pointer"
              >
                <option value="ALL">All doctors</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mode</label>
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden p-0.5 h-[38px]">
                <button
                  type="button"
                  onClick={() => { setSelectedType('ALL'); setPage(1); }}
                  className={`px-4 py-1 text-sm font-bold rounded-lg transition-colors ${selectedType === 'ALL' ? 'bg-[#0B2A4A] text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedType('Online'); setPage(1); }}
                  className={`px-4 py-1 text-sm font-bold rounded-lg transition-colors ${selectedType === 'Online' ? 'bg-[#0B2A4A] text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedType('Offline'); setPage(1); }}
                  className={`px-4 py-1 text-sm font-bold rounded-lg transition-colors ${selectedType === 'Offline' ? 'bg-[#0B2A4A] text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                >
                  Offline
                </button>
              </div>
            </div>
            {(selectedDoctorId !== 'ALL' || selectedType !== 'ALL') && (
              <button
                type="button"
                onClick={() => { setSelectedDoctorId('ALL'); setSelectedType('ALL'); setPage(1); }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 mb-0.5 text-sm font-bold text-slate-600 hover:bg-slate-100 shadow-sm transition h-[38px]"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Row 4: Search Bar */}
          {/* Widen the search field so it occupies most of the horizontal space to make it easier to read. */}
          <div className="w-full lg:w-[80%] pt-1">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by Patient Name, Mobile Phone, UPI ID, Doctor, or Token #..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-bold text-slate-800 outline-none focus:border-sky-500 transition shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Refund Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
          {(
            [
              { id: 'ALL', label: 'All Cancelled OPs' },
              { id: 'PENDING_REFUND', label: '⚠️ Refund Pending' },
              { id: 'REFUNDED', label: '✓ Refund Completed' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setRefundStatus(tab.id);
                setPage(1);
              }}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                refundStatus === tab.id
                  ? 'bg-[#0B2A4A] text-white shadow-md'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Metrics (Moved Below Filter Bar) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Cancelled OPs</span>
            <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-700">Cancelled</span>
          </div>
          <p className="mt-3 text-3xl font-black text-[#0B2A4A]">{summary.totalCancelledCount}</p>
          <p className="mt-1 text-xs text-slate-500 font-medium">All time cancelled appointments</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Patient Refunds</span>
            <span className="rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-extrabold text-amber-900">
              {summary.pendingRefundCount} Orders
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-amber-900">₹{summary.pendingRefundAmount.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-amber-700 font-medium">Refund owed to patients</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Settled Refunds</span>
            <span className="rounded-lg bg-emerald-200 px-2.5 py-1 text-[11px] font-extrabold text-emerald-900">
              {summary.totalRefundedCount} Orders
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-emerald-900">₹{summary.totalRefundedAmount.toLocaleString('en-IN')}</p>
          <p className="mt-1 text-xs text-emerald-700 font-medium">Fully refunded to patients</p>
        </div>
      </div>

      {/* Cancelled Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5EAF0] bg-white shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <Spinner label="Loading cancelled OP patients..." />
          </div>
        ) : !data?.items.length ? (
          <div className="p-12 text-center text-xs font-semibold text-slate-500">
            No cancelled OP patients found matching the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#64748B] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Token & Date</th>
                  <th className="px-4 py-3.5">Patient Details</th>
                  <th className="px-4 py-3.5">Doctor</th>
                  <th className="px-4 py-3.5">Refund Owed</th>
                  <th className="px-4 py-3.5">Refund Phone & UPI ID</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => {
                  const isRefunded = item.cancellation?.refunded === true || item.paymentStatus === 'REFUNDED';
                  const refundPhone = item.cancellation?.refundPhone || item.patient?.phone;
                  const refundUpi = item.cancellation?.refundUpiId;
                  
                  // Identify cancellation source correctly from persisted cancellation data:
                  // Patients cancel online via the mobile app (cancelledBy === 'PATIENT' or time !== 'QUEUE')
                  const isPatientCancelled =
                    item.cancellation?.cancelledBy === 'PATIENT' ||
                    (item.time !== 'QUEUE' && item.cancellation?.cancelledBy !== 'ADMIN');
                  
                  // Automatically cancelled appointments are identified strictly by persisted PATIENT_NOT_ARRIVED reason
                  const isPatientNotArrived =
                    item.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                    item.cancellationReason === 'Patient Not Arrived';
                  
                  // For Admin-cancelled offline appointments, use the actual Admin-entered refund amount.
                  // For patient-cancelled online appointments or unarrived patients, no refund is owed.
                  const refundAmt = (isPatientCancelled || isPatientNotArrived)
                    ? 0
                    : (typeof item.cancellation?.refundAmount === 'number'
                        ? item.cancellation.refundAmount
                        : (item.consultationFee ?? 0));

                  return (
                    <tr 
                      key={item._id} 
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedOrder(item)}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-extrabold text-[#0F172A]">Token #{item.tokenNumber || 'N/A'}</p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {item.date} ({item.time === 'QUEUE' ? 'Queue' : format12Hour(item.time)})
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-[#0F172A]">{item.patient?.name || 'Patient'}</p>
                        <p className="text-[11px] text-slate-500">{item.patient?.phone || 'N/A'}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-[#0F172A]">{item.doctor?.name || 'Doctor'}</p>
                        <p className="text-[11px] text-slate-500">{item.doctor?.specialization || 'General'}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        {isPatientNotArrived ? (
                          <div className="space-y-1">
                            <PatientNotArrivedBadge />
                          </div>
                        ) : isPatientCancelled ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              Online Cancelled
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-black text-rose-700 text-sm">₹{refundAmt}</p>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {refundPhone && (
                            <p className="font-bold text-slate-700">📱 +91 {refundPhone}</p>
                          )}
                          {refundUpi ? (
                            <p className="font-mono font-extrabold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 inline-block">
                              ⚡ {refundUpi}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 font-semibold">No UPI ID submitted</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {isRefunded ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="inline-flex items-center rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                              ✓ Refund Completed
                            </span>
                            <button
                              type="button"
                              disabled={refundingId === item._id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleUndoRefund(item._id);
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 transition"
                            >
                              {refundingId === item._id ? 'Working...' : 'Undo'}
                            </button>
                          </div>
                        ) : item.isPendingRefund && refundAmt > 0 ? (
                          <div className="flex flex-col items-end gap-1.5">
                            {refundUpi && (
                              <a
                                href={`upi://pay?pa=${encodeURIComponent(refundUpi)}&pn=${encodeURIComponent(item.patient?.name || 'Patient')}&am=${refundAmt}&cu=INR&tn=${encodeURIComponent('OP Cancellation Refund')}`}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 transition"
                              >
                                📱 1-Click Pay UPI Refund
                              </a>
                            )}
                            <button
                              type="button"
                              disabled={refundingId === item._id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleMarkRefunded(item._id);
                              }}
                              className="rounded-xl bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition"
                            >
                              {refundingId === item._id ? 'Saving...' : 'Mark Patient Refunded'}
                            </button>
                          </div>
                        ) : (
                          // Display clear status for non-refundable cancelled appointments instead of vague N/A label
                          <span className="text-slate-400 text-xs font-semibold">No Refund Owed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-[#F8FAFC] px-5 py-3 text-xs">
            <span className="font-semibold text-slate-500">
              Showing Page {data.page} of {data.totalPages} ({data.total} total cancelled orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-[#0B2A4A] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-[#0B2A4A] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <PatientDetailsModal 
        appointment={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onRefund={(id) => {
          void handleMarkRefunded(id);
          // Wait for success and re-fetch is already handled by handleMarkRefunded
          // but we also need to close or update the modal state. 
          // Since it refetches the list, closing the modal is safer or it'll update if we find the new item.
          setSelectedOrder(null);
        }}
        isRefunding={refundingId === selectedOrder?._id}
      />
    </div>
  );
};
