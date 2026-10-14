import type { ReactNode } from 'react';
import { todayIsoIst } from '@/utils/dateTime';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

export type MonthCalendarCell = {
  key: string;
  day: number;
  iso: string;
  inMonth: boolean;
  selected?: boolean;
  disabled?: boolean;
  soft?: boolean;
  title?: string;
  onClick?: () => void;
};

type MonthCalendarProps = {
  year: number;
  monthIndex: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  cells: MonthCalendarCell[];
  footer?: ReactNode;
  /** Smaller cells for modals / popovers. */
  compact?: boolean;
};

const monthTitle = (year: number, monthIndex: number) =>
  new Date(year, monthIndex, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

export const MonthCalendar = ({
  year,
  monthIndex,
  onPrevMonth,
  onNextMonth,
  cells,
  footer,
  compact = false,
}: MonthCalendarProps) => {
  const today = todayIsoIst();
  const cellSize = compact ? 'h-8 rounded-lg text-[12.5px]' : 'h-9 rounded-xl text-[13px]';
  const navSize = compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl';

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5EAF0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div
        className={[
          'flex items-center justify-between gap-2 border-b border-[#EEF2F6] bg-gradient-to-b from-[#F8FAFC] to-white',
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onPrevMonth}
          className={`inline-flex items-center justify-center border border-[#E5EAF0] bg-white text-[#0B2A4A] shadow-sm transition hover:border-[#C7D7EE] hover:bg-[#F8FAFC] ${navSize}`}
          aria-label="Previous month"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <p className={`font-bold tracking-tight text-[#0f172a] ${compact ? 'text-[13.5px]' : 'text-[14.5px]'}`}>
          {monthTitle(year, monthIndex)}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          className={`inline-flex items-center justify-center border border-[#E5EAF0] bg-white text-[#0B2A4A] shadow-sm transition hover:border-[#C7D7EE] hover:bg-[#F8FAFC] ${navSize}`}
          aria-label="Next month"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className={compact ? 'px-2 pb-2 pt-1.5' : 'px-2.5 pb-2.5 pt-2'}>
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#64748B]"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell) => {
            const isToday = cell.inMonth && cell.iso === today;
            const base = `relative flex items-center justify-center font-semibold transition ${cellSize}`;

            if (!cell.inMonth) {
              return (
                <div key={cell.key} className={`${base} text-[#CBD5E1]`}>
                  {cell.day}
                </div>
              );
            }

            if (cell.disabled && !cell.onClick) {
              return (
                <div
                  key={cell.key}
                  title={cell.title}
                  className={[
                    base,
                    cell.soft ? 'bg-[#F1F5F9] text-[#94A3B8]' : 'text-[#CBD5E1]',
                    isToday ? 'ring-1 ring-[#CBD5E1]' : '',
                  ].join(' ')}
                >
                  {cell.day}
                </div>
              );
            }

            return (
              <button
                key={cell.key}
                type="button"
                disabled={cell.disabled}
                onClick={cell.onClick}
                aria-pressed={cell.selected}
                title={cell.title}
                className={[
                  base,
                  cell.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                  cell.selected
                    ? 'bg-[#0B2A4A] text-white shadow-sm hover:bg-[#081F37]'
                    : cell.soft
                      ? 'bg-[#E8F1FF] text-[#1D4ED8] hover:bg-[#D6E8FF]'
                      : 'text-[#0f172a] hover:bg-[#F1F5F9]',
                  isToday && !cell.selected ? 'ring-2 ring-[#93C5FD] ring-offset-1 ring-offset-white' : '',
                ].join(' ')}
              >
                {cell.day}
                {isToday && !cell.selected ? (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#2563EB]" />
                ) : null}
              </button>
            );
          })}
        </div>

        {footer ? <div className="mt-2 border-t border-[#EEF2F6] pt-2">{footer}</div> : null}
      </div>
    </div>
  );
};

export const buildMonthCells = (args: {
  year: number;
  monthIndex: number;
  mapDay: (iso: string, day: number, inMonth: boolean) => Omit<MonthCalendarCell, 'key' | 'day' | 'iso' | 'inMonth'>;
}): MonthCalendarCell[] => {
  const { year, monthIndex, mapDay } = args;
  // JS getDay(): Sun=0 … Sat=6. Convert to Monday-first: Mon=0 … Sun=6.
  const firstDowSun0 = new Date(year, monthIndex, 1).getDay();
  const leadingPads = (firstDowSun0 + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysInPrev = new Date(year, monthIndex, 0).getDate();
  const toIso = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const cells: MonthCalendarCell[] = [];

  for (let i = 0; i < leadingPads; i += 1) {
    const day = daysInPrev - leadingPads + i + 1;
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const iso = toIso(prevYear, prevMonth, day);
    cells.push({
      key: `p-${day}`,
      day,
      iso,
      inMonth: false,
      ...mapDay(iso, day, false),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toIso(year, monthIndex, day);
    cells.push({
      key: `c-${day}`,
      day,
      iso,
      inMonth: true,
      ...mapDay(iso, day, true),
    });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    const iso = toIso(nextYear, nextMonth, nextDay);
    cells.push({
      key: `n-${nextDay}`,
      day: nextDay,
      iso,
      inMonth: false,
      ...mapDay(iso, nextDay, false),
    });
    nextDay += 1;
  }

  return cells;
};
