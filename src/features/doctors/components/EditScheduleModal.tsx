import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { MonthCalendar, buildMonthCells } from '@/components/ui/MonthCalendar';
import { showToast } from '@/components/ui/Toast';
import {
  useCreateSchedule,
  useDoctorSchedules,
  useSetScheduleClosed,
} from '@/hooks/useDoctors';
import type { DoctorResponseDto } from '@/types/dto';
import {
  defaultEndTimeForStart,
  format12Hour,
  getNowInAppTz,
  nextValidStartTimeIst,
  todayIsoIst,
  toHm,
  validateScheduleAgainstNow,
} from '@/utils/dateTime';
import { formatDate, toTitleCase } from '@/utils/formatters';

const DAY_TOGGLES = [
  { key: 'mon', label: 'M', dow: 1, name: 'Monday' },
  { key: 'tue', label: 'T', dow: 2, name: 'Tuesday' },
  { key: 'wed', label: 'W', dow: 3, name: 'Wednesday' },
  { key: 'thu', label: 'T', dow: 4, name: 'Thursday' },
  { key: 'fri', label: 'F', dow: 5, name: 'Friday' },
  { key: 'sat', label: 'S', dow: 6, name: 'Saturday' },
  { key: 'sun', label: 'S', dow: 0, name: 'Sunday' },
] as const;

const HOURS_12 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;
const MINUTES_5 = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'] as const;

/** How far ahead weekday chips apply (all matching dates in this window). */
const SCHEDULE_HORIZON_MONTHS = 4;

const toIso = (year: number, monthIndex: number, day: number) => {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

const parseIsoDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const isTomorrowIso = (iso: string, todayIso: string) => {
  const cur = parseIsoDate(todayIso);
  const target = parseIsoDate(iso);
  const diffDays = Math.round((target.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
};

const doctorDisplayName = (name?: string) => {
  const raw = (name || 'Doctor').trim();
  const titled = toTitleCase(raw.replace(/^dr\.?\s+/i, ''));
  return `Dr. ${titled}`;
};

const addMonths = (year: number, monthIndex: number, delta: number) => {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
};

/** Upcoming ISO dates for `dow` across the next N months from today. */
const datesForDowInHorizon = (dow: number, today: string, months = SCHEDULE_HORIZON_MONTHS) => {
  const [y, m] = today.split('-').map(Number);
  const startYear = y || new Date().getFullYear();
  const startMonth = (m || 1) - 1;
  const dates: string[] = [];

  for (let offset = 0; offset < months; offset += 1) {
    const { year, monthIndex } = addMonths(startYear, startMonth, offset);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (new Date(year, monthIndex, day).getDay() !== dow) continue;
      const iso = toIso(year, monthIndex, day);
      if (iso >= today) dates.push(iso);
    }
  }
  return dates;
};

export const parse24To12 = (hm: string): { hour12: string; minute: string; period: 'AM' | 'PM' } => {
  const trimmed = toHm(hm || '09:00');
  const [hStr, mStr] = trimmed.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h)) h = 9;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    hour12: String(h12).padStart(2, '0'),
    minute: String(Number.isNaN(m) ? 0 : m).padStart(2, '0'),
    period,
  };
};

export const format12To24 = (hour12: string, minute: string, period: 'AM' | 'PM'): string => {
  let h = parseInt(hour12, 10);
  const m = parseInt(minute, 10);
  if (Number.isNaN(h)) h = 9;
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, '0')}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')}`;
};

interface EditScheduleModalProps {
  open: boolean;
  doctor: DoctorResponseDto | null;
  onClose: () => void;
}

