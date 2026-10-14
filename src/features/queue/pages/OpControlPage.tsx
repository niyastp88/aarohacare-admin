import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { FullScreenButton } from '@/components/layout/FullScreenButton';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { useLayout } from '@/contexts/LayoutContext';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { BackButton } from '@/components/ui/BackButton';
import { DoctorSelect } from '@/components/ui/DoctorSelect';
import { PatientNotArrivedBadge } from '@/components/ui/PatientNotArrivedBadge';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import { APPOINTMENT_STATUS } from '@/constants/appointmentStatus';
import {
  useLiveBoard,
  useLiveOpAction,
  useMarkAppointmentArrived,
  useUnmarkAppointmentArrived,
  useUpdateAppointmentStatus,
} from '@/hooks/useAppointments';
import { useDoctors, useMovePendingOps, useSetScheduleClosed } from '@/hooks/useDoctors';
import { doctorsService } from '@/api/services/doctors';
import { useQueries } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import type { AppointmentResponseDto, LiveBoardItemDto, UserResponseDto } from '@/types/dto';
import { todayIsoIst } from '@/utils/dateTime';
import { toTitleCase } from '@/utils/formatters';
import { CancelTokenModal } from '../components/CancelTokenModal';
import { AddPatientModal } from '../components/AddPatientModal';
import { CloseBookingChoiceModal } from '../components/CloseBookingChoiceModal';
import { MoveOpModal } from '../components/MoveOpModal';

type ViewMode = 'multi' | 'single';

type CancelTarget = {
  appointmentId: string;
  tokenLabel: string;
  phone?: string;
  doctorId: string;
  consultationFee?: number;
};

const asPatient = (value: AppointmentResponseDto['patientId']): UserResponseDto | null => {
  if (!value || typeof value === 'string') return null;
  return value;
};

const fullPatientName = (appt: AppointmentResponseDto) => {
  if (appt.patientName) return toTitleCase(appt.patientName);
  const patient = asPatient(appt.patientId);
  if (!patient?.name) return 'Patient';
  return toTitleCase(patient.name);
};

const shortPatientName = (appt: AppointmentResponseDto) => {
  const full = fullPatientName(appt);
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

const genderLetter = (gender?: string) => {
  const g = (gender || '').trim().toLowerCase();
  if (g.startsWith('f')) return 'F';
  if (g.startsWith('m')) return 'M';
  return '';
};

const patientMetaLine = (appt: AppointmentResponseDto) => {
  const patient = asPatient(appt.patientId);
  const age = appt.patientAge ?? patient?.age;
  const gender = patient ? genderLetter(patient.gender) : '';
  const place = patient?.place || patient?.address;
  const bits: string[] = [];
  if (age != null) bits.push(String(age));
  if (gender) bits.push(gender);
  const left = bits.join(' ');
  if (left && place) return `${left} • ${place}`;
  if (place) return place;
  if (left) return left;
  return '—';
};

const patientAgeLabel = (appt: AppointmentResponseDto) => {
  const patient = asPatient(appt.patientId);
  const name = shortPatientName(appt);
  // Mockup format: "Amal , 28"
  const age = appt.patientAge ?? patient?.age;
  if (age != null) return `${name} , ${age}`;
  return name;
};

const doctorDisplayName = (name?: string) => {
  const raw = (name || 'Doctor').trim();
  const titled = toTitleCase(raw.replace(/^dr\.?\s*/i, ''));
  return `Dr. ${titled}`;
};

const isWalkIn = (appt: AppointmentResponseDto) => appt.time === 'QUEUE';

const ChannelBadge = ({ offline }: { offline: boolean }) => (
  <span
    className={[
      'inline-flex rounded-md px-1.5 py-px text-[10px] font-semibold',
      offline ? 'bg-[#F3F4F6] text-[#4B5563]' : 'bg-[#EEF2F6] text-[#0B2A4A]',
    ].join(' ')}
  >
    {offline ? 'Offline' : 'Online'}
  </span>
);

const DoctorAvatar = ({ name, image }: { name: string; image?: string }) => {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9] text-[#0B2A4A]">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" />
      </svg>
    </div>
  );
};

