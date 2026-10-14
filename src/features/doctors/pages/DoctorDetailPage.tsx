import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { BackButton } from '@/components/ui/BackButton';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import {
  useDoctorSchedules,
  useDoctors,
  useRemoveDoctor,
} from '@/hooks/useDoctors';
import type { ScheduleResponseDto } from '@/types/dto';
import { format12Hour, todayIsoIst, toHm } from '@/utils/dateTime';
import { toTitleCase } from '@/utils/formatters';
import { EditScheduleModal } from '../components/EditScheduleModal';

const WEEKDAYS = [
  { dow: 1, label: 'MON' },
  { dow: 2, label: 'TUE' },
  { dow: 3, label: 'WED' },
  { dow: 4, label: 'THU' },
  { dow: 5, label: 'FRI' },
  { dow: 6, label: 'SAT' },
  { dow: 0, label: 'SUN' },
] as const;

const doctorDisplayName = (name?: string) => {
  const raw = (name || 'Doctor').trim();
  const titled = toTitleCase(raw.replace(/^dr\.?\s*/i, ''));
  return `Dr. ${titled}`;
};

const formatFee = (fee?: number) => {
  if (fee == null) return '—';
  return `₹${fee}`;
};

const isoDow = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getDay();
};

const scheduleHours = (schedule: ScheduleResponseDto) => {
  if (schedule.startTime && schedule.endTime) {
    return `${format12Hour(schedule.startTime)} - ${format12Hour(schedule.endTime)}`;
  }
  const times = (schedule.slots ?? [])
    .map((slot) => toHm(slot.time))
    .filter(Boolean)
    .sort();
  if (times.length === 0) return null;
  return `${format12Hour(times[0])} - ${format12Hour(times[times.length - 1])}`;
};

