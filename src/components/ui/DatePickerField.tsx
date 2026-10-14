import { useEffect, useMemo, useRef, useState } from 'react';
import { MonthCalendar, buildMonthCells } from '@/components/ui/MonthCalendar';
import { todayIsoIst } from '@/utils/dateTime';

const formatDisplay = (iso: string) => {
  if (!iso) return 'Select date';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

type DatePickerFieldProps = {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  /** Show a Clear action (useful for optional filters). */
  allowClear?: boolean;
};

/** Modern single-date picker (replaces native `input type="date"`). */
export const DatePickerField = ({
  label,
  value,
  onChange,
  min,
  max,
  className = '',
  placeholder = 'Select date',
  allowClear = false,
}: DatePickerFieldProps) => {
  const today = todayIsoIst();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const initial = value || today;
  const [viewYear, setViewYear] = useState(() => Number(initial.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(initial.slice(5, 7)) - 1);

  useEffect(() => {
    if (!open) return;
    const base = value || today;
    setViewYear(Number(base.slice(0, 4)));
    setViewMonth(Number(base.slice(5, 7)) - 1);
  }, [open, value, today]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cells = useMemo(
    () =>
      buildMonthCells({
        year: viewYear,
        monthIndex: viewMonth,
        mapDay: (iso, _day, inMonth) => {
          if (!inMonth) return { disabled: true };
          const beforeMin = Boolean(min && iso < min);
          const afterMax = Boolean(max && iso > max);
          const disabled = beforeMin || afterMax;
          return {
            selected: iso === value,
            disabled,
            title: disabled ? 'Unavailable' : 'Select date',
            onClick: disabled
              ? undefined
              : () => {
                  onChange(iso);
                  setOpen(false);
                },
          };
        },
      }),
    [viewYear, viewMonth, value, min, max, onChange],
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div ref={rootRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label ? (
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] px-3.5 py-2.5 text-left text-[14px] font-semibold text-[#0f172a] outline-none transition hover:border-[#C7D7EE] hover:bg-white focus:border-[#1B64F2] focus:bg-white focus:ring-2 focus:ring-[#1B64F2]/15"
      >
        <span className={value ? 'text-[#0f172a]' : 'text-[#94A3B8]'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#64748B" strokeWidth="1.8">
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(100vw-2rem,320px)] rounded-2xl border border-[#E5EAF0] bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <MonthCalendar
            compact
            year={viewYear}
            monthIndex={viewMonth}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            cells={cells}
            footer={
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#1B64F2] transition hover:bg-[#EEF4FF]"
                  onClick={() => {
                    const blocked =
                      (min && today < min) || (max && today > max);
                    if (blocked) return;
                    onChange(today);
                    setOpen(false);
                  }}
                >
                  Today
                </button>
                {allowClear && value ? (
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[#64748B] transition hover:bg-[#F8FAFC]"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  );
};