const IconBtn = ({
  children,
  onClick,
  disabled,
  label,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={[
      'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] text-[#0B2A4A] hover:bg-[#EEF2F6] disabled:cursor-not-allowed disabled:opacity-45',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

export const OpControlPage = () => {
  const { isFullScreen, toggleFullScreen, setIsFullScreen } = useLayout();
  const today = todayIsoIst();
  const [date, setDate] = useState(today);

  useEffect(() => {
    return () => {
      setIsFullScreen(false);
    };
  }, [setIsFullScreen]);
  const [viewMode, setViewMode] = useState<ViewMode>('multi');
  const [activeDoctorId, setActiveDoctorId] = useState<string>('');
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [closeChoiceDoctorId, setCloseChoiceDoctorId] = useState('');
  const [moveDoctorId, setMoveDoctorId] = useState('');
  const [moveError, setMoveError] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDoctorId, setPendingDoctorId] = useState('');

  const { data: doctors = [] } = useDoctors();
  const board = useLiveBoard(date);
  const liveOpAction = useLiveOpAction();
  const markArrived = useMarkAppointmentArrived();
  const unmarkArrived = useUnmarkAppointmentArrived();
  const updateStatus = useUpdateAppointmentStatus();
  const closeSchedule = useSetScheduleClosed();
  const moveOps = useMovePendingOps();

  const items = board.data ?? [];

  const upcomingScheduleQueries = useQueries({
    queries: doctors.map((doctor) => ({
      queryKey: QUERY_KEYS.schedules.byDoctor(doctor._id),
      queryFn: () => doctorsService.listSchedules(doctor._id),
      enabled: Boolean(doctor._id) && items.length === 0,
    })),
  });

  const nextScheduledDate = useMemo(() => {
    const dates = new Set<string>();
    for (const query of upcomingScheduleQueries) {
      for (const schedule of query.data ?? []) {
        if (schedule.date >= today && !schedule.isClosed) dates.add(schedule.date);
      }
    }
    return Array.from(dates).sort()[0] || '';
  }, [upcomingScheduleQueries, today]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveDoctorId('');
      return;
    }
    const stillThere = items.some((item) => item.doctor._id === activeDoctorId);
    if (!stillThere) {
      setActiveDoctorId(items[0].doctor._id);
    }
  }, [items, activeDoctorId]);

  const activeItem = useMemo(
    () => items.find((item) => item.doctor._id === activeDoctorId) ?? items[0] ?? null,
    [items, activeDoctorId],
  );

  const doctorStats = useMemo(() => {
    if (!activeItem) {
      return { waiting: 0, online: 0, offline: 0, cancelled: 0 };
    }
    return {
      waiting: activeItem.waitingCount ?? activeItem.waiting?.length ?? 0,
      online: activeItem.onlineCount ?? 0,
      offline: activeItem.offlineCount ?? 0,
      cancelled: activeItem.cancelledCount ?? 0,
    };
  }, [activeItem]);

  const doctorOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.doctor._id,
        name: item.doctor.name,
        specialization: item.doctor.specialization,
        image: item.doctor.profileImage,
        status: item.onBreak ? 'On break' : undefined,
      })),
    [items],
  );

  const isDoctorBusy = (doctorId: string) => {
    if (pendingDoctorId === doctorId) return true;
    if (liveOpAction.isPending && liveOpAction.variables?.doctorId === doctorId) return true;
    if (closeSchedule.isPending && closeSchedule.variables?.doctorId === doctorId) return true;
    return false;
  };

  const runLiveOp = (doctorId: string, action: 'next' | 'previous' | 'break' | 'resume') => {
    setActionError(null);
    liveOpAction.mutate(
      { doctorId, date, action },
      {
        onError: (err) => {
          const message = getApiErrorMessage(err);
          setActionError(message);
          showToast(message, 'error');
        },
      },
    );
  };

  const openCancel = (appt: AppointmentResponseDto, doctorId: string) => {
    const patient = asPatient(appt.patientId);
    setCancelTarget({
      appointmentId: appt._id,
      tokenLabel: String(appt.tokenNumber || '—'),
      phone: patient?.phone || '',
      doctorId,
      consultationFee: appt.consultationFee ?? 0,
    });
  };

  const confirmCancel = (payload: { refunded: boolean; refundPhone: string; refundAmount: number }) => {
    if (!cancelTarget) return;
    setPendingDoctorId(cancelTarget.doctorId);
    updateStatus.mutate(
      {
        appointmentId: cancelTarget.appointmentId,
        status: APPOINTMENT_STATUS.CANCELLED,
        refunded: payload.refunded,
        refundPhone: payload.refundPhone,
        refundAmount: payload.refundAmount,
      },
      {
        onSuccess: () => {
          setCancelTarget(null);
          showToast('Appointment cancelled');
        },
        onError: (err) => showToast(getApiErrorMessage(err), 'error'),
        onSettled: () => setPendingDoctorId(''),
      },
    );
  };

  const onMarkArrived = (appointmentId: string, doctorId: string) => {
    setActionError(null);
    setPendingDoctorId(doctorId);
    markArrived.mutate(appointmentId, {
      onSuccess: () => showToast('Patient marked as arrived'),
      onError: (err) => {
        const message = getApiErrorMessage(err);
        setActionError(message);
        showToast(message, 'error');
      },
      onSettled: () => setPendingDoctorId(''),
    });
  };

  const onUnmarkArrived = (appointmentId: string, doctorId: string) => {
    setActionError(null);
    setPendingDoctorId(doctorId);
    unmarkArrived.mutate(appointmentId, {
      onSuccess: () => showToast('Arrival unmarked'),
      onError: (err) => {
        const message = getApiErrorMessage(err);
        setActionError(message);
        showToast(message, 'error');
      },
      onSettled: () => setPendingDoctorId(''),
    });
  };

  const onCloseBooking = (doctorId: string) => {
    setActionError(null);
    setMoveError('');
    setCloseChoiceDoctorId(doctorId);
  };

  const closeBookingOnly = (doctorId: string) => {
    setCloseChoiceDoctorId('');
    sweetAlert.confirm(
      'Close OP for today?',
      'New bookings for this doctor will stop. Existing tokens stay in the queue.',
      () => {
        closeSchedule.mutate(
          { doctorId, date, isClosed: true },
          {
            onError: (err) => {
              const message = getApiErrorMessage(err);
              setActionError(message);
              showToast(message, 'error');
            },
            onSuccess: () => {
              showToast('Booking closed for today');
              if (viewMode === 'single') setViewMode('multi');
            },
          },
        );
      },
      { confirmText: 'Close OP', cancelText: 'Keep open', tone: 'warning' },
    );
  };

  const closeChoiceItem = useMemo(
    () => items.find((item) => item.doctor._id === closeChoiceDoctorId) ?? null,
    [items, closeChoiceDoctorId],
  );

  const moveItem = useMemo(
    () => items.find((item) => item.doctor._id === moveDoctorId) ?? null,
    [items, moveDoctorId],
  );

  const pendingQueueTokens = useMemo(() => {
    const queue = moveItem?.queue ?? [];
    return queue
      .map((appt) => Number(appt.tokenNumber))
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
  }, [moveItem]);

  const defaultFromOp = pendingQueueTokens[0] ?? 0;
  const defaultToOp = pendingQueueTokens[pendingQueueTokens.length - 1] ?? 0;

  const moveDoctorOptions = useMemo(
    () =>
      doctors
        .filter((doctor) => doctor._id !== moveDoctorId && doctor.isActive !== false)
        .map((doctor) => ({
          id: doctor._id,
          name: doctor.name,
          specialization: doctor.specialization,
          image: doctor.profileImage,
        })),
    [doctors, moveDoctorId],
  );

  return (
    <div
      className={
        isFullScreen
          ? 'flex w-full max-w-none flex-col gap-5'
          : 'mx-auto flex w-full max-w-[1280px] flex-col gap-5'
      }
    >
      {viewMode === 'multi' ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36] sm:text-[32px]">
              Queue Management
            </h1>
            <div className="flex items-center gap-3">
              <FullScreenButton isFullScreen={isFullScreen} onToggle={toggleFullScreen} />
              <NotificationBell />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5EAF0] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-end">
                <DatePickerField
                  label="Queue Date"
                  value={date}
                  onChange={(next) => setDate(next || today)}
                  className="w-full min-w-[180px] sm:max-w-[220px]"
                />
                <DoctorSelect
                  label="Select Doctor"
                  value={activeDoctorId}
                  options={doctorOptions}
                  onChange={setActiveDoctorId}
                  emptyLabel="No doctors scheduled"
                  tone="soft"
                />
              </div>

              <div className="grid flex-1 grid-cols-2 divide-x divide-[#E5EAF0] rounded-xl border border-[#E5EAF0] bg-[#FBFCFE] sm:grid-cols-4">
                <StatCell
                  label="Waiting"
                  value={doctorStats.waiting}
                  valueClassName="text-[#0B2A4A]"
                  icon={
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0B2A4A" strokeWidth="1.8">
                      <circle cx="12" cy="8" r="3.2" />
                      <path d="M5 19c1.4-3.4 3.8-5 7-5s5.6 1.6 7 5" />
                    </svg>
                  }
                />
                <StatCell
                  label="Online Bookings"
                  value={doctorStats.online}
                  icon={
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#0B2A4A" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M3 12h18M12 4c2.5 2.8 2.5 13.2 0 16M12 4c-2.5 2.8-2.5 13.2 0 16" />
                    </svg>
                  }
                />
                <StatCell
                  label="Offline Bookings"
                  value={doctorStats.offline}
                  icon={
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4B5563" strokeWidth="1.8">
                      <circle cx="12" cy="8" r="3.2" />
                      <path d="M5.5 19c1.2-3.2 3.6-4.7 6.5-4.7S17.8 15.8 19 19" />
                    </svg>
                  }
                />
                <StatCell
                  label="Cancelled"
                  value={doctorStats.cancelled}
                  valueClassName="text-[#DC2626]"
                  icon={
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#DC2626" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
                    </svg>
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[20px] font-bold text-[#1A1F36]">Queue Management</h2>
            <button
              type="button"
              disabled={!activeItem}
              onClick={() => setViewMode('single')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5EAF0] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0B2A4A] transition hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              Single Doctor View
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EDF3] pb-5">
          <DoctorSelect
            hideLabel
            label="Select Doctor"
            value={activeDoctorId}
            options={doctorOptions}
            onChange={setActiveDoctorId}
            tone="white"
            className="max-w-[320px] flex-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('multi')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5EAF0] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#0B2A4A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F8FAFC]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              Switch to Multi-Doctor View
            </button>
            <FullScreenButton isFullScreen={isFullScreen} onToggle={toggleFullScreen} />
            <NotificationBell />
          </div>
        </div>
      )}

      {board.isLoading ? <Spinner label="Loading queue…" /> : null}

      {board.isError ? (
        <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
          {getApiErrorMessage(board.error)}
        </div>
      ) : null}

      {!board.isLoading && !board.isError && items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5EAF0] bg-white px-5 py-8 text-sm text-[#4B5563]">
          <p>
            No doctors with an open schedule on{' '}
            <span className="font-semibold text-[#1A1F36]">{date}</span>.
          </p>
          {nextScheduledDate ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p>
                Next open schedule is on{' '}
                <span className="font-semibold text-[#1A1F36]">{nextScheduledDate}</span>.
              </p>
              <button
                type="button"
                onClick={() => setDate(nextScheduledDate)}
                className="rounded-xl bg-[#0B2A4A] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#081F37]"
              >
                Open {nextScheduledDate} queue
              </button>
            </div>
          ) : (
            <p className="mt-2">
              Add or edit a doctor schedule from Manage Doctors to see them here.
            </p>
          )}
          {date !== today ? (
            <div className="mt-4">
              <BackButton size="sm" onClick={() => setDate(today)}>
                Back to today
              </BackButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-sm text-[#B91C1C]">
          {actionError}
        </div>
      ) : null}

      {viewMode === 'multi' && items.length > 0 ? (
        <div
          className={
            isFullScreen
              ? 'grid grid-cols-1 gap-6 pt-3 pb-5 sm:grid-cols-2 lg:grid-cols-4'
              : 'grid grid-cols-1 gap-6 pt-3 pb-5 lg:grid-cols-2 2xl:grid-cols-3'
          }
        >
          {items.map((item) => {
            const active = item.doctor._id === activeItem?.doctor._id;
            return (
              <MultiDoctorColumn
                key={item.doctor._id}
                item={item}
                active={active}
                busy={isDoctorBusy(item.doctor._id)}
                onSelect={() => setActiveDoctorId(item.doctor._id)}
                onAddPatient={() => {
                  setActiveDoctorId(item.doctor._id);
                  setAddPatientOpen(true);
                }}
                onCloseBooking={() => onCloseBooking(item.doctor._id)}
                onPrevious={() => runLiveOp(item.doctor._id, 'previous')}
                onPauseToggle={() =>
                  runLiveOp(item.doctor._id, item.onBreak ? 'resume' : 'break')
                }
                onNext={() => runLiveOp(item.doctor._id, 'next')}
                onMarkArrived={(appointmentId) => onMarkArrived(appointmentId, item.doctor._id)}
                onUnmarkArrived={(appointmentId) => onUnmarkArrived(appointmentId, item.doctor._id)}
                onCancel={(appt) => openCancel(appt, item.doctor._id)}
              />
            );
          })}
        </div>
      ) : null}

      {viewMode === 'single' && activeItem ? (
        <SingleDoctorView
          item={activeItem}
          busy={isDoctorBusy(activeItem.doctor._id)}
          onAddPatient={() => setAddPatientOpen(true)}
          onCloseBooking={() => onCloseBooking(activeItem.doctor._id)}
          onPrevious={() => runLiveOp(activeItem.doctor._id, 'previous')}
          onPauseToggle={() =>
            runLiveOp(activeItem.doctor._id, activeItem.onBreak ? 'resume' : 'break')
          }
          onNext={() => runLiveOp(activeItem.doctor._id, 'next')}
          onMarkArrived={(appointmentId) => onMarkArrived(appointmentId, activeItem.doctor._id)}
          onUnmarkArrived={(appointmentId) => onUnmarkArrived(appointmentId, activeItem.doctor._id)}
          onCancel={(appt) => openCancel(appt, activeItem.doctor._id)}
        />
      ) : null}

      <CancelTokenModal
        open={Boolean(cancelTarget)}
        tokenLabel={cancelTarget?.tokenLabel || '—'}
        consultationFee={cancelTarget?.consultationFee ?? 0}
        defaultPhone={cancelTarget?.phone}
        submitting={updateStatus.isPending}
        error={updateStatus.error}
        onClose={() => {
          if (!updateStatus.isPending) setCancelTarget(null);
        }}
        onConfirm={confirmCancel}
      />

      <AddPatientModal
        open={addPatientOpen}
        defaultDoctorId={activeDoctorId || activeItem?.doctor._id}
        defaultDate={date}
        onClose={() => setAddPatientOpen(false)}
      />

      <CloseBookingChoiceModal
        open={Boolean(closeChoiceItem)}
        doctorName={doctorDisplayName(closeChoiceItem?.doctor.name)}
        onClose={() => setCloseChoiceDoctorId('')}
        onMoveOp={() => {
          if (!closeChoiceDoctorId) return;
          setMoveDoctorId(closeChoiceDoctorId);
          setCloseChoiceDoctorId('');
          setMoveError('');
        }}
        onCloseOp={() => {
          if (!closeChoiceDoctorId) return;
          closeBookingOnly(closeChoiceDoctorId);
        }}
      />

      <MoveOpModal
        open={Boolean(moveItem)}
        doctorName={doctorDisplayName(moveItem?.doctor.name)}
        defaultFromOp={defaultFromOp}
        defaultToOp={defaultToOp}
        pendingCount={pendingQueueTokens.length}
        doctorOptions={moveDoctorOptions}
        submitting={moveOps.isPending}
        apiError={moveError}
        onClose={() => {
          if (!moveOps.isPending) {
            setMoveDoctorId('');
            setMoveError('');
          }
        }}
        onConfirm={({ fromOp, toOp, toDoctorId }) => {
          if (!moveDoctorId) return;
          setMoveError('');
          moveOps.mutate(
            {
              fromDoctorId: moveDoctorId,
              date,
              toDoctorId,
              fromOp,
              toOp,
              closeSource: true,
            },
            {
              onSuccess: (result) => {
                setMoveDoctorId('');
                showToast(
                  `Moved ${result.movedCount} OP${result.movedCount === 1 ? '' : 's'} and closed booking`,
                );
                if (viewMode === 'single') setViewMode('multi');
              },
              onError: (err) => {
                const message = getApiErrorMessage(err);
                setMoveError(message);
                showToast(message, 'error');
              },
            },
          );
        }}
      />
    </div>
  );
};