export const DoctorDetailPage = () => {
  const { doctorId = '' } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const today = todayIsoIst();
  const { data: doctors = [], isLoading, isError, error } = useDoctors();
  const schedulesQuery = useDoctorSchedules(doctorId);
  const removeDoctor = useRemoveDoctor();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const doctor = doctors.find((item) => item._id === doctorId);

  const weekdayHours = useMemo(() => {
    const map = new Map<number, string>();
    const upcoming = (schedulesQuery.data ?? []).filter(
      (schedule) => schedule.date >= today && !schedule.isClosed,
    );
    for (const schedule of upcoming) {
      const dow = isoDow(schedule.date);
      if (map.has(dow)) continue;
      const hours = scheduleHours(schedule);
      if (hours) map.set(dow, hours);
    }
    return map;
  }, [schedulesQuery.data, today]);

  const upcomingSchedules = useMemo(() => {
    return (schedulesQuery.data ?? [])
      .filter((schedule) => schedule.date >= today && !schedule.isClosed)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [schedulesQuery.data, today]);

  const handleDelete = () => {
    if (!doctor) return;
    sweetAlert.confirm(
      'Delete this doctor profile?',
      `${doctorDisplayName(doctor.name)} will be removed from Manage Doctors.`,
      () => {
        removeDoctor.mutate(doctor._id, {
          onSuccess: () => {
            showToast('Doctor profile deleted');
            navigate(APP_ROUTES.ADMIN.DOCTORS, { replace: true });
          },
          onError: (err) => showToast(getApiErrorMessage(err), 'error'),
        });
      },
      { confirmText: 'Delete Profile', cancelText: 'Keep', tone: 'danger' },
    );
  };

  if (isLoading || schedulesQuery.isLoading) {
    return <Spinner label="Loading doctor…" />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
        <p className="text-sm text-[#DC2626]">Doctor not found.</p>
        <BackButton to={APP_ROUTES.ADMIN.DOCTORS}>Back to Doctors List</BackButton>
      </div>
    );
  }

  const subtitle = [doctor.specialization, doctor.qualifications]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <div>
        <BackButton to={APP_ROUTES.ADMIN.DOCTORS}>Back to Doctors List</BackButton>
        <h1 className="mt-4 text-[28px] font-bold tracking-tight text-[#0F172A] sm:text-[32px]">
          Doctor Profile
        </h1>
      </div>

      <section className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.2)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {doctor.profileImage ? (
              <img
                src={doctor.profileImage}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-[#EEF2F6]"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-2xl font-bold text-[#0B2A4A] ring-4 ring-[#EEF2F6]">
                {doctorDisplayName(doctor.name).replace(/^Dr\.\s*/i, '').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[24px] font-bold tracking-tight text-[#0F172A] sm:text-[28px]">
                {doctorDisplayName(doctor.name)}
              </h2>
              <p className="mt-1 text-[15px] font-medium text-[#475569]">
                {subtitle || 'General OP'}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E5EAF0] bg-[#F8FAFC] px-3 py-1.5 text-[13px] font-semibold text-[#0F172A]">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 4v4M15 4v4M8 8h8v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8Z" />
                  <path d="M10 12h4M10 16h4" />
                </svg>
                Consultation Fee: {formatFee(doctor.consultationFee)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={APP_ROUTES.ADMIN.DOCTOR_EDIT(doctor._id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#0B2A4A]/20 bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#0B2A4A] transition hover:bg-[#F8FAFC]"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                <path d="m13.5 6.5 3 3" />
              </svg>
              Edit Profile
            </Link>
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2.5 text-[13px] font-bold text-[#0F172A] transition hover:bg-[#F8FAFC]"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
              </svg>
              Edit Schedule
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={removeDoctor.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-3.5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#B91C1C] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-12" />
              </svg>
              {removeDoctor.isPending ? 'Deleting…' : 'Delete Profile'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5EAF0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0B2A4A" strokeWidth="1.8">
            <rect x="3.5" y="5" width="17" height="15" rx="2" />
            <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
          </svg>
          <h3 className="text-[18px] font-bold text-[#0F172A]">Weekly Schedule</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map((day) => {
            const hours = weekdayHours.get(day.dow);
            const active = Boolean(hours);
            return (
              <div
                key={day.label}
                className={[
                  'rounded-2xl border px-3 py-4 text-center',
                  active
                    ? 'border-[#CBD5E1] bg-[#F8FAFC]'
                    : 'border-[#EEF2F6] bg-[#FCFCFD]',
                ].join(' ')}
              >
                <p className="text-[12px] font-bold tracking-[0.08em] text-[#64748B]">
                  {day.label}
                </p>
                <p
                  className={[
                    'mt-2 text-[12px] sm:text-[13px] font-bold leading-snug break-words',
                    active ? 'text-[#0F172A]' : 'text-[#94A3B8]',
                  ].join(' ')}
                >
                  {hours || 'Off'}
                </p>
              </div>
            );
          })}
        </div>

        {weekdayHours.size === 0 ? (
          <p className="mt-4 text-[14px] font-medium text-[#64748B]">
            No upcoming open schedules yet. Use Edit Schedule to add days.
          </p>
        ) : null}

        {upcomingSchedules.length > 0 ? (
          <div className="mt-5 border-t border-[#EEF2F6] pt-5">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[#64748B]">
              Upcoming Schedules By Date
            </p>
            <div className="flex flex-wrap gap-2.5">
              {upcomingSchedules.slice(0, 14).map((s) => {
                const hours = scheduleHours(s);
                const isToday = s.date === today;
                const [y, m, d] = s.date.split('-').map(Number);
                const dObj = new Date(y, (m || 1) - 1, d || 1);
                const dayLabel = isToday
                  ? 'Today'
                  : dObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <div
                    key={s._id || s.date}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[12.5px]"
                  >
                    <span className="font-bold text-[#1A1F36]">{dayLabel}</span>
                    <span className="rounded-md bg-[#0B2A4A]/10 px-2 py-0.5 font-bold text-[#0B2A4A]">
                      {hours || 'Open'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <EditScheduleModal
        open={scheduleOpen}
        doctor={doctor}
        onClose={() => setScheduleOpen(false)}
      />
    </div>
  );
};
