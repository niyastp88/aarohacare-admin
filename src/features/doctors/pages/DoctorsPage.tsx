import { useMemo, useState, type ReactNode } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { doctorsService } from '@/api/services/doctors';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { APP_ROUTES } from '@/constants/routes';
import { useDoctors, useSetScheduleClosed } from '@/hooks/useDoctors';
import type { DoctorResponseDto } from '@/types/dto';
import { format12Hour, todayIsoIst, toHm } from '@/utils/dateTime';
import { toTitleCase } from '@/utils/formatters';
import { EditScheduleModal } from '../components/EditScheduleModal';

const doctorDisplayName = (name?: string) => {
  const titled = toTitleCase(name || 'Doctor');
  return /^dr\.?\s/i.test(titled) ? titled : `Dr. ${titled}`;
};

const formatFee = (fee?: number) => {
  if (fee == null) return '—';
  return `₹${fee}`;
};

export const DoctorsPage = () => {
  const navigate = useNavigate();
  const today = todayIsoIst();
  const { data: doctors = [], isLoading, isError, error } = useDoctors();
  const setClosed = useSetScheduleClosed();

  const [scheduleDoctor, setScheduleDoctor] = useState<DoctorResponseDto | null>(null);
  const [busyDoctorId, setBusyDoctorId] = useState('');

  const openProfile = (doctorId: string) => {
    navigate(APP_ROUTES.ADMIN.DOCTOR_DETAIL(doctorId));
  };

  const todayScheduleQueries = useQueries({
    queries: doctors.map((doctor) => ({
      queryKey: QUERY_KEYS.schedules.byDoctorDate(doctor._id, today),
      queryFn: () => doctorsService.getSchedule(doctor._id, today),
      enabled: Boolean(doctor._id),
    })),
  });

  const allScheduleQueries = useQueries({
    queries: doctors.map((doctor) => ({
      queryKey: QUERY_KEYS.schedules.byDoctor(doctor._id),
      queryFn: () => doctorsService.listSchedules(doctor._id),
      enabled: Boolean(doctor._id),
    })),
  });

  const schedulesLoading =
    doctors.length > 0 &&
    (todayScheduleQueries.some((q) => q.isLoading) ||
      allScheduleQueries.some((q) => q.isLoading));

  const { available, unavailable } = useMemo(() => {
    const avail: Array<{ doctor: DoctorResponseDto; hasAnySchedule: boolean; todayHours?: string }> = [];
    const unavail: Array<{ doctor: DoctorResponseDto; hasAnySchedule: boolean }> = [];
    doctors.forEach((doctor, index) => {
      const todaySchedule = todayScheduleQueries[index]?.data;
      const allSchedules = allScheduleQueries[index]?.data ?? [];
      const hasAnySchedule = allSchedules.some(
        (schedule) => schedule.date >= today && !schedule.isClosed,
      );
      const isAvailableToday = Boolean(todaySchedule && !todaySchedule.isClosed);
      let todayHours: string | undefined = undefined;
      if (isAvailableToday && todaySchedule) {
        if (todaySchedule.startTime && todaySchedule.endTime) {
          todayHours = `${format12Hour(todaySchedule.startTime)} - ${format12Hour(todaySchedule.endTime)}`;
        } else if (todaySchedule.slots && todaySchedule.slots.length > 0) {
          const sorted = todaySchedule.slots
            .map((slot) => toHm(slot.time))
            .filter(Boolean)
            .sort();
          if (sorted.length > 0) {
            todayHours = `${format12Hour(sorted[0])} - ${format12Hour(sorted[sorted.length - 1])}`;
          }
        }
      }
      const entry = { doctor, hasAnySchedule, todayHours };
      if (isAvailableToday) avail.push(entry);
      else unavail.push(entry);
    });
    return { available: avail, unavailable: unavail };
  }, [doctors, todayScheduleQueries, allScheduleQueries, today]);

  const markUnavailable = (doctor: DoctorResponseDto) => {
    sweetAlert.confirm(
      'Mark unavailable?',
      `${doctorDisplayName(doctor.name)} will be closed for bookings today.`,
      () => {
        setBusyDoctorId(doctor._id);
        setClosed.mutate(
          { doctorId: doctor._id, date: today, isClosed: true },
          {
            onSuccess: () => showToast('Doctor marked unavailable for today'),
            onError: (err) => showToast(getApiErrorMessage(err), 'error'),
            onSettled: () => setBusyDoctorId(''),
          },
        );
      },
      { confirmText: 'Mark Unavailable', cancelText: 'Keep Available', tone: 'warning' },
    );
  };

  if (isLoading || schedulesLoading) {
    return <Spinner label="Loading doctors…" />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36] sm:text-[32px]">
            Manage Doctors
          </h1>
          <p className="mt-1 text-[14px] text-[#4B5563]">
            View and manage clinical staff schedules and profiles.
          </p>
        </div>
        <Link
          to={APP_ROUTES.ADMIN.DOCTORS_NEW}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B2A4A] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#081F37]"
        >
          <span className="text-[18px] leading-none">+</span>
          Add New Doctor
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-bold text-[#1A1F36]">Available Today</h2>
        {available.length === 0 ? (
          <EmptyState text="No doctors scheduled for today." />
        ) : (
          <div className="flex flex-col gap-3">
            {available.map(({ doctor, todayHours }) => (
              <DoctorCard
                key={doctor._id}
                doctor={doctor}
                available
                todayHours={todayHours}
                hasSchedule
                busy={busyDoctorId === doctor._id && setClosed.isPending}
                onOpenProfile={() => openProfile(doctor._id)}
                onEditSchedule={() => setScheduleDoctor(doctor)}
                onMarkUnavailable={() => markUnavailable(doctor)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[18px] font-bold text-[#1A1F36]">Not Available Today</h2>
        {unavailable.length === 0 ? (
          <EmptyState text="All doctors are scheduled today." />
        ) : (
          <div className="flex flex-col gap-3">
            {unavailable.map(({ doctor, hasAnySchedule }) => (
              <DoctorCard
                key={doctor._id}
                doctor={doctor}
                available={false}
                hasSchedule={hasAnySchedule}
                busy={false}
                onOpenProfile={() => openProfile(doctor._id)}
                onEditSchedule={() => setScheduleDoctor(doctor)}
                onAddToSchedule={() => setScheduleDoctor(doctor)}
              />
            ))}
          </div>
        )}
      </section>

      <EditScheduleModal
        open={Boolean(scheduleDoctor)}
        doctor={scheduleDoctor}
        onClose={() => setScheduleDoctor(null)}
      />
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-[#E5EAF0] bg-white px-5 py-8 text-center text-[14px] text-[#5B6577]">
    {text}
  </div>
);

const DoctorCard = ({
  doctor,
  available,
  todayHours,
  hasSchedule,
  busy,
  onOpenProfile,
  onEditSchedule,
  onMarkUnavailable,
  onAddToSchedule,
}: {
  doctor: DoctorResponseDto;
  available: boolean;
  todayHours?: string;
  hasSchedule: boolean;
  busy: boolean;
  onOpenProfile: () => void;
  onEditSchedule: () => void;
  onMarkUnavailable?: () => void;
  onAddToSchedule?: () => void;
}) => (
  <div className="flex flex-col gap-4 rounded-2xl border border-[#E5EAF0] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:gap-5 sm:px-5">
    <button
      type="button"
      onClick={onOpenProfile}
      className="flex min-w-0 flex-1 items-center gap-3.5 text-left transition hover:opacity-90"
    >
      {doctor.profileImage ? (
        <img
          src={doctor.profileImage}
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-[#EEF2F6]"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E8F1FF] text-lg font-bold text-[#1B64F2]">
          {doctorDisplayName(doctor.name).replace(/^Dr\.\s*/i, '').charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[16px] font-bold text-[#1A1F36]">
          {doctorDisplayName(doctor.name)}
        </p>
        <p className="truncate text-[13px] text-[#4B5563]">
          {doctor.specialization || 'General'}
        </p>
        <span
          className={[
            'mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold',
            available ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F3F4F6] text-[#4B5563]',
          ].join(' ')}
        >
          {available ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
              Scheduled Today{todayHours ? ` · ${todayHours}` : ''}
            </>
          ) : (
            'Not Scheduled Today'
          )}
        </span>
      </div>
    </button>

    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {hasSchedule || available ? (
        <ActionButton tone="blue" onClick={onEditSchedule} icon="calendar">
          Edit Schedule
        </ActionButton>
      ) : (
        <ActionButton tone="blue" onClick={onAddToSchedule} icon="add">
          Add to Schedule
        </ActionButton>
      )}
      {available ? (
        <ActionButton
          tone="red"
          onClick={onMarkUnavailable}
          disabled={busy}
          icon="unavailable"
        >
          {busy ? 'Updating…' : 'Mark Unavailable'}
        </ActionButton>
      ) : null}
    </div>

    <button
      type="button"
      onClick={onOpenProfile}
      className="flex items-center justify-between gap-3 border-t border-[#EEF2F6] pt-3 text-left sm:border-0 sm:pt-0 sm:pl-2"
      aria-label={`View ${doctorDisplayName(doctor.name)} profile`}
    >
      <div className="text-right sm:min-w-[110px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
          Consultation Fee
        </p>
        <p className="text-[18px] font-bold text-[#1A1F36]">{formatFee(doctor.consultationFee)}</p>
      </div>
      <span className="text-[#C5CDD8]" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </button>
  </div>
);

const ActionButton = ({
  children,
  onClick,
  tone,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone: 'blue' | 'red' | 'navy';
  disabled?: boolean;
  icon: 'calendar' | 'unavailable' | 'add';
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={[
      'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
      tone === 'blue'
        ? 'border-[#BFDBFE] bg-white text-[#1B64F2] hover:bg-[#F5F9FF]'
        : tone === 'navy'
          ? 'border-[#0B2A4A]/20 bg-[#0B2A4A] text-white hover:bg-[#081F37]'
          : 'border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEF2F2]',
    ].join(' ')}
  >
    {icon === 'calendar' ? (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </svg>
    ) : null}
    {icon === 'unavailable' ? (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17M9 14l6 6M15 14l-6 6" />
      </svg>
    ) : null}
    {icon === 'add' ? <span className="text-[15px] leading-none">+</span> : null}
    {children}
  </button>
);