const StatCell = ({
  label,
  value,
  icon,
  valueClassName = 'text-[#1A1F36]',
}: {
  label: string;
  value: number;
  icon: ReactNode;
  valueClassName?: string;
}) => (
  <div className="flex flex-col items-center px-3 py-3 text-center sm:px-5">
    <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#5B6577]">
      {icon}
      <span>{label}</span>
    </div>
    <p className={['text-[28px] font-bold leading-none', valueClassName].join(' ')}>{value}</p>
  </div>
);

const MultiDoctorColumn = ({
  item,
  active,
  busy,
  onSelect,
  onAddPatient,
  onCloseBooking,
  onPrevious,
  onPauseToggle,
  onNext,
  onMarkArrived,
  onUnmarkArrived,
  onCancel,
}: {
  item: LiveBoardItemDto;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onAddPatient: () => void;
  onCloseBooking: () => void;
  onPrevious: () => void;
  onPauseToggle: () => void;
  onNext: () => void;
  onMarkArrived: (id: string) => void;
  onUnmarkArrived: (id: string) => void;
  onCancel: (appt: AppointmentResponseDto) => void;
}) => {
  const opList = item.queue ?? item.upcoming ?? [];
  const waiting = item.waiting ?? [];
  const served = item.served ?? [];
  const current = item.current ?? null;
  const waitingCount = item.waitingCount ?? waiting.length;
  const liveKey = `${item.liveOpNumber}-${current?._id || 'empty'}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={[
        'group relative flex min-h-[520px] flex-col overflow-hidden rounded-[24px] border bg-white transition-[transform,box-shadow,border-color] duration-300 ease-out',
        active
          ? 'z-10 -translate-y-3 scale-[1.015] border-[#0B2A4A]/25 shadow-[0_32px_56px_-20px_rgba(15,23,42,0.32),0_10px_20px_-10px_rgba(15,23,42,0.18)]'
          : 'translate-y-0 scale-100 border-[#E5EAF0] shadow-[0_10px_24px_-14px_rgba(15,23,42,0.16),0_2px_8px_rgba(15,23,42,0.05)] hover:-translate-y-1 hover:shadow-[0_18px_36px_-16px_rgba(15,23,42,0.2)]',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-none absolute inset-x-0 top-0 h-1',
          active ? 'bg-[#0B2A4A]' : 'bg-transparent',
        ].join(' ')}
      />

      <div className="flex items-start gap-3.5 px-5 pb-4 pt-5">
        <DoctorAvatar name={item.doctor.name} image={item.doctor.profileImage} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[17px] font-bold text-[#1A1F36]">
              {doctorDisplayName(item.doctor.name)}
            </p>
            <span
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                item.onBreak ? 'bg-[#F59E0B]' : 'bg-[#16A34A]',
              ].join(' ')}
            />
            {active ? (
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#0B2A4A]">
                Active
              </span>
            ) : null}
            {item.isClosed ? (
              <span className="rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#DC2626]">
                Closed
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[14px] font-medium text-[#334155]">
            {item.doctor.specialization || 'General OP'}
          </p>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-3.5 px-5 pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Button is full-width to align with the Live OP card. */}
        <div className="w-full">
          <button
            type="button"
            onClick={onAddPatient}
            className="inline-flex w-full justify-center items-center gap-1.5 rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-4 py-2.5 text-[14px] font-semibold text-[#15803D] shadow-sm transition hover:bg-[#DCFCE7]"
          >
            + Add Patient
          </button>
        </div>

        <div className="[perspective:1100px]">
          <div
            key={liveKey}
            className={[
              'live-op-flip rounded-2xl border px-4 py-3.5 shadow-[0_10px_28px_-16px_rgba(220,38,38,0.35)]',
              active
                ? 'border-[#FECACA] bg-gradient-to-b from-[#FFF7F7] to-[#FFEEEE]'
                : 'border-[#F3D4D4] bg-[#FFF9F9]',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-[#DC2626]">
                  Live OP
                </p>
                <p className="mt-1 truncate text-[16px] font-bold text-[#0F172A]">
                  {current ? shortPatientName(current) : 'Waiting for patient'}
                </p>
                {current ? (
                  <p className="mt-0.5 text-[13px] font-medium text-[#475569]">
                    {patientMetaLine(current)}
                  </p>
                ) : null}
              </div>
              <p className="text-[42px] font-black leading-none text-[#DC2626]">
                {item.liveOpNumber || '—'}
              </p>
            </div>
            <div className="mt-3.5 flex items-center gap-2">
              {/* Only show Mark Arrived if the appointment is active and not completed or cancelled */}
              {current &&
              current.status !== APPOINTMENT_STATUS.COMPLETED &&
              current.status !== APPOINTMENT_STATUS.CANCELLED &&
              !current.arrivedAt ? (
                <button
                  type="button"
                  onClick={() => onMarkArrived(current._id)}
                  disabled={busy}
                  className="rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-3.5 py-2 text-[13px] font-semibold text-[#15803D] shadow-sm transition hover:bg-[#DCFCE7] disabled:opacity-50"
                >
                  Mark Arrived
                </button>
              ) : null}
              {current?.status === APPOINTMENT_STATUS.COMPLETED ? (
                <span className="rounded-lg bg-[#F1F5F9] px-3.5 py-2 text-[13px] font-semibold text-[#475569]">
                  Consulted
                </span>
              ) : current?.arrivedAt ? (
                <span className="rounded-lg bg-[#ECFDF3] px-3.5 py-2 text-[13px] font-semibold text-[#15803D]">
                  Arrived
                </span>
              ) : null}
              <button
                type="button"
                onClick={onCloseBooking}
                disabled={busy}
                className="rounded-lg bg-[#DC2626] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#B91C1C] disabled:opacity-50"
              >
                Close Booking
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Back button to revert accidentally advancing to the next patient */}
          <IconBtn label="Back (Previous Patient)" onClick={onPrevious} disabled={busy || item.liveOpNumber === 0}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6 9 12l6 6" />
            </svg>
          </IconBtn>
          <IconBtn
            label={item.onBreak ? 'Resume' : 'Pause'}
            onClick={onPauseToggle}
            disabled={busy}
          >
            {item.onBreak ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M8 5v14l11-7-11-7Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </IconBtn>
          <button
            type="button"
            onClick={onNext}
            disabled={busy || item.onBreak}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B2A4A] px-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#081F37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Patient
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto pr-0.5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-[#0F172A]">
                OP list
                <span className="ml-1.5 font-bold text-[#0B2A4A]">({opList.length})</span>
              </h3>
              <span className="rounded-full bg-[#0B2A4A] px-2.5 py-1 text-[12px] font-bold text-white">
                {opList.length} {opList.length === 1 ? 'patient' : 'patients'}
              </span>
            </div>
            {opList.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3 py-6 text-center text-[14px] font-medium text-[#64748B]">
                No patients left in the OP list
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {opList.map((appt, index) => (
                  <MultiQueueRow
                    key={appt._id}
                    appt={appt}
                    busy={busy}
                    highlight={index === 0}
                    onMarkArrived={() => onMarkArrived(appt._id)}
                    onUnmarkArrived={() => onUnmarkArrived(appt._id)}
                    onCancel={() => onCancel(appt)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 border-t border-[#EEF2F6] pt-3">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#0F172A]">
                Waiting
              </h3>
              <span className="rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-[12px] font-bold text-[#C2410C]">
                {waitingCount}
              </span>
            </div>
            {waitingCount === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3 py-6 text-center text-[14px] font-medium text-[#64748B]">
                Next Patient without Mark Arrived moves them here
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {waiting.map((appt) => (
                  <WaitingRow
                    key={appt._id}
                    appt={appt}
                    busy={busy}
                    onMarkArrived={() => onMarkArrived(appt._id)}
                    onCancel={() => onCancel(appt)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 border-t border-[#EEF2F6] pt-3">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#0F172A]">
                Consulted
              </h3>
              <span className="rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[12px] font-bold text-[#15803D]">
                {served.length}
              </span>
            </div>
            {served.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E5EAF0] bg-[#F8FAFC] px-3 py-6 text-center text-[14px] font-medium text-[#64748B]">
                Mark Arrived, then Next Patient to move them here
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {served.map((appt) => (
                  <ConsultedRow key={appt._id} appt={appt} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const MultiQueueRow = ({
  appt,
  busy,
  highlight = false,
  onMarkArrived,
  onUnmarkArrived,
  onCancel,
}: {
  appt: AppointmentResponseDto;
  busy: boolean;
  highlight?: boolean;
  onMarkArrived: () => void;
  onUnmarkArrived: () => void;
  onCancel: () => void;
}) => {
  const arrived = Boolean(appt.arrivedAt);
  return (
    <div
      className={[
        'queue-row-enter rounded-xl border px-2.5 py-2 shadow-[0_3px_10px_-8px_rgba(15,23,42,0.16)]',
        highlight
          ? 'border-[#CBD5E1] bg-gradient-to-b from-white to-[#F8FAFC]'
          : 'border-[#E5EAF0] bg-white',
      ].join(' ')}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B2A4A] text-[13px] font-black text-white">
          {appt.tokenNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-[#0F172A]">
            {shortPatientName(appt)}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium leading-tight text-[#475569]">
            {patientMetaLine(appt)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <ChannelBadge offline={isWalkIn(appt)} />
            {arrived ? (
              <span className="inline-flex rounded-md bg-[#ECFDF3] px-1.5 py-px text-[10px] font-bold text-[#15803D]">
                Arrived
              </span>
            ) : null}
            {highlight ? (
              <span className="inline-flex rounded-md bg-[#FFF7ED] px-1.5 py-px text-[10px] font-bold text-[#C2410C]">
                Next up
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {appt.status === APPOINTMENT_STATUS.COMPLETED ? (
          <span className="flex-1 rounded-md bg-[#F1F5F9] px-2 py-1 text-center text-[11px] font-semibold text-[#475569]">
            Consulted
          </span>
        ) : appt.status === APPOINTMENT_STATUS.CANCELLED ? (
          <div className="flex flex-1 flex-col items-center">
            {/* Distinguish Auto Cancelled appointments from normal manual/patient cancellations */}
            <span className="w-full rounded-md bg-[#FEE2E2] px-2 py-1 text-center text-[11px] font-semibold text-[#DC2626]">
              {(appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                appt.cancellationReason === 'Patient Not Arrived')
                ? 'Auto Cancelled'
                : 'Cancelled'}
            </span>
            {(appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
              appt.cancellationReason === 'Patient Not Arrived') && (
              <PatientNotArrivedBadge className="mt-1" />
            )}
          </div>
        ) : (
          <>
            {arrived ? (
              <button
                type="button"
                disabled={busy}
                onClick={onUnmarkArrived}
                className="flex-1 rounded-md border border-[#FECACA] bg-white px-2 py-1 text-[11px] font-bold text-[#E11D48] transition hover:bg-[#FFF1F2] disabled:opacity-50"
              >
                Not Arrived
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onMarkArrived}
                className="flex-1 rounded-md border border-[#86EFAC] bg-[#F0FDF4] px-2 py-1 text-[11px] font-bold text-[#15803D] disabled:opacity-50"
              >
                Mark Arrived
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="flex-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2 py-1 text-[11px] font-bold text-[#DC2626] disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const WaitingRow = ({
  appt,
  busy,
  onMarkArrived,
  onCancel,
}: {
  appt: AppointmentResponseDto;
  busy: boolean;
  onMarkArrived: () => void;
  onCancel: () => void;
}) => (
  <div className="queue-row-enter flex items-center gap-2 rounded-xl border border-[#FED7AA] bg-[#FFFBEB] px-2.5 py-1.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F59E0B] text-[13px] font-black text-white">
      {appt.tokenNumber}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-bold leading-tight text-[#0F172A]">
        {shortPatientName(appt)}
      </p>
      <p className="mt-px truncate text-[11px] font-medium leading-tight text-[#64748B]">
        {patientMetaLine(appt)}
      </p>
    </div>
    <button
      type="button"
      disabled={busy}
      onClick={onMarkArrived}
      className="shrink-0 rounded-md border border-[#86EFAC] bg-[#F0FDF4] px-2 py-1 text-[11px] font-bold text-[#15803D] disabled:opacity-50"
    >
      Mark Arrived
    </button>
    <button
      type="button"
      disabled={busy}
      onClick={onCancel}
      aria-label="Cancel token"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#FECACA] bg-white text-[#E11D48] disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-12" />
      </svg>
    </button>
  </div>
);

const ConsultedRow = ({ appt }: { appt: AppointmentResponseDto }) => (
  <div className="queue-row-enter flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E2E8F0] text-[13px] font-black text-[#0F172A]">
      {appt.tokenNumber}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-bold leading-tight text-[#0F172A]">
        {shortPatientName(appt)}
      </p>
      <p className="mt-px truncate text-[11px] font-medium leading-tight text-[#64748B]">
        {patientMetaLine(appt)}
      </p>
    </div>
    <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      Done
    </span>
  </div>
);

const SingleDoctorView = ({
  item,
  busy,
  onAddPatient,
  onCloseBooking,
  onPrevious,
  onPauseToggle,
  onNext,
  onMarkArrived,
  onUnmarkArrived,
  onCancel,
}: {
  item: LiveBoardItemDto;
  busy: boolean;
  onAddPatient: () => void;
  onCloseBooking: () => void;
  onPrevious: () => void;
  onPauseToggle: () => void;
  onNext: () => void;
  onMarkArrived: (id: string) => void;
  onUnmarkArrived: (id: string) => void;
  onCancel: (appt: AppointmentResponseDto) => void;
}) => {
  const opList = item.queue ?? item.upcoming ?? [];
  const waiting = item.waiting ?? [];
  const served = item.served ?? [];
  const current = item.current ?? null;
  const waitingCount = item.waitingCount ?? waiting.length;
  const liveKey = `${item.liveOpNumber}-${current?._id || 'empty'}`;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Button is full-width to align with the Live OP card. */}
      <div className="w-full">
        <button
          type="button"
          onClick={onAddPatient}
          className="inline-flex w-full justify-center items-center gap-1.5 rounded-lg border border-[#86EFAC] bg-[#ECFDF3] px-4 py-2.5 text-[14px] font-semibold text-[#16A34A] transition hover:bg-[#DCFCE7]"
        >
          + Add Patient
        </button>
      </div>

      {/* Now Serving — matches mockup: centered token, controls below */}
      <div className="rounded-[18px] border border-[#E5EAF0] bg-white px-6 pb-7 pt-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-8">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[22px] font-bold tracking-tight text-[#1A1F36]">Now Serving</h2>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-[#E11D48]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E11D48] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E11D48]" />
            </span>
            LIVE
          </span>
        </div>

        <div className="[perspective:1200px]">
          <div key={liveKey} className="live-op-flip flex flex-col items-center pb-2 pt-8 text-center">
            <p className="text-[96px] font-black leading-none tracking-tight text-[#E11D48] sm:text-[108px]">
              {item.liveOpNumber || '—'}
            </p>
            <p className="mt-3 text-[22px] font-bold text-[#0F172A]">
              {current ? patientAgeLabel(current) : 'Waiting for patient'}
            </p>
            {current ? (
              <p className="mt-1 text-[14px] font-medium text-[#475569]">
                {patientMetaLine(current)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {/* Back button to revert accidentally advancing to the next patient */}
          <button
            type="button"
            onClick={onPrevious}
            disabled={busy || item.liveOpNumber === 0}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#D0DCEE] bg-white px-5 text-[14px] font-semibold text-[#1A1F36] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"
            title="Back / Previous Patient"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6 9 12l6 6" />
            </svg>
            Back / Previous Patient
          </button>

          <button
            type="button"
            aria-label={item.onBreak ? 'Resume' : 'Pause'}
            title={item.onBreak ? 'Resume' : 'Pause'}
            onClick={onPauseToggle}
            disabled={busy}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#D0DCEE] bg-white text-[#1A1F36] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {item.onBreak ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M8 5v14l11-7-11-7Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={busy || item.onBreak}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#0B2A4A] px-6 text-[14px] font-bold text-white transition hover:bg-[#081F37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next Patient
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        {current && !current.arrivedAt ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => onMarkArrived(current._id)}
              disabled={busy}
              className="inline-flex items-center rounded-lg border border-[#86EFAC] bg-[#F0FDF4] px-4 py-2 text-[13px] font-bold text-[#15803D] transition hover:bg-[#DCFCE7] disabled:opacity-50"
            >
              Mark Arrived
            </button>
          </div>
        ) : null}
        {current?.arrivedAt ? (
          <div className="mt-4 flex justify-center">
            <span className="inline-flex items-center rounded-lg bg-[#ECFDF3] px-4 py-2 text-[13px] font-bold text-[#15803D]">
              Arrived — Next Patient moves them to Consulted
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[20px] font-bold text-[#0F172A]">
          OP list ({opList.length} {opList.length === 1 ? 'patient' : 'patients'})
        </h3>
        <button
          type="button"
          onClick={onCloseBooking}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-[#FFF1F2] px-3.5 py-2 text-[13px] font-semibold text-[#E11D48] transition hover:bg-[#FFE4E6] disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8" />
            <path d="M8.5 8.5l7 7" />
          </svg>
          Close booking
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {opList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5EAF0] bg-white px-4 py-10 text-center text-[15px] font-medium text-[#64748B]">
            No patients left in the OP list
          </div>
        ) : (
          opList.map((appt, index) => (
            <SingleQueueRow
              key={appt._id}
              appt={appt}
              busy={busy}
              highlight={index === 0}
              onMarkArrived={() => onMarkArrived(appt._id)}
              onUnmarkArrived={() => onUnmarkArrived(appt._id)}
              onCancel={() => onCancel(appt)}
            />
          ))
        )}
      </div>

      <section className="flex flex-col gap-2 border-t border-[#EEF2F6] pt-5">
        <h3 className="text-[20px] font-bold text-[#0F172A]">Waiting ({waitingCount})</h3>
        {waiting.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5EAF0] bg-white px-4 py-10 text-center text-[15px] font-medium text-[#64748B]">
            Next Patient without Mark Arrived moves them here
          </div>
        ) : (
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-0.5">
            {waiting.map((appt) => (
              <WaitingRow
                key={appt._id}
                appt={appt}
                busy={busy}
                onMarkArrived={() => onMarkArrived(appt._id)}
                onCancel={() => onCancel(appt)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-[#EEF2F6] pt-5">
        <h3 className="text-[20px] font-bold text-[#0F172A]">Consulted ({served.length})</h3>
        {served.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5EAF0] bg-white px-4 py-10 text-center text-[15px] font-medium text-[#64748B]">
            Mark Arrived, then Next Patient to move them here
          </div>
        ) : (
          <div className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-0.5">
            {served.map((appt) => (
              <ConsultedRow key={appt._id} appt={appt} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const SingleQueueRow = ({
  appt,
  busy,
  highlight = false,
  onMarkArrived,
  onUnmarkArrived,
  onCancel,
}: {
  appt: AppointmentResponseDto;
  busy: boolean;
  highlight?: boolean;
  onMarkArrived: () => void;
  onUnmarkArrived: () => void;
  onCancel: () => void;
}) => {
  const arrived = Boolean(appt.arrivedAt);
  const patient = asPatient(appt.patientId);
  const place = patient?.place || patient?.address;
  const agePart = patient?.age != null ? `${patient.age} yrs` : null;

  return (
    <div
      className={[
        'queue-row-enter flex items-center gap-2.5 rounded-xl border bg-white px-3 py-2 shadow-[0_3px_10px_-8px_rgba(15,23,42,0.14)] sm:gap-3 sm:px-3.5',
        highlight ? 'border-[#CBD5E1]' : 'border-[#E5EAF0]',
      ].join(' ')}
    >
      <span className="shrink-0 cursor-grab text-[#C5CDD8]" aria-hidden>
        <svg viewBox="0 0 16 24" width="10" height="14" fill="currentColor">
          <circle cx="4" cy="5" r="1.6" />
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="4" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="4" cy="19" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </span>

      <p className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B2A4A] text-[14px] font-black text-white">
        {appt.tokenNumber}
      </p>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold leading-tight text-[#0F172A]">
          {fullPatientName(appt)}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium text-[#475569]">
          <span>{[agePart, place].filter(Boolean).join(' • ') || '—'}</span>
          <ChannelBadge offline={isWalkIn(appt)} />
          {arrived ? (
            <span className="inline-flex rounded-md bg-[#ECFDF3] px-1.5 py-px text-[10px] font-bold text-[#15803D]">
              Arrived
            </span>
          ) : null}
          {highlight ? (
            <span className="inline-flex rounded-md bg-[#FFF7ED] px-1.5 py-px text-[10px] font-bold text-[#C2410C]">
              Next up
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {appt.status === APPOINTMENT_STATUS.COMPLETED ? (
          <span className="inline-flex rounded-md bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#475569]">
            Consulted
          </span>
        ) : appt.status === APPOINTMENT_STATUS.CANCELLED ? (
          <div className="flex flex-col items-end">
            {/* Distinguish Auto Cancelled appointments from normal manual/patient cancellations */}
            <span className="inline-flex rounded-md bg-[#FEE2E2] px-2.5 py-1 text-[11px] font-semibold text-[#DC2626]">
              {(appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
                appt.cancellationReason === 'Patient Not Arrived')
                ? 'Auto Cancelled'
                : 'Cancelled'}
            </span>
            {(appt.cancellation?.reason === 'PATIENT_NOT_ARRIVED' ||
              appt.cancellationReason === 'Patient Not Arrived') && (
              <PatientNotArrivedBadge className="mt-1" />
            )}
          </div>
        ) : (
          <>
            {arrived ? (
              <button
                type="button"
                disabled={busy}
                onClick={onUnmarkArrived}
                className="inline-flex rounded-md border border-[#FECACA] bg-white px-2.5 py-1 text-[11px] font-bold text-[#E11D48] transition hover:bg-[#FFF1F2] disabled:opacity-50"
              >
                Not Arrived
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onMarkArrived}
                className="inline-flex rounded-md border border-[#0B2A4A] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0B2A4A] transition hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                Mark Arrived
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              aria-label="Cancel token"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#FECACA] bg-white text-[#E11D48] transition hover:bg-[#FFF1F2] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M8 7l1 12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l1-12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
