/** App business timezone for schedule / OP dates. */
export const APP_TIMEZONE = 'Asia/Kolkata';

const pad2 = (value: string | number) => String(value).padStart(2, '0');

/** Current calendar date + clock time in Asia/Kolkata. */
export const getNowInAppTz = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  const minute = get('minute');
  if (hour === '24') hour = '00';

  return {
    date: `${year}-${month}-${day}`,
    time: `${pad2(hour)}:${pad2(minute)}`,
  };
};

/** Today’s date in IST as YYYY-MM-DD (not UTC). */
export const todayIsoIst = () => getNowInAppTz().date;

export const toHm = (value: string) => value.trim().slice(0, 5);

export const minutesToHm = (totalMinutes: number) => {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const hmToMinutes = (hm: string) => {
  const [h, m] = toHm(hm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Next valid OP start time in IST (rounded up to the next 5 minutes,
 * and always strictly after "now" so create-schedule validation passes).
 */
export const nextValidStartTimeIst = (now = new Date()) => {
  const { time } = getNowInAppTz(now);
  const nextMinute = hmToMinutes(time) + 1;
  const roundedUp = Math.ceil(nextMinute / 5) * 5;
  return minutesToHm(roundedUp);
};

/** Sensible default end time: ~4 hours after start, capped at 20:00. */
export const defaultEndTimeForStart = (startHm: string) => {
  const end = Math.min(hmToMinutes(startHm) + 4 * 60, 20 * 60);
  // Keep end after start even late in the day.
  const safeEnd = Math.max(end, hmToMinutes(startHm) + 30);
  return minutesToHm(Math.min(safeEnd, 23 * 60 + 59));
};

/**
 * Validate schedule date/time against IST "now".
 * Returns an error message, or null when valid.
 */
export const validateScheduleAgainstNow = (
  date: string,
  startTime: string,
  now = new Date(),
): string | null => {
  const start = toHm(startTime);
  const { date: today, time: nowTime } = getNowInAppTz(now);

  if (date < today) {
    return 'Cannot create a schedule for a past date';
  }

  if (date === today && start <= nowTime) {
    return `Start time must be after the current time (${format12Hour(nowTime)} IST) for today’s schedule`;
  }

  return null;
};

/** Format "HH:mm" (24h) to "hh:mm AM/PM" (12h). Also safely handles already formatted strings or non-time tokens like 'QUEUE'. */
export const format12Hour = (hm: string): string => {
  if (!hm) return '';
  const trimmed = hm.trim();
  const upper = trimmed.toUpperCase();
  if (upper.includes('AM') || upper.includes('PM')) {
    return trimmed;
  }
  const cleanHm = toHm(trimmed);
  const [hStr, mStr] = cleanHm.split(':');
  if (mStr === undefined) return trimmed;
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return trimmed;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const hourFormatted = String(hour12).padStart(2, '0');
  const minuteFormatted = String(m).padStart(2, '0');
  return `${hourFormatted}:${minuteFormatted} ${period}`;
};

