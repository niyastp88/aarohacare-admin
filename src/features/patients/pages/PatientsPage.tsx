import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { appointmentsService } from '@/api/services/appointments';
import { getApiErrorMessage } from '@/api/client';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { IconCalendar, IconUsers } from '@/components/layout/icons';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { APP } from '@/constants/app';
import { useFacilityPatients } from '@/hooks/useAppointments';
import { todayIsoIst } from '@/utils/dateTime';
import { toTitleCase } from '@/utils/formatters';
import type { FacilityPatientDto } from '@/types/dto';
import {
  OpConsultationPrintForm,
  type OpConsultationFormData,
} from '@/components/print/OpConsultationPrintForm';
import {
  formatConsultDate,
  formatGender,
  initialsOf,
  patientDisplayId,
} from '../utils';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

const monthBounds = (year: number, month: number | 'all') => {
  if (month === 'all') {
    return {
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    };
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${year}-${pad2(month)}-01`,
    toDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
};

const formatNumber = (value: number) => value.toLocaleString('en-IN');

const getPatientLastVisit = (patient: FacilityPatientDto) => {
  return patient.lastVisitAt || undefined;
};

const formatLastVisitLong = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const isNewPatientBooking = (patient: FacilityPatientDto): boolean => {
  // If the patient has no previous completed visit prior to this booking
  return !getPatientLastVisit(patient);
};

const getPatientBookingType = (patient: FacilityPatientDto): 'Online' | 'Offline' => {
  if (patient.lastBookingType) return patient.lastBookingType;
  // Fallback if lastBookingType not explicitly set: if latest booking was online, or only online bookings exist
  if ((patient.onlineBookingCount ?? 0) > 0 && (patient.offlineBookingCount ?? 0) === 0) return 'Online';
  return 'Offline';
};

// Group appointments strictly by their scheduled appointment date without timezone day shifts.
const formatDayDivider = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const day = String(d).padStart(2, '0');
    const month = dateObj.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
    return `${day} ${month}`;
  }
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
  return `${day} ${month}`;
};

const dayKey = (value?: string) => {
  if (!value) return 'unknown';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

type OpBookingStatus = 'Pending' | 'Completed' | 'Cancelled' | 'Auto Cancelled';

const getLatestOpStatus = (patient: FacilityPatientDto): OpBookingStatus => {
  if (patient.latestOpStatus) return patient.latestOpStatus;
  const status = (patient.lastStatus || '').toUpperCase();
  if (status === 'COMPLETED') return 'Completed';
  if (status === 'CANCELLED') {
    const isAuto =
      patient.lastCancellationReason === 'PATIENT_NOT_ARRIVED' ||
      patient.lastCancellationReason === 'Patient Not Arrived';
    return isAuto ? 'Auto Cancelled' : 'Cancelled';
  }
  return 'Pending';
};

const opStatusBadgeClass = (status: OpBookingStatus) => {
  if (status === 'Completed') return 'bg-[#DCFCE7] text-[#15803D]';
  if (status === 'Cancelled' || status === 'Auto Cancelled') return 'bg-[#FFE4E6] text-[#BE123C]';
  return 'bg-[#FEF3C7] text-[#B45309]';
};

// Ensure Refund Pending only applies to Cancelled appointments, never Completed or Pending ones
const hasPendingRefundStatus = (patient: FacilityPatientDto): boolean => {
  const currentStatus = getLatestOpStatus(patient);
  if (currentStatus !== 'Cancelled') return false;

  // Do not show refund pending for auto-cancelled appointments where patient did not arrive (no refund applicable)
  const isAuto =
    patient.lastCancellationReason === 'PATIENT_NOT_ARRIVED' ||
    patient.lastCancellationReason === 'Patient Not Arrived' ||
    patient.latestOpStatus === 'Auto Cancelled';
  if (isAuto) return false;

  // If refund has already been completed, do not display refund pending
  if (patient.lastRefunded === true) return false;

  const pendingAmt =
    patient.pendingRefundAmount ||
    (patient.lastRefunded === false ? patient.lastRefundAmount : 0) ||
    0;

  // Genuine pending refund: cancelled appointment with an outstanding refund amount > 0 and not refunded
  return (
    (Boolean(patient.hasPendingRefund) ||
      (patient.pendingRefundCount ?? 0) > 0 ||
      (patient.lastStatus === 'CANCELLED' && patient.lastRefunded === false)) &&
    pendingAmt > 0
  );
};

const getRefundStatus = (patient: FacilityPatientDto): string | null => {
  return hasPendingRefundStatus(patient) ? 'Refund Pending' : null;
};

const PatientAvatar = ({
  name,
  image,
}: {
  name: string;
  image?: string;
}) => {
  if (image) {
    return <img src={image} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[13px] font-bold text-[#1D4ED8]">
      {initialsOf(name)}
    </div>
  );
};

export const PatientsPage = () => {
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const today = todayIsoIst();
  const [year, monthToday] = today.split('-').map(Number);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(monthToday);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'registered' | 'cancelled' | 'pending'>('all');
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<'all' | number>('all');

  // Printable A4 OP Consultation Form state
  const [printData, setPrintData] = useState<OpConsultationFormData | null>(null);

  // Handle printing OP Consultation Form for individual patient
  const handlePrintPatient = async (patient: FacilityPatientDto) => {
    try {
      const detail = await appointmentsService.getPatientDetail(patient._id);
      const latestAppt = detail?.appointments?.[0];
      const doctorObj =
        latestAppt && typeof latestAppt.doctorId === 'object'
          ? (latestAppt.doctorId as any)
          : null;

      setPrintData({
        doctorName: doctorObj?.name || (latestAppt as any)?.doctorName || patient.lastDoctorName,
        department: doctorObj?.specialization || 'General Medicine',
        date: latestAppt?.date || patient.lastBookingAt || patient.lastVisitAt,
        patientName: latestAppt?.patientName || patient.name,
        tokenNumber: latestAppt?.tokenNumber,
        opNumber: latestAppt?.tokenNumber
          ? `OP-${String(latestAppt.tokenNumber).padStart(6, '0')}`
          : undefined,
        age: latestAppt?.patientAge ?? patient.age,
        gender: (latestAppt as any)?.patientGender || patient.gender,
        phone: latestAppt?.patientPhone || patient.phone,
        place: (latestAppt as any)?.place || patient.place || patient.address,
        address: patient.address,
      });
    } catch {
      setPrintData({
        doctorName: patient.lastDoctorName,
        department: 'General Medicine',
        date: patient.lastBookingAt || patient.lastVisitAt,
        patientName: patient.name,
        tokenNumber: 1,
        opNumber: 'OP-000001',
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        place: patient.place || patient.address,
        address: patient.address,
      });
    }
  };

  // Live search suggestion state
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [debouncedSuggestion, setDebouncedSuggestion] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Debounce for live search suggestions (180ms delay for quick suggestions without over-fetching)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSuggestion(searchInput.trim());
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Click outside listener to dismiss the suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live suggestions scoped to this facility when query is non-empty and dropdown is active
  const suggestionsQuery = useFacilityPatients(
    {
      search: debouncedSuggestion || undefined,
      limit: 8,
    },
    showDropdown && Boolean(debouncedSuggestion && debouncedSuggestion.length >= 1),
  );

  const suggestions = suggestionsQuery.data?.items ?? [];

  const selectSuggestion = (patient: FacilityPatientDto) => {
    setShowDropdown(false);
    setSearchInput(patient.name);
    navigate(APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') {
        setSearch(searchInput.trim());
        setPage(1);
        setShowDropdown(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        selectSuggestion(suggestions[highlightIndex]);
      } else {
        setSearch(searchInput.trim());
        setPage(1);
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { fromDate, toDate } = useMemo(
    () => monthBounds(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  const patientsQuery = useFacilityPatients({
    search: search || undefined,
    fromDate,
    toDate,
    page,
    limit: 20,
    bookingType: statusFilter === 'online' ? 'online' : statusFilter === 'offline' ? 'offline' : undefined,
    patientType: statusFilter === 'registered' ? 'registered' : undefined,
    status: statusFilter === 'cancelled' ? 'cancelled' : undefined,
    refundStatus: statusFilter === 'pending' ? 'pending' : undefined,
    dayOfWeek: dayOfWeekFilter === 'all' ? undefined : dayOfWeekFilter,
  });

  const pageData = patientsQuery.data;
  const patients = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const stats = pageData?.stats;
  const totals = pageData?.totals;

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = year; y >= year - 5; y -= 1) years.push(y);
    return years;
  }, [year]);

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const grouped = useMemo(() => {
    const map = new Map<string, FacilityPatientDto[]>();
    for (const patient of patients) {
      const key = dayKey(patient.lastBookingAt);
      const list = map.get(key) ?? [];
      list.push(patient);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [patients]);

  const exportExcelDocument = () => {
    if (patients.length === 0) {
      showToast('No patients to export', 'error');
      return;
    }

    // Use the application's official company name so Search Patient exports remain consistent with the rest of AarohaCare.
    const title = `${APP.NAME} — Facility Patient Directory & Refunds Record`;
    const dateStr = new Date().toLocaleDateString();

    const headers = [
      'Patient Name',
      'Mobile Phone',
      'Refund Mobile Phone',
      'Refund UPI ID',
      'Age',
      'Gender',
      'Patient ID',
      'Last Visit Date',
      'Total Bookings',
      'Latest OP Booking Status',
      'Refund Status',
      'Pending Refund Amount (INR)',
    ];

    const xmlRows = patients
      .map((p) => {
        const refundAmt = p.pendingRefundAmount || p.lastRefundAmount || 0;
        const refundPhone = p.lastRefundPhone ? `+91 ${p.lastRefundPhone}` : p.phone;
        const refundUpi = p.lastRefundUpiId || 'N/A';

        return `
      <Row>
        <Cell><Data ss:Type="String">${toTitleCase(p.name)}</Data></Cell>
        <Cell><Data ss:Type="String">${p.phone}</Data></Cell>
        <Cell><Data ss:Type="String">${refundPhone}</Data></Cell>
        <Cell><Data ss:Type="String">${refundUpi}</Data></Cell>
        <Cell><Data ss:Type="String">${p.age != null ? String(p.age) : ''}</Data></Cell>
        <Cell><Data ss:Type="String">${formatGender(p.gender)}</Data></Cell>
        <Cell><Data ss:Type="String">#${patientDisplayId(p._id, { healthCardId: p.healthCardId })}</Data></Cell>
        <Cell><Data ss:Type="String">${getPatientLastVisit(p) ? formatConsultDate(getPatientLastVisit(p)) : (isNewPatientBooking(p) ? 'New Patient' : '—')}</Data></Cell>
        <Cell><Data ss:Type="Number">${p.bookingCount}</Data></Cell>
        <Cell><Data ss:Type="String">${getLatestOpStatus(p)}</Data></Cell>
        <Cell><Data ss:Type="String">${getRefundStatus(p) || '—'}</Data></Cell>
        <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${refundAmt}</Data></Cell>
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
<Worksheet ss:Name="Patients List">
<Table>
  <Row ss:Height="24">
    <Cell ss:MergeAcross="11" ss:StyleID="TitleStyle"><Data ss:Type="String">${title} (${dateStr})</Data></Cell>
  </Row>
  <Row ss:Height="20">
    <Cell><Data ss:Type="String">Month: ${selectedMonth === 'all' ? 'All Months' : MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</Data></Cell>
    <Cell><Data ss:Type="String">Total Patients: ${patients.length}</Data></Cell>
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
    link.download = `patient-directory-${selectedYear}-${selectedMonth === 'all' ? 'all-months' : pad2(selectedMonth)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Patient Directory Excel spreadsheet downloaded!', 'success');
  };

  const exportPdfDocument = () => {
    if (patients.length === 0) {
      showToast('No patients to export', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Pop-up blocked. Please allow pop-ups to print or save PDF.', 'error');
      return;
    }

    const tableRows = patients
      .map((p) => {
        const opStatus = getLatestOpStatus(p);
        const refundStatus = getRefundStatus(p);
        const refundAmt = p.pendingRefundAmount || p.lastRefundAmount || 0;
        const refundPhone = p.lastRefundPhone ? `+91 ${p.lastRefundPhone}` : p.phone;
        const refundUpi = p.lastRefundUpiId || 'N/A';

        return `
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">
            <strong>${toTitleCase(p.name)}</strong><br/>
            <small style="color: #64748b;">ID: #${patientDisplayId(p._id, { healthCardId: p.healthCardId })}</small>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${p.phone}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">
            📱 ${refundPhone}<br/>
            <strong style="color: #0c4a6e;">⚡ ${refundUpi}</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${p.age != null ? p.age : '—'} / ${formatGender(p.gender)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${getPatientLastVisit(p) ? formatConsultDate(getPatientLastVisit(p)) : (isNewPatientBooking(p) ? '<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; background: #e0f2fe; color: #0369a1;">New Patient</span>' : '—')}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">
            <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: bold; ${opStatus === 'Completed' ? 'background: #dcfce7; color: #15803d;' : opStatus === 'Cancelled' ? 'background: #ffe4e6; color: #be123c;' : 'background: #fef3c7; color: #b45309;'}">
              ${opStatus}
            </span>
            ${refundStatus ? `
              <div style="margin-top: 4px;">
                <span style="font-size: 10px; padding: 1px 5px; border-radius: 4px; font-weight: 600; ${refundStatus === 'Refunded' ? 'background: #dcfce7; color: #15803d;' : 'background: #fef3c7; color: #b45309;'}">
                  ${refundStatus}
                </span>
              </div>
            ` : ''}
          </td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #b45309; text-align: right;">
            ₹${refundAmt}
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
          <title>${APP.NAME} Patient Directory Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0b2a4a; padding-bottom: 16px; margin-bottom: 20px; }
            .logo { font-size: 22px; font-weight: 800; color: #0b2a4a; }
            .sub { font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #0b2a4a; color: white; padding: 10px; border: 1px solid #0b2a4a; text-align: left; font-size: 11px; }
            .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">AAROHCARE TELEHEALTH</div>
              <div class="sub">Patient Directory & Cancellation Statement (${selectedMonth === 'all' ? 'All Months' : MONTH_NAMES[selectedMonth - 1]} ${selectedYear})</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #475569;">
              <strong>Report Date:</strong> ${new Date().toLocaleDateString()}<br/>
              <strong>Facility Admin Portal</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Patient Name & ID</th>
                <th>Phone Number</th>
                <th>Refund Phone & UPI ID</th>
                <th>Age / Gender</th>
                <th>Last Visit</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: right;">Pending Refund</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            <!-- Use the application's official company name so Search Patient exports remain consistent with the rest of AarohaCare. -->
            <div>${APP.NAME} Platform — Patient Directory Statement</div>
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
    showToast('Patient Directory PDF Statement generated!', 'success');
  };

  const onDeleteClick = (name: string) => {
    sweetAlert.confirm(
      'Delete not available',
      `${toTitleCase(name)} cannot be removed from Search Patients. Cancel individual bookings from Queue or patient detail instead.`,
      () => undefined,
      { tone: 'info', confirmText: 'Got it', cancelText: 'Close' },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
      <div className="flex items-center justify-end">
        <NotificationBell />
      </div>

      <div className="rounded-2xl border border-[#E5EAF0] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#0B2A4A]">
              <IconCalendar width={28} height={28} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight text-[#0B2A4A] sm:text-[24px]">
                Total Booking
              </h1>
              <p className="mt-1 text-[13.5px] leading-snug text-[#64748B]">
                Overview of all patient appointments and scheduling activity.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-[36px] font-bold leading-none tracking-tight text-[#0B2A4A] sm:text-[40px]">
              {/* Ensure Total Booking follows the selected Year + Month + Day scope by using stats branch */}
              {formatNumber(stats?.confirmedBookings ?? 0)}
            </p>
            <p className="mt-1.5 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8]">
              CONFIRMED BOOKINGS
            </p>
          </div>
        </div>
      </div>

      <div ref={searchContainerRef} className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16.5 16.5 21 21" />
          </svg>
        </span>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setShowDropdown(true);
            setHighlightIndex(0);
          }}
          onFocus={() => {
            if (searchInput.trim().length >= 1) {
              setShowDropdown(true);
            }
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search patients by name, phone, or ID..."
          className="w-full rounded-2xl border border-[#E5EAF0] bg-white py-3.5 pl-12 pr-12 text-[14.5px] text-[#0F172A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none placeholder:text-[#94A3B8] focus:border-[#0B2A4A]/35 focus:ring-2 focus:ring-[#0B2A4A]/10"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8]">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </span>

        {/* Live Patient Search Suggestions Dropdown Overlay */}
        {showDropdown && searchInput.trim().length >= 1 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-[380px] overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-2xl">
            {suggestionsQuery.isLoading ? (
              <div className="flex items-center justify-center p-5 text-[13px] text-[#64748B]">
                <Spinner label="Searching matching patients…" />
              </div>
            ) : suggestionsQuery.isError ? (
              <div className="p-4 text-center text-[13px] text-red-600">
                Failed to load patient suggestions.
              </div>
            ) : suggestions.length > 0 ? (
              <div>
                <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  <span>Matching Patients ({suggestions.length})</span>
                  <span className="text-[10px] font-medium text-slate-400">↑↓ to navigate · ↵ to select</span>
                </div>
                <div className="space-y-1">
                  {suggestions.map((patient, idx) => {
                    const displayId = patientDisplayId(patient._id, { healthCardId: patient.healthCardId });
                    return (
                      <button
                        key={patient._id}
                        type="button"
                        onClick={() => selectSuggestion(patient)}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={`flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-left transition ${
                          highlightIndex === idx
                            ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <PatientAvatar name={patient.name} image={patient.profileImage} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[14.5px] font-bold text-[#0F172A]">
                              {toTitleCase(patient.name)}
                            </p>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              {displayId}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[#64748B]">
                            <span className="font-semibold text-[#2563EB]">
                              {patient.phone || '—'}
                            </span>
                            {patient.age != null && (
                              <span>· Age {patient.age}</span>
                            )}
                            {patient.gender && (
                              <span>· {formatGender(patient.gender)}</span>
                            )}
                            {patient.place && (
                              <span>· {patient.place}</span>
                            )}
                            {patient.bookingCount != null && (
                              <span className="ml-auto text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                                {patient.bookingCount} visit{patient.bookingCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-5 text-center text-[13.5px] text-slate-500">
                No matching patients found for "{searchInput.trim()}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top summary card: Displays total unique patients in facility scope */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E5EAF0] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#0B2A4A]">
            <IconUsers width={22} height={22} />
          </div>
          <div>
            <p className="text-[12px] font-bold tracking-[0.06em] text-[#64748B]">ALL PATIENTS</p>
            <p className="text-[28px] font-bold leading-none text-[#0B2A4A]">
              {formatNumber(stats?.allPatients ?? totals?.allUsers ?? 0)}
            </p>
          </div>
        </div>
        {/* Replace the old Cancelled OP/User Directory actions with a single entry point to keep Search Patients focused and reduce duplicate navigation options. */}
        {/* Reuse the existing Cancelled OP route so the new card opens the established refund and cancellation workflow without duplicating functionality. */}
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.ADMIN.PATIENT_CANCELLED)}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-[#E5EAF0] bg-white px-5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:shadow-sm active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition group-hover:bg-rose-100">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-[14px] font-bold text-[#0F172A]">Cancelled OP</p>
            </div>
          </div>
          <div className="text-[#94A3B8] transition group-hover:text-[#64748B]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative inline-flex">
          <span className="sr-only">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setPage(1);
            }}
            className="appearance-none rounded-xl border border-[#E5EAF0] bg-white py-3 pl-4 pr-10 text-[15px] font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </label>

        <label className="relative inline-flex">
          <span className="sr-only">Day</span>
          <select
            value={dayOfWeekFilter}
            onChange={(e) => {
              const val = e.target.value;
              setDayOfWeekFilter(val === 'all' ? 'all' : Number(val));
              setPage(1);
            }}
            className="appearance-none rounded-xl border border-[#E5EAF0] bg-white py-2.5 pl-3.5 pr-9 text-[13.5px] font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none"
          >
            <option value="all">Day</option>
            <option value="2">Monday</option>
            <option value="3">Tuesday</option>
            <option value="4">Wednesday</option>
            <option value="5">Thursday</option>
            <option value="6">Friday</option>
            <option value="7">Saturday</option>
            <option value="1">Sunday</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedMonth('all');
              setPage(1);
            }}
            className={[
              'rounded-xl px-5 py-2.5 text-[15px] font-semibold transition',
              selectedMonth === 'all'
                ? 'bg-[#0B2A4A] text-white shadow-[0_8px_18px_-10px_rgba(11,42,74,0.55)]'
                : 'bg-transparent text-[#64748B] hover:bg-white hover:text-[#0F172A]',
            ].join(' ')}
          >
            All Months
          </button>
          {months.map((m) => {
            const active = m === selectedMonth;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSelectedMonth(m);
                  setPage(1);
                }}
                className={[
                  'rounded-xl px-5 py-2.5 text-[15px] font-semibold transition',
                  active
                    ? 'bg-[#0B2A4A] text-white shadow-[0_8px_18px_-10px_rgba(11,42,74,0.55)]'
                    : 'bg-transparent text-[#64748B] hover:bg-white hover:text-[#0F172A]',
                ].join(' ')}
              >
                {MONTH_NAMES[m - 1]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Admin Patients metric cards grid: Consumes canonical statistics returned by the backend */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="ALL PATIENTS"
          value={stats?.allPatients ?? stats?.allUsers ?? 0}
          active={statusFilter === 'all'}
          onClick={() => {
            setStatusFilter('all');
            setPage(1);
          }}
          iconBg="bg-[#EEF4FF]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0B2A4A" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5 19c1.4-3.4 3.8-5 7-5s5.6 1.6 7 5" />
            </svg>
          }
        />
        <StatCard
          label="ONLINE"
          value={stats?.onlineBookings ?? 0}
          active={statusFilter === 'online'}
          onClick={() => {
            setStatusFilter('online');
            setPage(1);
          }}
          iconBg="bg-[#DCFCE7]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#15803D" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <path d="M3 12h18M12 4c2.5 2.8 2.5 13.2 0 16M12 4c-2.5 2.8-2.5 13.2 0 16" />
            </svg>
          }
        />
        <StatCard
          label="OFFLINE"
          value={stats?.offlineBookings ?? 0}
          active={statusFilter === 'offline'}
          onClick={() => {
            setStatusFilter('offline');
            setPage(1);
          }}
          iconBg="bg-[#E0F2FE]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0369A1" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 19c1.2-3.2 3.6-4.7 6.5-4.7S17.8 15.8 19 19" />
            </svg>
          }
        />
        <StatCard
          label="REGISTERED"
          value={stats?.registeredUsers ?? stats?.registered ?? 0}
          active={statusFilter === 'registered'}
          onClick={() => {
            setStatusFilter('registered');
            setPage(1);
          }}
          iconBg="bg-[#E0E7FF]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4338CA" strokeWidth="1.8">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          }
        />
        <StatCard
          label="CANCELLED"
          value={stats?.cancelled ?? 0}
          active={statusFilter === 'cancelled'}
          onClick={() => {
            setStatusFilter('cancelled');
            setPage(1);
          }}
          iconBg="bg-[#FFE4E6]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#BE123C" strokeWidth="1.8">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          }
        />
        <StatCard
          label="REFUND PENDING"
          value={stats?.pendingRefunds ?? 0}
          active={statusFilter === 'pending'}
          onClick={() => {
            setStatusFilter('pending');
            setPage(1);
          }}
          hint={
            stats?.pendingRefundAmount
              ? `₹${formatNumber(stats.pendingRefundAmount)}`
              : undefined
          }
          iconBg="bg-[#FEF3C7]"
          icon={
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#B45309" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportExcelDocument}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            📊 Export Excel (.xls)
          </button>
          <button
            type="button"
            onClick={exportPdfDocument}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2A4A] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-900"
          >
            📄 Print / Save PDF
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex flex-col gap-4">
        {patientsQuery.isLoading && <Spinner label="Loading patients…" />}

        {!patientsQuery.isLoading && patientsQuery.isError && (
          <div className="rounded-2xl border border-[#FECACA] bg-white px-5 py-4 text-[#DC2626]">
            {getApiErrorMessage(patientsQuery.error)}
          </div>
        )}

        {!patientsQuery.isLoading && !patientsQuery.isError && patients.length === 0 && (
          <div className="rounded-2xl border border-[#E5EAF0] bg-white px-5 py-8 text-center text-[#64748B]">
            No patients match these filters.
          </div>
        )}

        {!patientsQuery.isLoading &&
          !patientsQuery.isError &&
          grouped.map(([key, rows]) => (
            <div key={key} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#E5EAF0]" />
                <span className="shrink-0 text-[11.5px] font-bold tracking-[0.08em] text-black">
                  {key === 'unknown' ? 'UNKNOWN DATE' : formatDayDivider(rows[0].lastBookingAt!)}
                </span>
                <div className="h-px flex-1 bg-[#E5EAF0]" />
              </div>

              {rows.map((patient) => {
                const opStatus = getLatestOpStatus(patient);
                const isRefundPending = hasPendingRefundStatus(patient);

                // Registered-filter card: show the registered account's name, phone, age,
                // and their Total OP (app-booked appointments only = onlineBookingCount).
                // Support clicking the card to view patient details / booking history using the same route as standard patient cards.
                if (statusFilter === 'registered') {
                  return (
                    <div
                      key={patient._id}
                      onClick={() => navigate(APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id))}
                      className="flex flex-col gap-3 rounded-2xl border border-[#E5EAF0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:gap-4 sm:px-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition"
                    >
                      {/* Left section: registered account avatar, name, phone, and print icon on right side of patient field */}
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <PatientAvatar name={patient.name} image={patient.profileImage} />
                          <div className="min-w-0">
                            <Link
                              to={APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id)}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate text-[15px] font-bold text-[#0B2A4A] hover:underline"
                            >
                              {toTitleCase(patient.name)}
                            </Link>
                            <p className="truncate text-[13px] text-[#64748B]">{patient.phone}</p>
                          </div>
                        </div>

                        {/* Print OP Consultation Form Icon - placed on the right side of the patient field */}
                        <button
                          type="button"
                          aria-label="Print OP Form"
                          title="Print OP Form"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPatient(patient);
                          }}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1E4287] bg-white text-[#1E4287] shadow-xs transition hover:bg-blue-50/70 active:scale-95"
                        >
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>
                      </div>

                      {/* Right section: Age, Total OP (app bookings only), and Delete button */}
                      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-end sm:gap-6">
                        <div className="w-[64px] shrink-0">
                          <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">AGE</p>
                          <p className="text-[15px] font-bold text-[#0F172A]">
                            {patient.age != null ? patient.age : '—'}
                          </p>
                        </div>
                        {/* Total OP counts only mobile-app bookings (time !== 'QUEUE') for this registered account.
                            Offline/admin-created bookings are excluded, matching the specification. */}
                        <div className="w-[100px] shrink-0">
                          <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">TOTAL OP</p>
                          <p className="text-[15px] font-bold text-[#0F172A]">
                            {patient.onlineBookingCount ?? 0}
                          </p>
                        </div>
                        {/* Retain delete button with identical styling and confirmation behavior as other filters */}
                        <div className="col-span-2 w-[44px] shrink-0 flex items-center justify-end sm:col-span-1">
                          <button
                            type="button"
                            aria-label="Delete patient"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteClick(patient.name);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M4 7h16" />
                              <path d="M9 7V5h6v2" />
                              <path d="M7 7l1 12h8l1-12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  // Make the entire patient card clickable so users can open patient details from any area of the card.
                  <div
                    key={patient._id}
                    onClick={() => navigate(APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id))}
                    className="flex flex-col gap-3 rounded-2xl border border-[#E5EAF0] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:gap-4 sm:px-5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition"
                  >
                    {/* Patient Field: Avatar, Name, Phone, Doctor, and Print OP Form Icon on the right side */}
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <PatientAvatar name={patient.name} image={patient.profileImage} />
                        <div className="min-w-0">
                          <Link
                            to={APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate text-[15px] font-bold text-[#0B2A4A] hover:underline"
                          >
                            {toTitleCase(patient.name)}
                          </Link>
                          <p className="truncate text-[13px] text-[#64748B]">{patient.phone}</p>
                          {/* Display the doctor associated with the OP booking for all patient cards. */}
                          <p className="mt-0.5 truncate text-[12px] font-medium text-[#0369A1]">
                            {patient.lastDoctorName
                              ? `Dr. ${toTitleCase(patient.lastDoctorName.replace(/^dr\.?\s*/i, ''))}`
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Print OP Consultation Form Icon - placed on right side of patient field */}
                      <button
                        type="button"
                        aria-label="Print OP Form"
                        title="Print OP Form"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintPatient(patient);
                        }}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1E4287] bg-white text-[#1E4287] shadow-xs transition hover:bg-blue-50/70 active:scale-95"
                      >
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9" />
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                      </button>
                    </div>

                    {/* Display consistent field structure across all patient cards: Age, Last Visit, Booking Type, and Status */}
                    <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-end sm:gap-6">
                      <div className="w-[64px] shrink-0">
                        <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">AGE</p>
                        <p className="text-[15px] font-bold text-[#0F172A]">
                          {patient.age != null ? patient.age : '—'}
                        </p>
                      </div>
                      <div className="w-[120px] shrink-0">
                        <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">
                          LAST VISIT
                        </p>
                        {isNewPatientBooking(patient) ? (
                          <span className="mt-0.5 inline-flex items-center rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0369A1]">
                            New Patient
                          </span>
                        ) : (
                          <p className="text-[14px] font-bold text-[#0F172A]">
                            {formatLastVisitLong(getPatientLastVisit(patient))}
                          </p>
                        )}
                      </div>
                      <div className="w-[140px] shrink-0">
                        <p className="text-[10.5px] font-bold tracking-[0.06em] text-[#94A3B8]">
                          BOOKING TYPE
                        </p>
                        <p className="text-[14px] font-bold text-[#0F172A]">
                          {getPatientBookingType(patient)}
                        </p>
                      </div>
                      {/* Status column: Displays the status of the patient's most recent OP booking (Pending, Completed, or Cancelled) and refund status directly beneath it if applicable */}
                      <div className="col-span-2 min-h-[32px] w-[140px] shrink-0 sm:col-span-1 sm:flex sm:flex-col sm:items-center sm:justify-center">
                        <span
                          className={[
                            'inline-flex rounded-full px-3 py-1 text-[12px] font-semibold',
                            opStatusBadgeClass(opStatus),
                          ].join(' ')}
                        >
                          {opStatus}
                        </span>
                        {/* Distinguish secondary statuses: Patient Not Arrived only for Auto Cancelled / unconsulted cancelled appointments, Refund Pending only for Cancelled appointments with active refund */}
                        {opStatus === 'Auto Cancelled' ||
                        (opStatus === 'Cancelled' &&
                          (patient.lastCancellationReason === 'PATIENT_NOT_ARRIVED' ||
                            patient.lastCancellationReason === 'Patient Not Arrived')) ? (
                          <PatientNotArrivedBadge className="mt-1" />
                        ) : opStatus === 'Cancelled' && isRefundPending ? (
                          <span className="mt-1 inline-block text-[11px] font-bold text-[#DC2626] whitespace-nowrap tracking-tight leading-none">
                            Refund Pending
                          </span>
                        ) : null}
                      </div>
                      <div className="col-span-2 w-[72px] shrink-0 flex items-center justify-end gap-1 sm:col-span-1">
                        <button
                          type="button"
                          aria-label="Delete patient"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(patient.name);
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#FEE2E2] hover:text-[#DC2626]"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M4 7h16" />
                            <path d="M9 7V5h6v2" />
                            <path d="M7 7l1 12h8l1-12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label="View patient"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id));
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#EEF4FF] hover:text-[#0B2A4A]"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path d="M9 6l6 6-6 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {!patientsQuery.isLoading && !patientsQuery.isError && patients.length > 0 && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0B2A4A] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-[13px] text-[#64748B]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0B2A4A] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Render dedicated A4 OP Consultation Form print overlay when a patient appointment is selected */}
      {printData && (
        <OpConsultationPrintForm
          data={printData}
          onClose={() => setPrintData(null)}
        />
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon,
  iconBg,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconBg: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left transition-all duration-150',
      active
        ? 'border-[#0B2A4A] bg-[#F4F8FD] ring-2 ring-[#0B2A4A] shadow-md -translate-y-0.5'
        : 'border-[#E5EAF0] hover:border-[#94A3B8] hover:shadow-md hover:-translate-y-0.5',
    ].join(' ')}
  >
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between">
        <p className="text-[26px] font-bold leading-none text-[#0F172A]">{formatNumber(value)}</p>
        {active ? (
          <span className="h-2 w-2 rounded-full bg-[#0B2A4A]" title="Active filter" />
        ) : null}
      </div>
      <p className="mt-1.5 text-[12px] font-bold tracking-[0.05em] text-[#94A3B8]">{label}</p>
      {hint ? <p className="mt-1 text-[12px] font-semibold text-[#B45309]">{hint}</p> : null}
    </div>
  </button>
);