export const EditScheduleModal = ({ open, doctor, onClose }: EditScheduleModalProps) => {
  const today = todayIsoIst();
  const todayParts = today.split('-').map(Number);
  const initialYear = todayParts[0] || new Date().getFullYear();
  const initialMonth = (todayParts[1] || 1) - 1;

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  // Timing modes: 'same' = same time for all dates, 'separate' = separate timer per date
  const [timeMode, setTimeMode] = useState<'same' | 'separate'>('same');
  const [globalStartTime, setGlobalStartTime] = useState('09:00');
  const [globalEndTime, setGlobalEndTime] = useState('17:00');

  // Separate individual timings per date
  const [dateTimes, setDateTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});

  // Month tab navigation for separate mode: 'all' or 'YYYY-MM'
  const [activeMonthTab, setActiveMonthTab] = useState<string>('all');
  // Weekday filter: 'all' or 'mon' | 'tue' | ...
  const [weekdayFilter, setWeekdayFilter] = useState<string>('all');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const createSchedule = useCreateSchedule();
  const setClosed = useSetScheduleClosed();
  const schedulesQuery = useDoctorSchedules(doctor?._id || '');

  const existingByDate = useMemo(() => {
    const map = new Map<string, { isClosed?: boolean; startTime?: string; endTime?: string }>();
    for (const schedule of schedulesQuery.data ?? []) {
      map.set(schedule.date, {
        isClosed: schedule.isClosed,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      });
    }
    return map;
  }, [schedulesQuery.data]);

  const hasUpcomingOpen = useMemo(() => {
    return (schedulesQuery.data ?? []).some(
      (schedule) => schedule.date >= today && !schedule.isClosed,
    );
  }, [schedulesQuery.data, today]);

  useEffect(() => {
    if (!open || !doctor) return;
    setViewYear(initialYear);
    setViewMonth(initialMonth);
    setError('');
    setActiveMonthTab('all');
    setWeekdayFilter('all');

    const nowTime = getNowInAppTz().time;
    const validStartToday = nextValidStartTimeIst();
    const validEndToday = defaultEndTimeForStart(validStartToday);

    // Prefill with existing open schedules from today onward, else today.
    const openSchedules = (schedulesQuery.data ?? []).filter(
      (schedule) => schedule.date >= today && !schedule.isClosed,
    );

    const initialMap: Record<string, { startTime: string; endTime: string }> = {};
    let hasDifferentTimes = false;
    let baseTime: { startTime: string; endTime: string } | null = null;

    for (const s of openSchedules) {
      let st = s.startTime || '09:00';
      let et = s.endTime || '17:00';
      if (s.date === today && st <= nowTime) {
        st = validStartToday;
        if (et <= validStartToday) et = validEndToday;
      }
      initialMap[s.date] = { startTime: st, endTime: et };
      if (!baseTime) {
        baseTime = { startTime: st, endTime: et };
      } else if (baseTime.startTime !== st || baseTime.endTime !== et) {
        hasDifferentTimes = true;
      }
    }

    const openDates = openSchedules.map((s) => s.date).sort();
    const datesToInit = openDates.length > 0 ? openDates : [today];

    for (const d of datesToInit) {
      if (!initialMap[d]) {
        const existing = existingByDate.get(d);
        let defaultSt = existing?.startTime || baseTime?.startTime || '09:00';
        let defaultEt = existing?.endTime || baseTime?.endTime || '17:00';
        if (d === today && defaultSt <= nowTime) {
          defaultSt = validStartToday;
          if (defaultEt <= validStartToday) defaultEt = validEndToday;
        }
        initialMap[d] = {
          startTime: defaultSt,
          endTime: defaultEt,
        };
      }
    }

    const initialStart = baseTime?.startTime || '09:00';
    const initialEnd = baseTime?.endTime || '17:00';
    const safeStart =
      datesToInit.includes(today) && initialStart <= nowTime ? validStartToday : initialStart;
    const safeEnd =
      datesToInit.includes(today) && initialEnd <= safeStart ? validEndToday : initialEnd;

    setSelectedDates(datesToInit);
    setDateTimes(initialMap);
    setGlobalStartTime(safeStart);
    setGlobalEndTime(safeEnd);
    setTimeMode(hasDifferentTimes ? 'separate' : 'same');
  }, [open, doctor, today, initialYear, initialMonth, schedulesQuery.data, existingByDate]);

  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const datesToSave = useMemo(
    () => selectedDates.filter((date) => date >= today).sort(),
    [selectedDates, today],
  );

  // Group dates by Month ('YYYY-MM') for the month tabs
  const monthsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of datesToSave) {
      const key = d.slice(0, 7);
      const list = map.get(key) || [];
      list.push(d);
      map.set(key, list);
    }
    return map;
  }, [datesToSave]);

  // Filter dates for separate mode by selected month tab and weekday filter
  const displayedDates = useMemo(() => {
    let list = datesToSave;
    if (activeMonthTab !== 'all') {
      list = list.filter((d) => d.startsWith(activeMonthTab));
    }
    if (weekdayFilter !== 'all') {
      const targetDow = DAY_TOGGLES.find((d) => d.key === weekdayFilter)?.dow;
      if (targetDow !== undefined) {
        list = list.filter((d) => parseIsoDate(d).getDay() === targetDow);
      }
    }
    return list;
  }, [datesToSave, activeMonthTab, weekdayFilter]);

  const maxHorizonIso = useMemo(() => {
    const [y, m] = today.split('-').map(Number);
    const { year, monthIndex } = addMonths(
      y || new Date().getFullYear(),
      (m || 1) - 1,
      SCHEDULE_HORIZON_MONTHS - 1,
    );
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return toIso(year, monthIndex, daysInMonth);
  }, [today]);

  const toggleDate = (iso: string) => {
    if (iso < today || iso > maxHorizonIso) return;
    const nowTime = getNowInAppTz().time;
    const validStartToday = nextValidStartTimeIst();
    const validEndToday = defaultEndTimeForStart(validStartToday);

    setSelectedDates((prev) => {
      const exists = prev.includes(iso);
      if (exists) {
        return prev.filter((date) => date !== iso);
      } else {
        setDateTimes((curr) => {
          if (curr[iso]) return curr;
          const existing = existingByDate.get(iso);
          let st = existing?.startTime || globalStartTime || '09:00';
          let et = existing?.endTime || globalEndTime || '17:00';
          if (iso === today && st <= nowTime) {
            st = validStartToday;
            if (et <= validStartToday) et = validEndToday;
          }
          return {
            ...curr,
            [iso]: { startTime: st, endTime: et },
          };
        });
        return [...prev, iso].sort();
      }
    });
  };

  const calendarCells = useMemo(
    () =>
      buildMonthCells({
        year: viewYear,
        monthIndex: viewMonth,
        mapDay: (iso, _day, inMonth) => {
          if (!inMonth) return { disabled: true };
          const past = iso < today;
          const beyondHorizon = iso > maxHorizonIso;
          const hasSchedule = existingByDate.has(iso) && !existingByDate.get(iso)?.isClosed;
          const selected = selectedSet.has(iso);
          if (past) {
            return {
              disabled: true,
              soft: hasSchedule,
              title: 'Past date',
            };
          }
          if (beyondHorizon) {
            return {
              disabled: true,
              soft: hasSchedule,
              title: `Beyond ${SCHEDULE_HORIZON_MONTHS}-month window`,
            };
          }
          return {
            selected,
            soft: hasSchedule && !selected,
            title: selected ? 'Remove this date' : 'Add this date',
            onClick: () => toggleDate(iso),
          };
        },
      }),
    [viewYear, viewMonth, today, maxHorizonIso, existingByDate, selectedSet],
  );

  const shiftMonth = (delta: number) => {
    const target = new Date(viewYear, viewMonth + delta, 1);
    const minTarget = new Date(initialYear, initialMonth, 1);
    const maxTarget = new Date(initialYear, initialMonth + SCHEDULE_HORIZON_MONTHS - 1, 1);
    if (target < minTarget || target > maxTarget) return;

    const nextY = target.getFullYear();
    const nextM = target.getMonth();
    setViewYear(nextY);
    setViewMonth(nextM);
    const nextMonthKey = `${nextY}-${String(nextM + 1).padStart(2, '0')}`;
    // If viewing month tab, sync with calendar navigation
    if (activeMonthTab !== 'all' && monthsMap.has(nextMonthKey)) {
      setActiveMonthTab(nextMonthKey);
    }
  };

  const isDowFullySelected = (dow: number) => {
    const dates = datesForDowInHorizon(dow, today);
    return dates.length > 0 && dates.every((date) => selectedSet.has(date));
  };

  const isDowPartiallySelected = (dow: number) => {
    const dates = datesForDowInHorizon(dow, today);
    return dates.some((date) => selectedSet.has(date)) && !isDowFullySelected(dow);
  };

  const toggleDow = (dow: number) => {
    const horizonDates = datesForDowInHorizon(dow, today);
    if (horizonDates.length === 0) return;
    const nowTime = getNowInAppTz().time;
    const validStartToday = nextValidStartTimeIst();
    const validEndToday = defaultEndTimeForStart(validStartToday);

    setSelectedDates((prev) => {
      const set = new Set(prev);
      const allOn = horizonDates.every((date) => set.has(date));
      if (allOn) {
        horizonDates.forEach((date) => set.delete(date));
        return Array.from(set).sort();
      } else {
        horizonDates.forEach((date) => set.add(date));
        const nextList = Array.from(set).sort();
        setDateTimes((curr) => {
          const next = { ...curr };
          for (const d of horizonDates) {
            if (!next[d]) {
              const existing = existingByDate.get(d);
              let st = existing?.startTime || globalStartTime || '09:00';
              let et = existing?.endTime || globalEndTime || '17:00';
              if (d === today && st <= nowTime) {
                st = validStartToday;
                if (et <= validStartToday) et = validEndToday;
              }
              next[d] = { startTime: st, endTime: et };
            }
          }
          return next;
        });
        return nextList;
      }
    });
  };

  const handleGlobalStartChange = (val: string) => {
    setGlobalStartTime(val);
    let newEnd = globalEndTime;
    if (globalEndTime <= val) {
      newEnd = defaultEndTimeForStart(val);
      setGlobalEndTime(newEnd);
    }
    setError('');
    setDateTimes((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        next[d] = {
          startTime: val,
          endTime: next[d]?.endTime && next[d].endTime > val ? next[d].endTime : newEnd,
        };
      }
      return next;
    });
  };

  const handleGlobalEndChange = (val: string) => {
    setGlobalEndTime(val);
    setError('');
    setDateTimes((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        next[d] = { ...(next[d] || { startTime: globalStartTime }), endTime: val };
      }
      return next;
    });
  };

  const handleDateStartChange = (date: string, val: string) => {
    setError('');
    setDateTimes((prev) => {
      const cur = prev[date] || { startTime: globalStartTime, endTime: globalEndTime };
      let nextEnd = cur.endTime;
      if (nextEnd <= val) {
        nextEnd = defaultEndTimeForStart(val);
      }
      return {
        ...prev,
        [date]: { startTime: val, endTime: nextEnd },
      };
    });
  };

  const handleDateEndChange = (date: string, val: string) => {
    setError('');
    setDateTimes((prev) => ({
      ...prev,
      [date]: { ...(prev[date] || { startTime: globalStartTime }), endTime: val },
    }));
  };

  const handleSwitchToSame = () => {
    setTimeMode('same');
    setError('');
    setDateTimes((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        next[d] = { startTime: globalStartTime, endTime: globalEndTime };
      }
      return next;
    });
  };

  const handleSwitchToSeparate = () => {
    setTimeMode('separate');
    setError('');
    setDateTimes((prev) => {
      const next = { ...prev };
      for (const d of selectedDates) {
        if (!next[d]) {
          const existing = existingByDate.get(d);
          next[d] = {
            startTime: existing?.startTime || globalStartTime || '09:00',
            endTime: existing?.endTime || globalEndTime || '17:00',
          };
        }
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!doctor) return;
    setError('');

    const selectedUpcoming = new Set(datesToSave);
    const datesToRemove = Array.from(existingByDate.entries())
      .filter(([date, info]) => date >= today && !info.isClosed && !selectedUpcoming.has(date))
      .map(([date]) => date);

    if (datesToSave.length === 0 && datesToRemove.length === 0) {
      const msg = 'Select at least one upcoming date, or untick days to remove';
      setError(msg);
      showToast(msg, 'error');
      return;
    }

    // Strict validation for all dates to save
    for (const date of datesToSave) {
      const timeForDate =
        timeMode === 'same'
          ? { startTime: globalStartTime, endTime: globalEndTime }
          : dateTimes[date] || { startTime: globalStartTime, endTime: globalEndTime };

      const start = toHm(timeForDate.startTime);
      const end = toHm(timeForDate.endTime);

      if (!start || !end) {
        const msg = `Start and end time are required for ${formatDate(date)}`;
        setError(msg);
        showToast(msg, 'error');
        return;
      }
      if (start >= end) {
        const msg = `End time must be after start time for ${formatDate(date)} (${format12Hour(start)} - ${format12Hour(end)})`;
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      // Check strictly against current time for today
      if (date === today) {
        const scheduleTimeError = validateScheduleAgainstNow(date, start);
        if (scheduleTimeError) {
          setError(scheduleTimeError);
          showToast(scheduleTimeError, 'error');
          return;
        }
      }
    }

    setSaving(true);
    let created = 0;
    let reopened = 0;
    let kept = 0;
    let removed = 0;
    let updated = 0;

    try {
      for (const date of datesToRemove) {
        await setClosed.mutateAsync({ doctorId: doctor._id, date, isClosed: true });
        removed += 1;
      }

      for (const date of datesToSave) {
        const timeForDate =
          timeMode === 'same'
            ? { startTime: globalStartTime, endTime: globalEndTime }
            : dateTimes[date] || { startTime: globalStartTime, endTime: globalEndTime };

        const start = toHm(timeForDate.startTime);
        const end = toHm(timeForDate.endTime);
        const effectiveStart = start;

        const existing = existingByDate.get(date);
        if (existing) {
          if (existing.startTime === effectiveStart && existing.endTime === end) {
            if (existing.isClosed) {
              await setClosed.mutateAsync({ doctorId: doctor._id, date, isClosed: false });
              reopened += 1;
            } else {
              kept += 1;
            }
            continue;
          }
        }

        await createSchedule.mutateAsync({
          doctorId: doctor._id,
          date,
          startTime: effectiveStart,
          endTime: end,
          intervalMinutes: 30,
        });

        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
      }

      if (created === 0 && reopened === 0 && removed === 0 && kept === 0 && updated === 0) {
        const msg = 'No schedule changes to save';
        setError(msg);
        showToast(msg, 'error');
        return;
      }

      const summary = [
        created ? `${created} added` : null,
        updated ? `${updated} updated` : null,
        reopened ? `${reopened} reopened` : null,
        removed ? `${removed} removed` : null,
        !created && !reopened && !removed && !updated && kept ? 'Schedule unchanged' : null,
      ]
        .filter(Boolean)
        .join(' · ');

      showToast(summary || 'Schedule saved');
      onClose();
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const nowHm = getNowInAppTz().time;

  if (!open || !doctor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#061526]/50 backdrop-blur-[3px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close dialog"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[94vh] max-h-[940px] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-[#D6E4FA] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#EEF2F6] px-5 py-4 sm:px-7 bg-white">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[20px] font-extrabold tracking-tight text-[#0B1F44] sm:text-[22px]">
                {hasUpcomingOpen ? 'Edit Schedule' : 'Add to Schedule'}
              </h2>
              <span className="rounded-full bg-[#EEF4FF] px-2.5 py-0.5 text-[12px] font-extrabold text-[#2563EB]">
                {datesToSave.length} {datesToSave.length === 1 ? 'date' : 'dates'} selected
              </span>
            </div>
            <p className="mt-0.5 text-[14px] font-semibold text-[#55688A]">
              {doctorDisplayName(doctor.name)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#55688A] transition hover:bg-[#EEF4FF] hover:text-[#0B1F44]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* 2-Column Responsive Workspace */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Calendar & Weekday Quick Selection */}
          <div className="w-full lg:w-[410px] xl:w-[430px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#EEF2F6] p-4 sm:p-6 bg-slate-50/50 overflow-y-auto space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#55688A]">
                  Select Weekdays (Next {SCHEDULE_HORIZON_MONTHS} Months)
                </p>
                {selectedDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDates([])}
                    className="text-[11.5px] font-bold text-red-600 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Weekday Chips */}
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_TOGGLES.map((day) => {
                  const active = isDowFullySelected(day.dow);
                  const partial = isDowPartiallySelected(day.dow);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleDow(day.dow)}
                      aria-pressed={active}
                      title={
                        active
                          ? `Clear ${day.name} for next ${SCHEDULE_HORIZON_MONTHS} months`
                          : `Select all upcoming ${day.name}s for next ${SCHEDULE_HORIZON_MONTHS} months`
                      }
                      className={[
                        'flex h-11 items-center justify-center rounded-xl text-[14px] font-extrabold transition',
                        active
                          ? 'border-[1.5px] border-[#2563EB] bg-[#2563EB] text-white shadow-xs'
                          : partial
                            ? 'border-[1.5px] border-dashed border-[#2563EB] bg-[#EEF4FF] text-[#2563EB]'
                            : 'border-[1.5px] border-[#D6E4FA] bg-white text-[#55688A] hover:border-[#93C5FD] hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] text-[#55688A]">
                Tap weekday chip for next {SCHEDULE_HORIZON_MONTHS} months, or tap individual calendar dates below.
              </p>
            </div>

            {/* Month Calendar */}
            <MonthCalendar
              compact
              year={viewYear}
              monthIndex={viewMonth}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
              cells={calendarCells}
              footer={
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold text-[#55688A]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-[#2563EB]" /> Selected
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm border-[1.5px] border-[#93C5FD] bg-transparent" /> Today
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm bg-[#BFDBFE]" /> Open
                    </span>
                  </div>
                  <span className="font-extrabold text-[#0B1F44]">
                    {datesToSave.length} selected
                  </span>
                </div>
              }
            />
          </div>

          {/* Right Column: Shift Timing Configuration */}
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 overflow-y-auto space-y-4 bg-white">
            {/* Shift Mode Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-extrabold tracking-tight text-[#0B1F44]">
                  Shift Timing Setup
                </h3>
                <span className="text-[12.5px] font-medium text-[#55688A]">
                  Choose time format & schedule pattern
                </span>
              </div>

              {/* Segmented Mode Toggle */}
              <div className="grid grid-cols-2 rounded-2xl bg-[#EEF4FF] p-1 text-[13.5px] font-bold">
                <button
                  type="button"
                  onClick={handleSwitchToSame}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${
                    timeMode === 'same'
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#55688A] hover:text-[#0B1F44]'
                  }`}
                >
                  <span>🕒</span>
                  <span>Same Time for All Dates</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToSeparate}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 transition ${
                    timeMode === 'separate'
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#55688A] hover:text-[#0B1F44]'
                  }`}
                >
                  <span>📅</span>
                  <span>Separate Time per Date</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Same Time for All Dates */}
            {timeMode === 'same' && (
              <div className="space-y-4 rounded-2xl border border-[#D6E4FA] p-5 bg-slate-50/40">
                <div>
                  <p className="text-[13px] font-extrabold uppercase tracking-wider text-[#0B1F44]">
                    Universal Shift Hours
                  </p>
                  <p className="text-[12px] font-medium text-[#55688A]">
                    Applies to all {datesToSave.length} selected dates seamlessly.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <TimePicker12h
                    label="Start Time"
                    value={globalStartTime}
                    onChange={handleGlobalStartChange}
                  />
                  <TimePicker12h
                    label="End Time"
                    value={globalEndTime}
                    onChange={handleGlobalEndChange}
                  />
                </div>

                {datesToSave.includes(today) && globalStartTime <= nowHm ? (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12.5px] font-semibold text-red-700">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                    Today is selected. Start time ({format12Hour(globalStartTime)}) must be after {format12Hour(nowHm)} IST.
                  </div>
                ) : null}

                <div className="rounded-xl bg-[#EEF4FF] p-3 text-[13px] font-semibold text-[#2563EB] flex items-center justify-between">
                  <span>Active shift: {format12Hour(globalStartTime)} – {format12Hour(globalEndTime)}</span>
                  <span>{datesToSave.length} total days</span>
                </div>
              </div>
            )}

            {/* Mode 2: Separate Time per Date (Month-Tabbed, Anti-Scroll View) */}
            {timeMode === 'separate' && (
              <div className="space-y-3.5 flex flex-col min-h-0 flex-1">
                {/* Month Tabs Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-100 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setActiveMonthTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition ${
                      activeMonthTab === 'all'
                        ? 'bg-[#0B2A4A] text-white shadow-xs'
                        : 'bg-slate-100 text-[#55688A] hover:bg-slate-200'
                    }`}
                  >
                    All Dates ({datesToSave.length})
                  </button>
                  {Array.from(monthsMap.entries()).map(([monthKey, monthDates]) => {
                    const [y, m] = monthKey.split('-').map(Number);
                    const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    });
                    const isActive = activeMonthTab === monthKey;
                    return (
                      <button
                        key={monthKey}
                        type="button"
                        onClick={() => setActiveMonthTab(monthKey)}
                        className={`px-3 py-1.5 rounded-xl text-[12.5px] font-bold whitespace-nowrap transition ${
                          isActive
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'bg-slate-100 text-[#55688A] hover:bg-slate-200'
                        }`}
                      >
                        {monthName} ({monthDates.length})
                      </button>
                    );
                  })}
                </div>

                {/* Weekday Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] font-bold text-slate-500 mr-1">Weekday:</span>
                  <button
                    type="button"
                    onClick={() => setWeekdayFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold transition ${
                      weekdayFilter === 'all'
                        ? 'bg-[#0B2A4A] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {DAY_TOGGLES.map((day) => {
                    const count = datesToSave.filter((d) => parseIsoDate(d).getDay() === day.dow).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => setWeekdayFilter(day.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11.5px] font-bold transition ${
                          weekdayFilter === day.key
                            ? 'bg-[#0B2A4A] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {day.label} ({count})
                      </button>
                    );
                  })}
                  <span className="ml-auto text-[12px] font-medium text-slate-500">
                    Showing {displayedDates.length} of {datesToSave.length}
                  </span>
                </div>

                {/* Sleek Date Rows List */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[500px]">
                  {displayedDates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-[13px] text-slate-500">
                      No dates match the selected month / weekday filter.
                    </div>
                  ) : (
                    displayedDates.map((date) => {
                      const isToday = date === today;
                      const isTomorrow = isTomorrowIso(date, today);
                      const dateObj = parseIsoDate(date);
                      const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                      const dayFull = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });
                      const dayMonth = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                      const fullYear = dateObj.getFullYear();

                      const times = dateTimes[date] || {
                        startTime: globalStartTime,
                        endTime: globalEndTime,
                      };

                      const isPastToday = isToday && times.startTime <= nowHm;
                      const isInvalidRange = times.startTime >= times.endTime;

                      return (
                        <div
                          key={date}
                          className={`rounded-2xl border p-3 sm:p-3.5 transition-all ${
                            isPastToday || isInvalidRange
                              ? 'border-red-300 bg-red-50/20'
                              : isToday
                                ? 'border-blue-300 bg-blue-50/20 shadow-xs'
                                : 'border-[#D6E4FA] bg-white hover:border-[#93C5FD]'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Left: Date details */}
                            <div className="flex items-center gap-2.5 min-w-[190px]">
                              {isToday ? (
                                <span className="rounded-lg bg-[#0B2A4A] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                  Today
                                </span>
                              ) : isTomorrow ? (
                                <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                                  Tomorrow
                                </span>
                              ) : (
                                <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-[12px] font-bold text-slate-700">
                                  {dayName}
                                </span>
                              )}
                              <div>
                                <span className="text-[14px] font-extrabold text-[#0B1F44]">
                                  {dayMonth}, {fullYear}
                                </span>
                                <p className="text-[11.5px] text-[#55688A]">
                                  {dayFull}
                                </p>
                              </div>
                            </div>

                            {/* Right: Inline 12h Pickers & Actions */}
                            <div className="flex flex-1 flex-wrap items-center justify-start md:justify-end gap-2.5">
                              {/* Start Time */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55688A]">
                                  Start:
                                </span>
                                <TimePickerInline
                                  value={times.startTime}
                                  onChange={(v) => handleDateStartChange(date, v)}
                                />
                              </div>

                              <span className="text-slate-300 font-bold hidden sm:inline">–</span>

                              {/* End Time */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#55688A]">
                                  End:
                                </span>
                                <TimePickerInline
                                  value={times.endTime}
                                  onChange={(v) => handleDateEndChange(date, v)}
                                />
                              </div>

                              {/* Action Tools */}
                              <div className="flex items-center gap-1 ml-auto md:ml-2">
                                <button
                                  type="button"
                                  onClick={() => toggleDate(date)}
                                  title="Remove this date"
                                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                  aria-label={`Remove ${date}`}
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M6 6l12 12M18 6 6 18" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Inline Warnings */}
                          {isInvalidRange && (
                            <div className="mt-2 text-[12px] font-semibold text-red-600">
                              ⚠️ End time must be after start time ({format12Hour(times.startTime)} – {format12Hour(times.endTime)}).
                            </div>
                          )}

                          {isPastToday && (
                            <div className="mt-2 text-[12px] font-semibold text-red-600">
                              ⚠️ Start time ({format12Hour(times.startTime)}) has passed today. Must be after {format12Hour(nowHm)} IST.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#EEF2F6] bg-white px-5 py-3.5 sm:px-7">
          <div className="min-w-0 flex-1">
            {error ? (
              <p className="truncate text-[13px] font-semibold text-[#DC2626]" title={error}>
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#D6E4FA] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#55688A] transition hover:bg-[#EEF4FF]"
            >
              Cancel
            </button>
            <Button
              type="button"
              variant="navy"
              loading={saving}
              onClick={() => void handleSave()}
              className="px-6 font-bold shadow-xs"
            >
              Save Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface TimePicker12hProps {
  label: string;
  value: string; // 24-hour "HH:mm"
  onChange: (newValue24: string) => void;
}

const TimePicker12h = ({
  label,
  value,
  onChange,
}: TimePicker12hProps) => {
  const { hour12, minute, period } = parse24To12(value);

  const minutesList = useMemo(() => {
    if (!MINUTES_5.includes(minute as any)) {
      return [...MINUTES_5, minute].sort();
    }
    return MINUTES_5;
  }, [minute]);

  const handleHourChange = (newH: string) => {
    onChange(format12To24(newH, minute, period));
  };

  const handleMinuteChange = (newM: string) => {
    onChange(format12To24(hour12, newM, period));
  };

  const handlePeriodChange = (newP: 'AM' | 'PM') => {
    if (newP === period) return;
    onChange(format12To24(hour12, minute, newP));
  };

  return (
    <div className="rounded-2xl border-[1.5px] border-[#D6E4FA] bg-white p-3.5 sm:p-4 transition hover:border-[#93C5FD] shadow-2xs">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#55688A]">
          {label}
        </span>
        <span className="rounded-md bg-[#EEF4FF] px-2 py-0.5 text-[11.5px] font-extrabold text-[#2563EB]">
          {format12Hour(value)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Time Digits (Hour : Minute) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Hour Select */}
          <div className="relative">
            <select
              value={hour12}
              onChange={(e) => handleHourChange(e.target.value)}
              aria-label={`${label} hour`}
              className="h-10 sm:h-11 w-[56px] sm:w-[62px] appearance-none rounded-xl border-[1.5px] border-[#D6E4FA] bg-white pl-2 pr-3.5 text-center text-[16px] sm:text-[17px] font-bold text-[#0B1F44] shadow-2xs outline-none transition hover:border-[#93C5FD] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 cursor-pointer"
            >
              {HOURS_12.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </div>

          <span className="text-[18px] font-extrabold text-[#55688A] select-none leading-none">:</span>

          {/* Minute Select */}
          <div className="relative">
            <select
              value={minute}
              onChange={(e) => handleMinuteChange(e.target.value)}
              aria-label={`${label} minute`}
              className="h-10 sm:h-11 w-[56px] sm:w-[62px] appearance-none rounded-xl border-[1.5px] border-[#D6E4FA] bg-white pl-2 pr-3.5 text-center text-[16px] sm:text-[17px] font-bold text-[#0B1F44] shadow-2xs outline-none transition hover:border-[#93C5FD] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 cursor-pointer"
            >
              {minutesList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </div>
        </div>

        {/* AM / PM Segmented Control */}
        <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => handlePeriodChange('AM')}
            aria-pressed={period === 'AM'}
            className={`h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-[12.5px] sm:text-[13px] font-extrabold transition-all cursor-pointer ${
              period === 'AM'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#55688A] hover:text-[#0B1F44]'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => handlePeriodChange('PM')}
            aria-pressed={period === 'PM'}
            className={`h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg text-[12.5px] sm:text-[13px] font-extrabold transition-all cursor-pointer ${
              period === 'PM'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#55688A] hover:text-[#0B1F44]'
            }`}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
};

/** Compact Inline 12-hour Time Picker for individual date rows */
const TimePickerInline = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (newValue24: string) => void;
}) => {
  const { hour12, minute, period } = parse24To12(value);

  const minutesList = useMemo(() => {
    if (!MINUTES_5.includes(minute as any)) {
      return [...MINUTES_5, minute].sort();
    }
    return MINUTES_5;
  }, [minute]);

  const handleHourChange = (newH: string) => {
    onChange(format12To24(newH, minute, period));
  };

  const handleMinuteChange = (newM: string) => {
    onChange(format12To24(hour12, newM, period));
  };

  const handlePeriodChange = (newP: 'AM' | 'PM') => {
    if (newP === period) return;
    onChange(format12To24(hour12, minute, newP));
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border-[1.5px] border-[#D6E4FA] bg-white p-1 hover:border-[#93C5FD] transition">
      {/* Hour select */}
      <div className="relative">
        <select
          value={hour12}
          onChange={(e) => handleHourChange(e.target.value)}
          aria-label="Hour"
          className="h-8 w-11 appearance-none rounded-lg bg-transparent text-center text-[13.5px] font-bold text-[#0B1F44] outline-none cursor-pointer pr-3"
        >
          {HOURS_12.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <span className="text-[13px] font-bold text-[#55688A] leading-none">:</span>

      {/* Minute select */}
      <div className="relative">
        <select
          value={minute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          aria-label="Minute"
          className="h-8 w-11 appearance-none rounded-lg bg-transparent text-center text-[13.5px] font-bold text-[#0B1F44] outline-none cursor-pointer pr-3"
        >
          {minutesList.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      {/* AM / PM Toggle */}
      <div className="flex items-center gap-0.5 ml-0.5">
        <button
          type="button"
          onClick={() => handlePeriodChange('AM')}
          className={`h-7 px-1.5 rounded-md text-[11.5px] font-extrabold transition ${
            period === 'AM'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-[#55688A] hover:bg-[#EEF4FF]'
          }`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange('PM')}
          className={`h-7 px-1.5 rounded-md text-[11.5px] font-extrabold transition ${
            period === 'PM'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-[#55688A] hover:bg-[#EEF4FF]'
          }`}
        >
          PM
        </button>
      </div>
    </div>
  );
};
