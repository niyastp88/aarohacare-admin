import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconCalendar,
  IconDoctors,
  IconLock,
  IconQueue,
  IconStethoscope,
} from '@/components/layout/icons';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { APP_ROUTES } from '@/constants/routes';
import { LabDashboardPage } from '@/features/lab';
import { useLiveBoard } from '@/hooks/useAppointments';
import { useAuth } from '@/hooks/useAuth';
import { useDoctors } from '@/hooks/useDoctors';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';
import { useMyFacility } from '@/hooks/useFacility';
import { showToast } from '@/components/ui/Toast';
import { todayIsoIst } from '@/utils/dateTime';

export const DashboardPage = () => {
  const isLab = useIsLabFacility();
  if (isLab) return <LabDashboardPage />;
  return <ClinicDashboardPage />;
};

const ClinicDashboardPage = () => {
  const { user } = useAuth();
  const { approved, rejected, pending } = useFacilityAccess();
  const today = todayIsoIst();
  // This was added to format the current date as "Month Day, Year" for the dashboard subheading
  const formattedDate = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors(approved);
  const board = useLiveBoard(today, approved);
  const facilityQuery = useMyFacility();

  const facilityName =
    facilityQuery.data?.name || user?.facility?.name || user?.name || 'Care Clinic';
  const boardItems = board.data ?? [];
  const loadingStats = approved && (doctorsLoading || board.isLoading);

  const stats = useMemo(() => {
    let online = 0;
    let offline = 0;
    let cancelled = 0;
    let waiting = 0;
    let consulting = 0;

    for (const item of boardItems) {
      online += item.onlineCount ?? 0;
      offline += item.offlineCount ?? 0;
      cancelled += item.cancelledCount ?? 0;
      waiting +=
        (item.waitingCount ?? item.waiting?.length ?? 0) +
        (item.queue?.length ?? item.upcoming?.length ?? 0) +
        (item.current ? 1 : 0);
      if (item.current) consulting += 1;
    }

    return {
      todayTotal: online + offline + cancelled,
      online,
      offline,
      cancelled,
      waiting,
      consulting,
      /** Doctors with an open schedule / live queue for today. */
      activeDoctorsToday: boardItems.length,
      /** All doctors registered at this facility. */
      totalDoctors: doctors.length,
    };
  }, [boardItems, doctors.length]);

  const doctorsSubtitle =
    stats.activeDoctorsToday === 0
      ? stats.totalDoctors === 0
        ? 'Add doctors to start taking bookings'
        : 'No doctors scheduled for today'
      : `${stats.activeDoctorsToday} on duty · ${stats.totalDoctors} total on roster`;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1A1F36] sm:text-[36px]">
            Welcome back, {facilityName}
          </h1>
          <p className="mt-2 text-[15px] text-[#4B5563]">
            {/* This was modified to display only the formatted date instead of the full snapshot text */}
            {rejected
              ? 'This registration was not approved. Contact Aarohcare support.'
              : pending
                ? 'Your registration is with Super Admin. You can only use this dashboard until it is accepted.'
                : formattedDate}
          </p>
        </div>
        <NotificationBell className="relative mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#4B5563] transition hover:bg-white" />
      </div>

      {!approved ? (
        <div
          className={[
            'rounded-2xl border p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
            rejected ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50',
          ].join(' ')}
        >
          <p className={rejected ? 'text-sm font-bold text-rose-800' : 'text-sm font-bold text-amber-900'}>
            {rejected ? 'Registration rejected' : 'Waiting for Super Admin approval'}
          </p>
          <p className="mt-2 text-sm text-[#4B5563]">
            {rejected
              ? 'Patients cannot see this facility. Queue, doctors, patients, settings, and payments stay locked.'
              : 'A Super Admin must accept this clinic, hospital, or lab before you can manage doctors, queues, patients, or settings. This page stays open so you can check status.'}
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5B6577]">
              Today&apos;s total booking
            </p>
            <span className="text-[#C8D0DB]">
              <IconCalendar />
            </span>
          </div>
          <p className="mt-4 text-[48px] font-bold leading-none text-[#0B2A4A]">
            {loadingStats ? '…' : stats.todayTotal}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[#EEF2F6] pt-4">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#5B6577]">
                Online
              </p>
              <p className="mt-1 text-[18px] font-bold text-[#16A34A]">
                {loadingStats ? '…' : stats.online}
              </p>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#5B6577]">
                Offline
              </p>
              <p className="mt-1 text-[18px] font-bold text-[#0B2A4A]">
                {loadingStats ? '…' : stats.offline}
              </p>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[#5B6577]">
                Cancelled
              </p>
              <p className="mt-1 text-[18px] font-bold text-[#DC2626]">
                {loadingStats ? '…' : stats.cancelled}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5EAF0] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#5B6577]">
              Active doctors today
            </p>
            <span className="text-[#C8D0DB]">
              <IconStethoscope />
            </span>
          </div>
          <p className="mt-4 text-[48px] font-bold leading-none text-[#0B2A4A]">
            {loadingStats ? '…' : stats.activeDoctorsToday}
          </p>
          <p className="mt-6 border-t border-[#EEF2F6] pt-4 text-[14px] text-[#4B5563]">
            {loadingStats ? 'Loading roster…' : doctorsSubtitle}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-[22px] font-bold text-[#1A1F36]">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {approved ? (
            <>
              <Link
                to={APP_ROUTES.ADMIN.OP_CONTROL}
                className="group flex items-center gap-4 rounded-2xl bg-[#0B2A4A] px-5 py-5 text-white shadow-[0_8px_20px_rgba(11,42,74,0.22)] transition hover:bg-[#163A5F]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                  <IconQueue />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold">Manage Queue</span>
                  <span className="mt-0.5 block text-sm text-white/80">
                    {loadingStats
                      ? 'View and adjust patient flow'
                      : stats.waiting > 0
                        ? `${stats.waiting} patient${stats.waiting === 1 ? '' : 's'} waiting now`
                        : 'View and adjust patient flow'}
                  </span>
                </span>
                <IconArrowRight className="opacity-90 transition group-hover:translate-x-0.5" />
              </Link>

              <Link
                to={APP_ROUTES.ADMIN.DOCTORS}
                className="group flex items-center gap-4 rounded-2xl border border-[#0B2A4A] bg-white px-5 py-5 text-[#0B2A4A] shadow-sm transition hover:bg-[#F8FAFC]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF4FF] text-[#0B2A4A]">
                  <IconDoctors />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold">Manage Doctors</span>
                  <span className="mt-0.5 block text-sm text-[#4B5563]">
                    {loadingStats
                      ? 'Update schedules and availability'
                      : `${stats.totalDoctors} doctor${stats.totalDoctors === 1 ? '' : 's'} on roster`}
                  </span>
                </span>
                <IconArrowRight className="transition group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : (
            <>
              <LockedAction title="Manage Queue" subtitle="Unlocks after Super Admin accepts this facility" />
              <LockedAction title="Manage Doctors" subtitle="Unlocks after Super Admin accepts this facility" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const LockedAction = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <button
    type="button"
    onClick={() => showToast('Waiting for Super Admin approval. Only the dashboard is available.', 'error')}
    className="flex cursor-not-allowed items-center gap-4 rounded-2xl border border-[#E5EAF0] bg-white px-5 py-5 text-left text-[#94A3B8]"
  >
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F5F9]">
      <IconLock />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[17px] font-bold text-[#64748B]">{title}</span>
      <span className="mt-0.5 block text-sm">{subtitle}</span>
    </span>
  </button>
);
