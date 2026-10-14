import { useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { BackButton } from '@/components/ui/BackButton';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useFacilityPatientDetail, useMarkAppointmentRefunded } from '@/hooks/useAppointments';
import { useAuth } from '@/hooks/useAuth';
import { todayIsoIst } from '@/utils/dateTime';
import { toTitleCase } from '@/utils/formatters';
import type { AppointmentResponseDto, DoctorResponseDto } from '@/types/dto';
import {
  OpConsultationPrintForm,
  type OpConsultationFormData,
} from '@/components/print/OpConsultationPrintForm';
import { AppointmentDetailsModal } from '../components/AppointmentDetailsModal';
import {
  formatConsultDate,
  formatConsultDateTime,
  initialsOf,
} from '../utils';

const asDoctor = (value: AppointmentResponseDto['doctorId']): DoctorResponseDto | null => {
  if (!value || typeof value === 'string') return null;
  return value;
};

const doctorLabel = (doctor: DoctorResponseDto | null) => {
  if (!doctor?.name) return 'Doctor';
  const titled = toTitleCase(doctor.name.replace(/^dr\.?\s*/i, ''));
  return `Dr. ${titled}`;
};

const parseApptDate = (appt: AppointmentResponseDto) => {
  // Prefer appointment calendar date (IST business date).
  if (appt.date && /^\d{4}-\d{2}-\d{2}$/.test(appt.date)) {
    return new Date(`${appt.date}T12:00:00`);
  }
  if (appt.createdAt) return new Date(appt.createdAt);
  return null;
};

