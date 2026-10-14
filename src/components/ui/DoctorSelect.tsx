import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toTitleCase } from '@/utils/formatters';

export interface DoctorSelectOption {
  id: string;
  name: string;
  specialization?: string;
  image?: string;
  /** Optional status text shown under specialization (e.g. On break). */
  status?: string;
}

interface DoctorSelectProps {
  label?: string;
  value: string;
  options: DoctorSelectOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  /** soft = light gray field (multi header); white = solid white field */
  tone?: 'soft' | 'white';
  className?: string;
  searchable?: boolean;
}

const doctorDisplayName = (name?: string) => {
  const raw = (name || 'Doctor').trim();
  const titled = toTitleCase(raw.replace(/^dr\.?\s*/i, ''));
  return `Dr. ${titled}`;
};

const Avatar = ({ image, size = 'md' }: { name: string; image?: string; size?: 'sm' | 'md' }) => {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  if (image) {
    return <img src={image} alt="" className={`${dim} rounded-full object-cover ring-2 ring-white`} />;
  }
  return (
    <div
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#0B2A4A]`}
    >
      <svg viewBox="0 0 24 24" width={size === 'sm' ? 16 : 18} height={size === 'sm' ? 16 : 18} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" />
      </svg>
    </div>
  );
};

export const DoctorSelect = ({
  label = 'Select Doctor',
  value,
  options,
  onChange,
  placeholder = 'Choose a doctor…',
  emptyLabel = 'No doctors available',
  disabled = false,
  hideLabel = false,
  tone = 'soft',
  className = '',
  searchable = true,
}: DoctorSelectProps) => {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const hay = `${option.name} ${option.specialization || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open, searchable]);

  const fieldTone =
    tone === 'white'
      ? 'border-[#E5EAF0] bg-white'
      : 'border-[#E5EAF0] bg-[#F8FAFC]';

  return (
    <div ref={rootRef} className={`relative flex min-w-[260px] flex-1 flex-col gap-1.5 ${className}`}>
      {!hideLabel ? (
        <label id={`${id}-label`} className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#5B6577]">
          {label}
        </label>
      ) : (
        <span id={`${id}-label`} className="sr-only">
          {label}
        </span>
      )}

      <button
        type="button"
        id={id}
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        aria-controls={listId}
        onClick={() => {
          if (disabled || options.length === 0) return;
          setOpen((prev) => !prev);
        }}
        className={[
          'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left outline-none transition',
          fieldTone,
          'hover:border-[#CBD5E1] focus:border-[#0B2A4A] focus:bg-white focus:ring-2 focus:ring-[#0B2A4A]/12',
          'disabled:cursor-not-allowed disabled:opacity-60',
          open ? 'border-[#0B2A4A] bg-white ring-2 ring-[#0B2A4A]/12' : '',
        ].join(' ')}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} image={selected.image} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-[#1A1F36]">
                {doctorDisplayName(selected.name)}
              </span>
              <span className="block truncate text-[13px] text-[#4B5563]">
                {selected.specialization || 'General OP'}
                {selected.status ? ` · ${selected.status}` : ''}
              </span>
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-[14px] font-medium text-[#5B6577]">
            {options.length === 0 ? emptyLabel : placeholder}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-[#5B6577] transition ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute top-full z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-[#E5EAF0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
          role="presentation"
        >
          {searchable ? (
            <div className="border-b border-[#EEF2F6] p-2">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#9AA3B2]">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="m16.5 16.5 3 3" />
                  </svg>
                </span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search doctor…"
                  className="w-full rounded-lg border border-[#E5EAF0] bg-[#F8FAFC] py-2 pl-9 pr-3 text-[13px] text-[#1A1F36] outline-none placeholder:text-[#9AA3B2] focus:border-[#0B2A4A] focus:bg-white"
                />
              </div>
            </div>
          ) : null}

          <ul id={listId} role="listbox" aria-labelledby={`${id}-label`} className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3.5 py-3 text-[13px] text-[#5B6577]">No matching doctors</li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.id === value;
                return (
                  <li key={option.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.id);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={[
                        'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition',
                        isSelected ? 'bg-[#F1F5F9]' : 'hover:bg-[#F8FAFC]',
                      ].join(' ')}
                    >
                      <Avatar name={option.name} image={option.image} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-[#1A1F36]">
                            {doctorDisplayName(option.name)}
                          </span>
                          {isSelected ? (
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0B2A4A" strokeWidth="2.4" className="shrink-0">
                              <path d="m5 12 5 5L20 7" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="block truncate text-[13px] text-[#4B5563]">
                          {option.specialization || 'General OP'}
                          {option.status ? ` · ${option.status}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
