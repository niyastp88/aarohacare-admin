import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import {
  useCreateSchedule,
  useDoctorSchedules,
  useDoctors,
  useSetScheduleClosed,
} from '@/hooks/useDoctors';
import {
  defaultEndTimeForStart,
  format12Hour,
  getNowInAppTz,
  nextValidStartTimeIst,
  todayIsoIst,
  validateScheduleAgainstNow,
} from '@/utils/dateTime';
import { formatDate, toTitleCase } from '@/utils/formatters';

const INTERVAL_PRESETS = ['15', '20', '30', '45', '60'] as const;

export const SchedulesPage = () => {
  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors();
  const initialStart = nextValidStartTimeIst();

  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIsoIst);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(() => defaultEndTimeForStart(initialStart));
  const [intervalMinutes, setIntervalMinutes] = useState('30');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const schedulesQuery = useDoctorSchedules(doctorId);
  const createSchedule = useCreateSchedule();
  const setScheduleClosed = useSetScheduleClosed();

  const today = todayIsoIst();
  const isToday = date === today;
  const nowClock = getNowInAppTz().time;
  const minStartTime = isToday ? nowClock : undefined;

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor._id === doctorId) ?? null,
    [doctorId, doctors],
  );

  useEffect(() => {
    if (!doctorId && doctors.length > 0) {
      setDoctorId(doctors[0]._id);
    }
  }, [doctorId, doctors]);

  /** Keep start time valid when the admin picks “today”. */
  useEffect(() => {
    if (!isToday) return;
    const nextStart = nextValidStartTimeIst();
    setStartTime((prev) => (prev <= getNowInAppTz().time ? nextStart : prev));
    setEndTime((prev) => {
      const nextStartNow = nextValidStartTimeIst();
      return prev <= nextStartNow ? defaultEndTimeForStart(nextStartNow) : prev;
    });
  }, [date, isToday]);

  const applyNowStart = () => {
    const nextStart = nextValidStartTimeIst();
    setDate(todayIsoIst());
    setStartTime(nextStart);
    setEndTime((prev) => (prev <= nextStart ? defaultEndTimeForStart(nextStart) : prev));
    setError('');
  };

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    setError('');
    if (nextDate === todayIsoIst()) {
      const nextStart = nextValidStartTimeIst();
      setStartTime(nextStart);
      setEndTime((prev) => (prev <= nextStart ? defaultEndTimeForStart(nextStart) : prev));
      return;
    }
    // Future day — comfortable clinic defaults.
    setStartTime('09:00');
    setEndTime((prev) => (prev <= '09:00' ? '13:00' : prev));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!doctorId) {
      setError('Add a doctor first, then create a schedule');
      return;
    }
    if (!date || !startTime || !endTime) {
      setError('Date, start time, and end time are required');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    const scheduleTimeError = validateScheduleAgainstNow(date, startTime);
    if (scheduleTimeError) {
      setError(scheduleTimeError);
      return;
    }

    createSchedule.mutate(
      {
        doctorId,
        date,
        startTime,
        endTime,
        intervalMinutes: Number(intervalMinutes) || 30,
      },
      {
        onSuccess: () => showToast('Schedule created'),
        onError: (err) => {
          const message = getApiErrorMessage(err);
          setError(message);
          showToast(message, 'error');
        },
      },
    );
  };

  const toggleClosed = (scheduleDate: string, isClosed: boolean) => {
    if (!doctorId) return;

    const run = () => {
      setActionError('');
      const key = `${scheduleDate}:${isClosed}`;
      setBusyKey(key);
      setScheduleClosed.mutate(
        { doctorId, date: scheduleDate, isClosed },
        {
          onSuccess: () =>
            showToast(isClosed ? 'Schedule closed for bookings' : 'Schedule reopened'),
          onError: (err) => {
            const message = getApiErrorMessage(err);
            setActionError(message);
            showToast(message, 'error');
          },
          onSettled: () => setBusyKey(''),
        },
      );
    };

    if (isClosed) {
      sweetAlert.confirm(
        'Close OP for this date?',
        'New bookings will stop for this day. Existing appointments stay.',
        run,
        { confirmText: 'Close OP', cancelText: 'Keep open', tone: 'warning' },
      );
      return;
    }

    run();
  };

  const schedules = schedulesQuery.data ?? [];
  const openCount = schedules.filter((item) => !item.isClosed).length;
  const closedCount = schedules.length - openCount;

  return (
    <div className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-light via-white to-white px-5 py-6 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-primary-soft/80 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-primary">
              Doctor OP
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900">Schedules</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Create day schedules, keep start times after now (IST), and close OP when a doctor is
              unavailable.
            </p>
          </div>
          {isToday && (
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-primary/15 bg-white/80 px-3 py-1.5 text-[13px] font-semibold text-primary-dark shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-success" />
              Today · {nowClock} IST
            </div>
          )}
        </div>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-border bg-primary-light/40 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Create a day schedule</h3>
              <p className="mt-0.5 text-sm text-muted">
                Date defaults to today. Start time auto-fills to the next valid slot.
              </p>
            </div>
            <Button type="button" variant="secondary" className="!py-2 !text-[13px]" onClick={applyNowStart}>
              Use now
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-5 py-5 sm:px-6">
          {doctorsLoading ? (
            <Spinner label="Loading doctors…" />
          ) : doctors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
              No doctors yet. Add a doctor first from the Doctors page.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-gray-900" htmlFor="schedule-doctor">
                Doctor
              </label>
              <select
                id="schedule-doctor"
                className="w-full rounded-2xl border border-border bg-white px-3.5 py-3 text-[15px] outline-none transition focus:border-primary"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {toTitleCase(doctor.name)}
                    {doctor.specialization ? ` — ${doctor.specialization}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DatePickerField
              label="Date"
              value={date}
              min={today}
              onChange={handleDateChange}
            />
            <Input
              label="Start time"
              type="time"
              value={startTime}
              min={minStartTime}
              onChange={(e) => {
                const next = e.target.value;
                setStartTime(next);
                setEndTime((prev) => (prev <= next ? defaultEndTimeForStart(next) : prev));
              }}
            />
            <Input
              label="End time"
              type="time"
              value={endTime}
              min={startTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-gray-900">Slot minutes</span>
              <div className="flex flex-wrap gap-2">
                {INTERVAL_PRESETS.map((preset) => {
                  const active = intervalMinutes === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setIntervalMinutes(preset)}
                      className={[
                        'rounded-xl px-3 py-2 text-[13px] font-bold transition',
                        active
                          ? 'bg-primary text-white shadow-sm'
                          : 'border border-border bg-white text-muted hover:border-primary hover:text-primary-dark',
                      ].join(' ')}
                    >
                      {preset}m
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="Custom slot minutes"
                inputMode="numeric"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-primary"
                placeholder="Custom minutes"
              />
            </div>
          </div>

          {isToday && (
            <div className="rounded-2xl border border-primary/15 bg-primary-light/70 px-4 py-3 text-sm text-primary-dark">
              Today’s schedule · start is set to <span className="font-bold">{format12Hour(startTime)}</span> (after{' '}
              {format12Hour(nowClock)} IST). Change it anytime as long as it stays after now.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-error/20 bg-error-soft px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={createSchedule.isPending} disabled={!doctorId}>
              Create schedule
            </Button>
            {selectedDoctor && (
              <p className="text-sm text-muted">
                For <span className="font-semibold text-gray-900">{toTitleCase(selectedDoctor.name)}</span>
              </p>
            )}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-base font-bold text-gray-900">Upcoming schedules</h3>
            <p className="mt-0.5 text-sm text-muted">
              Close OP to stop new bookings. Existing appointments stay.
            </p>
          </div>
          {schedules.length > 0 && (
            <div className="flex gap-2">
              <span className="rounded-full bg-success-soft px-3 py-1 text-[13px] font-bold text-success">
                {openCount} open
              </span>
              <span className="rounded-full bg-error-soft px-3 py-1 text-[13px] font-bold text-error">
                {closedCount} closed
              </span>
            </div>
          )}
        </div>

        <div className="px-5 py-5 sm:px-6">
          {!doctorId && <p className="text-sm text-muted">Select a doctor to view schedules.</p>}

          {doctorId && schedulesQuery.isLoading && <Spinner label="Loading schedules…" />}

          {doctorId && schedulesQuery.isError && (
            <p className="text-sm text-error">{getApiErrorMessage(schedulesQuery.error)}</p>
          )}

          {actionError && (
            <div className="mb-4 rounded-2xl border border-error/20 bg-error-soft px-4 py-3 text-sm text-error">
              {actionError}
            </div>
          )}

          {doctorId && !schedulesQuery.isLoading && !schedulesQuery.isError && schedules.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center">
              <p className="font-semibold text-gray-900">No upcoming schedules</p>
              <p className="mt-1 text-sm text-muted">Create one above for this doctor.</p>
            </div>
          )}

          {doctorId && schedules.length > 0 && (
            <div className="grid gap-3">
              {schedules.map((schedule) => {
                const booked = schedule.slots.filter((slot) => slot.isBooked).length;
                const first = schedule.startTime || schedule.slots[0]?.time;
                const last = schedule.endTime || schedule.slots[schedule.slots.length - 1]?.time;
                const formattedHours =
                  first && last ? `${format12Hour(first)} – ${format12Hour(last)}` : '—';
                const closed = Boolean(schedule.isClosed);
                const closingKey = `${schedule.date}:true`;
                const openingKey = `${schedule.date}:false`;
                const rowBusy =
                  setScheduleClosed.isPending &&
                  (busyKey === closingKey || busyKey === openingKey);
                const fill =
                  schedule.slots.length > 0
                    ? Math.round((booked / schedule.slots.length) * 100)
                    : 0;

                return (
                  <div
                    key={schedule._id}
                    className={[
                      'rounded-2xl border px-4 py-4 transition sm:px-5',
                      closed
                        ? 'border-error/20 bg-error-soft/40'
                        : 'border-border bg-white hover:border-primary/30 hover:shadow-sm',
                    ].join(' ')}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-bold text-gray-900">
                            {formatDate(schedule.date)}
                          </p>
                          <span
                            className={[
                              'rounded-full px-2.5 py-1 text-[12.5px] font-bold uppercase tracking-wide',
                              closed
                                ? 'bg-error-soft text-error'
                                : 'bg-success-soft text-success',
                            ].join(' ')}
                          >
                            {closed ? 'Closed' : 'Open'}
                          </span>
                          {schedule.date === today && (
                            <span className="rounded-full bg-primary-light px-2.5 py-1 text-[12.5px] font-bold text-primary-dark">
                              Today
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {formattedHours} · {schedule.slots.length} slots · {booked} booked
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-light">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${fill}%` }}
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant={closed ? 'secondary' : 'danger'}
                        loading={rowBusy}
                        disabled={setScheduleClosed.isPending}
                        className="shrink-0"
                        onClick={() => toggleClosed(schedule.date, !closed)}
                      >
                        {closed ? 'Reopen OP' : 'Close OP'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
