import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import {
  useLabReportPatients,
  useLookupLabPatientByPhone,
  useSearchLabPatients,
} from '@/hooks/useLabReports';
import type { LabReportPatientRowDto } from '@/types/dto';

const MONTH_NAMES = [
  'All time',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

const monthBounds = (year: number, month: number) => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${year}-${pad2(month)}-01`,
    toDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
};

const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

const formatWhen = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** User Management — add by phone with live autocomplete + date-filtered list. */
export const LabUsersPage = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  /** 0 = all time */
  const [month, setMonth] = useState(0);
  const [page, setPage] = useState(1);

  // Autocomplete phone search state
  const [phone, setPhone] = useState('');
  const [debouncedPhone, setDebouncedPhone] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const lookup = useLookupLabPatientByPhone();
  const searchPatientsQuery = useSearchLabPatients(debouncedPhone, showAutocomplete);

  const suggestions: LabReportPatientRowDto[] = searchPatientsQuery.data || [];

  // Debounce phone autocomplete input
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedPhone(phone.trim()), 150);
    return () => window.clearTimeout(t);
  }, [phone]);

  useEffect(() => {
    setPage(1);
  }, [year, month]);

  // Handle click outside autocomplete container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bounds = useMemo(
    () => (month > 0 ? monthBounds(year, month) : undefined),
    [year, month],
  );
  const query = useLabReportPatients({
    fromDate: bounds?.fromDate,
    toDate: bounds?.toDate,
    page,
    limit: 10,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  const selectPatient = (patient: LabReportPatientRowDto) => {
    setShowAutocomplete(false);
    showToast(`Opened ${patient.name || 'patient'}`, 'success');
    navigate(APP_ROUTES.ADMIN.USER_DETAIL(patient._id));
  };

  const onAddByPhone = async (event: FormEvent) => {
    event.preventDefault();
    if (suggestions.length > 0 && highlightIndex >= 0 && highlightIndex < suggestions.length) {
      selectPatient(suggestions[highlightIndex]);
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      showToast('Enter a valid 10-digit mobile number or select a suggested user', 'error');
      return;
    }
    try {
      const patient = await lookup.mutateAsync(digits.slice(-10));
      selectPatient(patient as any);
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        selectPatient(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36]">User Management</h1>
          <p className="mt-1 text-[14px] text-[#64748B]">
            Search a registered patient by phone or name, then upload their lab report.
          </p>
        </div>
        <NotificationBell />
      </div>

      <form
        onSubmit={(e) => void onAddByPhone(e)}
        className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm"
      >
        <p className="text-[13px] font-bold uppercase tracking-wide text-[#64748B]">
          Find patient to send lab report
        </p>
        <p className="mt-1 text-[13px] text-[#94A3B8]">
          Type mobile number or patient name for live autocomplete suggestions.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <div ref={autocompleteRef} className="relative flex-1 min-w-[240px]">
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setShowAutocomplete(true);
                setHighlightIndex(0);
              }}
              onFocus={() => setShowAutocomplete(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search by phone number or name…"
              inputMode="tel"
              className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-[14px] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition"
            />

            {/* Live Autocomplete Dropdown */}
            {showAutocomplete && phone.trim().length >= 1 ? (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[340px] overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-2xl">
                {searchPatientsQuery.isLoading ? (
                  <div className="flex items-center justify-center p-4 text-[13px] text-[#64748B]">
                    <Spinner label="Searching registered patients…" />
                  </div>
                ) : suggestions.length > 0 ? (
                  <div>
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Matching Patients ({suggestions.length})
                    </div>
                    <div className="space-y-1">
                      {suggestions.map((patient, idx) => (
                        <button
                          key={patient._id}
                          type="button"
                          onClick={() => selectPatient(patient)}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                            highlightIndex === idx
                              ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                              : 'hover:bg-[#F8FAFC]'
                          }`}
                        >
                          {patient.profileImage ? (
                            <img
                              src={patient.profileImage}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[12px] font-bold text-[#2563EB]">
                              {initials(patient.name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[14px] font-semibold text-[#1A1F36]">
                                {patient.name || 'Patient'}
                              </p>
                              {patient.reportCount ? (
                                <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
                                  {patient.reportCount} report{patient.reportCount === 1 ? '' : 's'}
                                </span>
                              ) : (
                                <span className="shrink-0 text-[11px] text-[#94A3B8]">New patient</span>
                              )}
                            </div>
                            <p className="truncate text-[12px] text-[#64748B]">
                              <span className="font-semibold text-[#2563EB]">
                                {patient.phone || '—'}
                              </span>
                              {patient.place ? ` · ${patient.place}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-[12px] font-bold text-[#2563EB]">
                            Open ›
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : debouncedPhone.length >= 2 ? (
                  <div className="p-4 text-center">
                    <p className="text-[13px] font-semibold text-[#1A1F36]">
                      No registered user found for &quot;{phone}&quot;
                    </p>
                    <p className="mt-1 text-[12px] text-[#64748B]">
                      Patient must be registered on Aarohcare app with this number.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={lookup.isPending}
            className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {lookup.isPending ? 'Looking up…' : 'Find & open'}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-[14px]"
        >
          {MONTH_NAMES.map((label, idx) => (
            <option key={label} value={idx}>
              {label}
            </option>
          ))}
        </select>
        {month > 0 ? (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-[14px]"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {query.isLoading ? (
        <Spinner label="Loading users…" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-12 text-center text-[14px] text-[#64748B]">
          No users with reports yet. Search a patient by phone or name above to send their first report.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          {items.map((row) => (
            <Link
              key={row._id}
              to={APP_ROUTES.ADMIN.USER_DETAIL(row._id)}
              className="flex items-center gap-4 border-b border-[#F1F5F9] px-5 py-4 last:border-b-0 hover:bg-[#F8FAFC]"
            >
              {row.profileImage ? (
                <img src={row.profileImage} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-bold text-[#2563EB]">
                  {initials(row.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[#1A1F36]">
                  {row.name || 'Patient'}
                </p>
                <p className="truncate text-[13px] text-[#64748B]">
                  <span className="font-medium text-[#2563EB]">{row.phone || '—'}</span>
                  {row.lastTitle ? ` · ${row.lastTitle}` : ''}
                </p>
              </div>
              <div className="hidden text-right text-[12px] text-[#94A3B8] sm:block">
                <p>
                  {row.reportCount} report{row.reportCount === 1 ? '' : 's'}
                </p>
                <p>{formatWhen(row.lastReportAt)}</p>
              </div>
              <span className="text-[#94A3B8]">›</span>
            </Link>
          ))}
        </div>
      )}

      {query.data && query.data.total > 0 ? (
        <div className="flex items-center justify-between gap-3 text-[13px] text-[#64748B]">
          <p>
            Showing page {page} of {totalPages} · {query.data.total} users
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