const dayDividerLabel = (appt: AppointmentResponseDto) => {
  const d = parseApptDate(appt);
  if (!d || Number.isNaN(d.getTime())) return 'UNKNOWN DATE';
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const dayKey = (appt: AppointmentResponseDto) => appt.date || appt.createdAt?.slice(0, 10) || 'unknown';

const isUpcoming = (appt: AppointmentResponseDto, today: string) =>
  appt.status !== 'CANCELLED' &&
  appt.status !== 'COMPLETED' &&
  Boolean(appt.date) &&
  appt.date >= today;

const statusMeta = (appt: AppointmentResponseDto) => {
  if (appt.status === 'COMPLETED') {
    return {
      tone: 'success' as const,
      label: 'Consulted',
      card: 'border-[#BBF7D0] bg-[#F0FDF4]',
      badge: 'bg-[#16A34A] text-white',
    };
  }
  if (appt.status === 'CANCELLED') {
    const isAuto =
      appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
      appt.cancellationReason === 'Patient Not Arrived';
    if (isAuto) {
      return {
        tone: 'danger' as const,
        label: 'Auto Cancelled',
        card: 'border-[#FECACA] bg-[#FEF2F2]',
        badge: 'bg-[#DC2626] text-white',
      };
    }
    const refunded = Boolean(appt.cancellation?.refunded);
    const pending = !refunded;
    return {
      tone: 'danger' as const,
      label: refunded
        ? 'Cancelled: Refunded'
        : pending
          ? 'Cancelled: Refund pending'
          : 'Cancelled',
      card: 'border-[#FECACA] bg-[#FEF2F2]',
      badge: refunded ? 'bg-[#16A34A] text-white' : 'bg-[#DC2626] text-white',
    };
  }
  if (appt.status === 'CONSULTING') {
    return {
      tone: 'info' as const,
      label: 'Consulting',
      card: 'border-[#BFDBFE] bg-[#EFF6FF]',
      badge: 'bg-[#0B2A4A] text-white',
    };
  }
  return {
    tone: 'info' as const,
    label: 'Upcoming',
    card: 'border-[#E5EAF0] bg-white',
    badge: 'bg-[#0B2A4A] text-white',
  };
};

export const PatientDetailPage = () => {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const detail = useFacilityPatientDetail(patientId);
  const markRefunded = useMarkAppointmentRefunded();
  const today = todayIsoIst();
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppointmentResponseDto['status']>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentResponseDto | null>(null);
  const [printData, setPrintData] = useState<OpConsultationFormData | null>(null);

  const appointments = detail.data?.appointments ?? [];
  const patient = detail.data?.patient;

  const handlePrintAppt = (appt: AppointmentResponseDto) => {
    const doctor = asDoctor(appt.doctorId);
    setPrintData({
      doctorName: doctor?.name,
      department: doctor?.specialization || 'General Medicine',
      date: appt.date,
      patientName: patient?.name,
      tokenNumber: appt.tokenNumber,
      opNumber: appt.tokenNumber ? `OP-${String(appt.tokenNumber).padStart(6, '0')}` : undefined,
      age: patient?.age,
      gender: patient?.gender,
      phone: patient?.phone,
      place: patient?.place || patient?.address,
    });
  };

  const handleMarkRefunded = (appointmentId: string) => {
    sweetAlert.confirm(
      'Mark refund completed?',
      'Confirm that the cancellation refund was completed for this patient.',
      () => {
        markRefunded.mutate(
          { appointmentId, refunded: true },
          {
            onSuccess: () => {
              showToast('Marked as refunded', 'success');
              setSelectedAppointment(null);
            },
            onError: (err) => showToast(getApiErrorMessage(err), 'error'),
          },
        );
      },
      { confirmText: 'Mark refunded', cancelText: 'Cancel', tone: 'warning' },
    );
  };

  const nextConsultation = useMemo(
    () =>
      appointments
        .filter((a) => isUpcoming(a, today))
        .sort((a, b) => a.date.localeCompare(b.date) || String(a.tokenNumber).localeCompare(String(b.tokenNumber)))[0] ??
      null,
    [appointments, today],
  );

  const filteredAppointments = useMemo(() => {
    const list =
      statusFilter === 'ALL' ? appointments : appointments.filter((a) => a.status === statusFilter);
    return [...list].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da !== db) return db.localeCompare(da);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [appointments, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentResponseDto[]>();
    for (const appt of filteredAppointments) {
      const key = dayKey(appt);
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filteredAppointments]);

  const downloadHistory = () => {
    if (!patient || appointments.length === 0) {
      showToast('No consultation history to download', 'error');
      return;
    }
    const rows = [
      ['Date', 'Doctor', 'Specialization', 'OP', 'Type', 'Status', 'Cancelled At', 'Refunded'],
      ...appointments.map((a) => {
        const doctor = asDoctor(a.doctorId);
        return [
          a.date,
          doctorLabel(doctor),
          doctor?.specialization || '',
          a.tokenNumber ?? '',
          a.time === 'QUEUE' ? 'Offline' : 'Online',
          a.status,
          a.cancelledAt || '',
          a.cancellation?.refunded ? 'Yes' : '',
        ];
      }),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${patient.phone}-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Download started');
  };

  const onBlockPatient = () => {
    if (!patient) return;
    sweetAlert.confirm(
      'Block patient?',
      `Blocking ${toTitleCase(patient.name)} will prevent future bookings at your facility. This control is not enabled yet — cancel active tokens from Queue for now.`,
      () => showToast('Block patient will be available in a coming update', 'error'),
      { tone: 'danger', confirmText: 'Understood', cancelText: 'Close' },
    );
  };

  if (detail.isLoading) {
    return <Spinner label="Loading patient…" />;
  }

  if (detail.isError || !detail.data || !patient) {
    return (
      <div className="mx-auto max-w-[1280px] rounded-2xl border border-[#FECACA] bg-white p-6">
        <p className="text-[#DC2626]">{getApiErrorMessage(detail.error)}</p>
        <BackButton to={APP_ROUTES.ADMIN.PATIENTS} className="mt-4">
          Back to patients
        </BackButton>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton to={APP_ROUTES.ADMIN.PATIENTS} size="sm">
            Patient Details
          </BackButton>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={downloadHistory}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0B2A4A] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(11,42,74,0.55)] transition hover:bg-[#163A5F]"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 4v10" />
              <path d="M8 10l4 4 4-4" />
              <path d="M5 18h14" />
            </svg>
            Download
          </button>
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

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Profile card */}
        <aside className="rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {patient.profileImage ? (
                <img
                  src={patient.profileImage}
                  alt={patient.name}
                  className="h-28 w-28 rounded-full object-cover ring-4 ring-[#EEF4FF]"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#DBEAFE] text-[28px] font-bold text-[#1D4ED8] ring-4 ring-[#EEF4FF]">
                  {initialsOf(patient.name)}
                </div>
              )}
              <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#16A34A] text-white ring-2 ring-white">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m5 12 4.5 4.5L19 7" />
                </svg>
              </span>
            </div>
            <h2 className="mt-4 text-[22px] font-bold tracking-tight text-[#0F172A]">
              {toTitleCase(patient.name)}
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-[#64748B]">
              Mobile: {patient.phone}
            </p>
          </div>

          <ul className="mt-6 space-y-4 border-t border-[#EEF2F6] pt-5 text-left">
            <DetailRow
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 21s7-4.4 7-10a7 7 0 1 0-14 0c0 5.6 7 10 7 10Z" />
                  <circle cx="12" cy="11" r="2.5" />
                </svg>
              }
              label={patient.place || '—'}
            />
            <DetailRow
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6.5 4.5h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A14.5 14.5 0 0 1 4.5 6.5a2 2 0 0 1 2-2Z" />
                </svg>
              }
              label={patient.phone}
            />
            <DetailRow
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5 19c1.4-3.4 3.8-5 7-5s5.6 1.6 7 5" />
                </svg>
              }
              label={patient.age != null ? `${patient.age} Years` : '—'}
            />
            <DetailRow
              icon={
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 9.5 12 4l8 5.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5Z" />
                  <path d="M9 21v-7h6v7" />
                </svg>
              }
              label={patient.address || patient.place || '—'}
            />
          </ul>

          <div className="mt-8">
            <button
              type="button"
              onClick={onBlockPatient}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-4 py-3 text-[14px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(220,38,38,0.55)] transition hover:bg-[#B91C1C]"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="8" />
                <path d="M7.5 7.5l9 9" />
              </svg>
              Block Patient
            </button>
            <p className="mt-2 text-center text-[12px] text-[#94A3B8]">
              Blocking prevents future bookings.
            </p>
          </div>
        </aside>

        {/* Consultation history */}
        <section className="flex min-w-0 flex-col gap-4">
          {nextConsultation ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0B2A4A] px-5 py-4 text-white shadow-[0_12px_28px_-16px_rgba(11,42,74,0.7)] sm:px-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                    <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
                  </svg>
                </span>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                    Next Consultation
                  </p>
                  <p className="text-[20px] font-bold leading-tight">
                    {formatConsultDate(nextConsultation.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  title="Print OP Consultation Form"
                  aria-label="Print OP Consultation Form"
                  onClick={() => handlePrintAppt(nextConsultation)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white shadow-xs transition hover:bg-white/25 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </button>
                <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-[3px] border-white/85 bg-white/10">
                  <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-white/75">
                    Token
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-white/75">
                    Number
                  </span>
                  <span className="text-[22px] font-bold leading-none">
                    {nextConsultation.tokenNumber || '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5EAF0] bg-white px-5 py-4 text-[14px] text-[#64748B]">
              No upcoming consultation scheduled.
            </div>
          )}

          <div className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[18px] font-bold text-[#0F172A]">Consultation Details</h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0B2A4A] transition hover:bg-[#F8FAFC]"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 6h16M7 12h10M10 18h4" />
                  </svg>
                  Filter
                </button>
                {filterOpen ? (
                  <div className="absolute right-0 z-10 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-[#E5EAF0] bg-white py-1 shadow-lg">
                    {(
                      [
                        ['ALL', 'All'],
                        ['COMPLETED', 'Consulted'],
                        ['PENDING', 'Upcoming'],
                        ['CONSULTING', 'Consulting'],
                        ['CANCELLED', 'Cancelled'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setStatusFilter(value);
                          setFilterOpen(false);
                        }}
                        className={[
                          'block w-full px-3.5 py-2 text-left text-[13px] font-semibold',
                          statusFilter === value
                            ? 'bg-[#EEF4FF] text-[#0B2A4A]'
                            : 'text-[#334155] hover:bg-[#F8FAFC]',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {grouped.length === 0 ? (
              <p className="py-8 text-center text-[14px] text-[#64748B]">No consultations match this filter.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {grouped.map(([key, rows]) => (
                  <div key={key} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#E5EAF0]" />
                      <span className="text-[11.5px] font-bold tracking-[0.08em] text-black">
                        {dayDividerLabel(rows[0])}
                      </span>
                      <div className="h-px flex-1 bg-[#E5EAF0]" />
                    </div>

                    {rows.map((appt) => {
                      const doctor = asDoctor(appt.doctorId);
                      const meta = statusMeta(appt);
                      const offline = appt.time === 'QUEUE';
                      return (
                        <div key={appt._id} className="flex flex-col gap-2">
                          <div
                            onClick={() => setSelectedAppointment(appt)}
                            className={[
                              'cursor-pointer rounded-2xl border px-4 py-4 sm:px-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md',
                              meta.card,
                            ].join(' ')}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[16px] font-bold text-[#0F172A]">
                                  {doctorLabel(doctor)}
                                </p>
                                <p className="mt-0.5 text-[13px] text-[#64748B]">
                                  {doctor?.specialization || 'General'}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
                                  <p>
                                    <span className="font-semibold text-[#64748B]">OP Number: </span>
                                    <span className="font-bold text-[#0F172A]">
                                      {appt.tokenNumber || '—'}
                                    </span>
                                  </p>
                                  <p>
                                    <span className="font-semibold text-[#64748B]">Type: </span>
                                    <span className="font-bold text-[#0F172A]">
                                      {offline ? 'Offline' : 'Online'}
                                    </span>
                                  </p>
                                  <span className="text-[12px] font-semibold text-[#0B2A4A] hover:underline">
                                    View Details →
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                  {/* Print OP Consultation Form Button */}
                                  <button
                                    type="button"
                                    title="Print OP Consultation Form"
                                    aria-label="Print OP Consultation Form"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrintAppt(appt);
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E4287] bg-white text-[#1E4287] shadow-2xs transition hover:bg-blue-50/70 active:scale-95"
                                  >
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="6 9 6 2 18 2 18 9" />
                                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                      <rect x="6" y="14" width="12" height="8" />
                                    </svg>
                                  </button>
                                  <span
                                    className={[
                                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold',
                                      meta.badge,
                                    ].join(' ')}
                                  >
                                    {meta.tone === 'success' ? (
                                      <svg
                                        viewBox="0 0 24 24"
                                        width="12"
                                        height="12"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                      >
                                        <path d="m5 12 4.5 4.5L19 7" />
                                      </svg>
                                    ) : null}
                                    {meta.label}
                                  </span>
                                </div>
                                {/* Display Patient Not Arrived directly below the Auto Cancelled status */}
                                {appt.status === 'CANCELLED' && (
                                  appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                                  appt.cancellationReason === 'Patient Not Arrived'
                                ) && (
                                  <PatientNotArrivedBadge className="mt-1" />
                                )}
                              </div>
                            </div>
                          </div>

                          {appt.status === 'CANCELLED' ? (
                            <div className="space-y-2 px-1 text-[12.5px] text-[#64748B]">
                              {appt.cancelledAt ? (
                                <p>
                                  <span className="font-semibold text-[#DC2626]">Cancelled:</span>{' '}
                                  {formatConsultDateTime(appt.cancelledAt)}
                                  {appt.cancellation?.cancelledBy
                                    ? ` · by ${appt.cancellation.cancelledBy === 'PATIENT' ? 'Patient' : 'Admin'}`
                                    : ''}
                                </p>
                              ) : null}
                              {!(
                                appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                                appt.cancellationReason === 'Patient Not Arrived'
                              ) && (
                                <>
                                  {appt.cancellation?.refundPhone ? (
                                    <p>
                                      <span className="font-semibold text-[#0F172A]">Refund phone:</span>{' '}
                                      {appt.cancellation.refundPhone}
                                    </p>
                                  ) : null}
                                  {typeof appt.cancellation?.refundAmount === 'number' ? (
                                    <p>
                                      <span className="font-semibold text-[#0F172A]">Refund amount:</span>{' '}
                                      ₹{appt.cancellation.refundAmount.toLocaleString('en-IN')}
                                      {appt.cancellation.refundPolicy === 'PARTIAL_90_NO_CONVENIENCE'
                                        ? ' (90% OP)'
                                        : ' (full OP)'}
                                    </p>
                                  ) : null}
                                  {appt.cancellation?.refunded ? (
                                    <p>
                                      <span className="font-semibold text-[#16A34A]">Refunded</span>
                                    </p>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={markRefunded.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkRefunded(appt._id);
                                      }}
                                      className="inline-flex rounded-lg border border-[#F59E0B] bg-[#FFFBEB] px-3 py-1.5 text-[12px] font-bold text-[#B45309] transition hover:bg-[#FEF3C7] disabled:opacity-50"
                                    >
                                      Mark refunded
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onMarkRefunded={handleMarkRefunded}
        isMarkingRefunded={markRefunded.isPending}
      />

      {/* Render dedicated A4 OP Consultation Form print overlay */}
      {printData && (
        <OpConsultationPrintForm
          data={printData}
          onClose={() => setPrintData(null)}
        />
      )}
    </div>
  );
};

const DetailRow = ({ icon, label }: { icon: ReactNode; label: string }) => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B]">
      {icon}
    </span>
    <p className="pt-1.5 text-[14px] font-semibold leading-snug text-[#334155]">{label}</p>
  </li>
);
