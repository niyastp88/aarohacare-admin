// This file was updated to improve the Lab Reports page UI and UX.
// It reorganizes the date filters, search bar, and report list for better readability.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { DocumentPreviewModal } from '@/components/ui/DocumentPreviewModal';
import { Spinner } from '@/components/ui/Spinner';
import { APP_ROUTES } from '@/constants/routes';
import { useLabReportPatients, useLabReports } from '@/hooks/useLabReports';
import type { LabReportDto, LabReportPatientDto } from '@/types/dto';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const asPatient = (value: LabReportDto['patientId']): LabReportPatientDto | null => {
  if (!value || typeof value === 'string') return null;
  return value;
};

const reportFileUrl = (report: LabReportDto) => report.fileUrl || report.reportUrl || '';

const formatDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatIsoDateOnly = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

const monthBounds = (year: number, month: number) => {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    fromDate: `${year}-${pad(month)}-01`,
    toDate: `${year}-${pad(month)}-${pad(last)}`,
  };
};

/** LAB REPORTS — Year, Month, and Date-wise filters + date drill-down. */
export const LabReportsPage = () => {
  const now = new Date();
  const [searchParams, setSearchParams] = useSearchParams();

  const paramYear = Number(searchParams.get('year'));
  const paramMonth = Number(searchParams.get('month'));
  const paramDate = searchParams.get('date') || '';

  const [filterMode, setFilterMode] = useState<'TODAY' | 'ALL_MONTHS' | 'CUSTOM_RANGE' | 'SPECIFIC_MONTH'>((searchParams.get('mode') as any) || 'TODAY');
  const [rangeFrom, setRangeFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [rangeTo, setRangeTo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  const [selectedYear, setSelectedYear] = useState(
    !Number.isNaN(paramYear) && paramYear >= 2020 && paramYear <= now.getFullYear() + 2
      ? paramYear
      : now.getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(
    !Number.isNaN(paramMonth) && paramMonth >= 1 && paramMonth <= 12
      ? paramMonth
      : now.getMonth() + 1,
  );
  const [selectedDate, setSelectedDate] = useState<string>(paramDate); // YYYY-MM-DD or empty
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [preview, setPreview] = useState<{ url: string; title: string; subtitle?: string } | null>(
    null,
  );

  const bounds = monthBounds(selectedYear, selectedMonth);

  let apiFromDate: string | undefined;
  let apiToDate: string | undefined;

  if (filterMode === 'TODAY') {
    const today = formatIsoDateOnly(now.toISOString());
    apiFromDate = today;
    apiToDate = today;
  } else if (filterMode === 'ALL_MONTHS') {
    apiFromDate = undefined;
    apiToDate = undefined;
  } else if (filterMode === 'CUSTOM_RANGE') {
    apiFromDate = rangeFrom ? `${rangeFrom}-01` : undefined;
    if (rangeTo) {
      const [y, m] = rangeTo.split('-');
      const lastDay = new Date(Number(y), Number(m), 0).getDate();
      apiToDate = `${rangeTo}-${String(lastDay).padStart(2, '0')}`;
    }
  } else {
    apiFromDate = bounds.fromDate;
    apiToDate = bounds.toDate;
  }

  const reportsQuery = useLabReports({
    fromDate: apiFromDate,
    toDate: apiToDate,
    search: appliedSearch || undefined,
  });

  const allReports = reportsQuery.data ?? [];

  // Group reports by date string (YYYY-MM-DD)
  const reportsByDate = useMemo(() => {
    const map = new Map<string, LabReportDto[]>();
    for (const rep of allReports) {
      const key = formatIsoDateOnly(rep.createdAt);
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(rep);
      map.set(key, arr);
    }
    return map;
  }, [allReports]);

  // List of unique dates in the current month with reports
  const dateEntries = useMemo(() => {
    const list = Array.from(reportsByDate.entries()).map(([dateStr, items]) => ({
      dateStr,
      count: items.length,
      dayNumber: new Date(dateStr).getDate(),
    }));
    return list.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [reportsByDate]);

  // Filtered reports for the view: if a specific date is selected, show only that date's reports
  const displayedReports = useMemo(() => {
    if (!selectedDate) return allReports;
    return allReports.filter((r) => formatIsoDateOnly(r.createdAt) === selectedDate);
  }, [allReports, selectedDate]);

  // Available years list (e.g. current year - 3 to current year)
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y -= 1) {
      years.push(y);
    }
    return years;
  }, [now]);

  const updateYear = (yr: number) => {
    setSelectedYear(yr);
    setSelectedDate('');
    setSearchParams((prev) => {
      prev.set('year', String(yr));
      prev.delete('date');
      return prev;
    });
  };

  const updateMonth = (m: number) => {
    setSelectedMonth(m);
    setSelectedDate('');
    setSearchParams((prev) => {
      prev.set('month', String(m));
      prev.delete('date');
      return prev;
    });
  };

  const updateDate = (d: string) => {
    setSelectedDate(d);
    setSearchParams((prev) => {
      if (d) prev.set('date', d);
      else prev.delete('date');
      return prev;
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1A1F36] sm:text-[32px]">
            LAB REPORTS
          </h1>
          <p className="mt-1 text-[14px] text-[#64748B]">
            Filter and review patient laboratory reports by year, month, and date.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 shadow-sm">
            <span className="text-[13px] font-bold text-[#64748B]">Total Reports Sent:</span>
            <span className="text-[15px] font-black text-[#2563EB]">{allReports.length}</span>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Main Control Panel */}
      <div className="flex flex-col gap-5">
        
        {/* Top Control Bar: Report Period & Search */}
        <div className="flex flex-col gap-5 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
          
          {/* Main Period Selector */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
              Report Period
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'TODAY', label: 'Today' },
                { id: 'SPECIFIC_MONTH', label: 'Specific Month' },
                { id: 'CUSTOM_RANGE', label: 'Custom Month Range' },
                { id: 'ALL_MONTHS', label: 'All Months' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setFilterMode(opt.id as any);
                    if (opt.id !== 'SPECIFIC_MONTH') setSelectedDate('');
                  }}
                  className={`rounded-lg px-4 py-2 text-[13px] font-bold transition ${
                    filterMode === opt.id
                      ? 'bg-[#0B2A4A] text-white shadow-xs'
                      : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Area */}
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
              Search Patients & Reports
            </span>
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedSearch(search.trim());
                }}
                placeholder="Patient name, phone, or title..."
                className="w-full min-w-[260px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-[13px] font-medium text-[#0F172A] outline-none focus:border-[#2563EB] focus:bg-white transition"
              />
              <button
                type="button"
                onClick={() => setAppliedSearch(search.trim())}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-[#1D4ED8] shadow-xs transition"
              >
                Search
              </button>
              {appliedSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setAppliedSearch('');
                  }}
                  className="rounded-xl bg-[#FEE2E2] px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-[#DC2626] hover:bg-[#FCA5A5] transition"
                  title="Clear Search"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Context Controls */}
        {filterMode === 'CUSTOM_RANGE' && (
          <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
             <div className="flex flex-col gap-2">
               <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">From Month</span>
               <div className="flex items-center gap-2">
                 <select
                   value={rangeFrom.split('-')[1]}
                   onChange={e => setRangeFrom(`${rangeFrom.split('-')[0]}-${e.target.value}`)}
                   className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[14px] font-medium text-[#1E293B] outline-none focus:border-[#2563EB] transition cursor-pointer"
                 >
                   {MONTH_SHORT.map((m, i) => (
                     <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                   ))}
                 </select>
                 <select
                   value={rangeFrom.split('-')[0]}
                   onChange={e => setRangeFrom(`${e.target.value}-${rangeFrom.split('-')[1]}`)}
                   className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[14px] font-medium text-[#1E293B] outline-none focus:border-[#2563EB] transition cursor-pointer"
                 >
                   {yearOptions.map(y => (
                     <option key={y} value={y}>{y}</option>
                   ))}
                 </select>
               </div>
             </div>
             <div className="flex flex-col gap-2">
               <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">To Month</span>
               <div className="flex items-center gap-2">
                 <select
                   value={rangeTo.split('-')[1]}
                   onChange={e => setRangeTo(`${rangeTo.split('-')[0]}-${e.target.value}`)}
                   className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[14px] font-medium text-[#1E293B] outline-none focus:border-[#2563EB] transition cursor-pointer"
                 >
                   {MONTH_SHORT.map((m, i) => (
                     <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                   ))}
                 </select>
                 <select
                   value={rangeTo.split('-')[0]}
                   onChange={e => setRangeTo(`${e.target.value}-${rangeTo.split('-')[1]}`)}
                   className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[14px] font-medium text-[#1E293B] outline-none focus:border-[#2563EB] transition cursor-pointer"
                 >
                   {yearOptions.map(y => (
                     <option key={y} value={y}>{y}</option>
                   ))}
                 </select>
               </div>
             </div>
          </div>
        )}

        {filterMode === 'SPECIFIC_MONTH' && (
          <div className="flex flex-col gap-6 rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            {/* Year & Date Picker Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F1F5F9] pb-5">
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
                  Select Year
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {yearOptions.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => updateYear(yr)}
                      className={`rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                        selectedYear === yr
                          ? 'bg-[#0B2A4A] text-white shadow-xs'
                          : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Date Picker Input */}
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
                  Or Pick Specific Date
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const d = new Date(val);
                        if (!Number.isNaN(d.getTime())) {
                          setSelectedYear(d.getFullYear());
                          setSelectedMonth(d.getMonth() + 1);
                        }
                      }
                      updateDate(val);
                    }}
                    className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-[13px] font-medium text-[#1E293B] outline-none focus:border-[#2563EB] transition"
                  />
                  {selectedDate && (
                    <button
                      type="button"
                      onClick={() => updateDate('')}
                      className="rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-[12px] font-bold text-[#DC2626] hover:bg-[#FCA5A5] transition"
                      title="Clear date filter"
                    >
                      Clear Date
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Month Pills */}
            <div className="flex flex-col gap-3 border-b border-[#F1F5F9] pb-5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
                Select Month ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
              </span>
              <div className="flex flex-wrap gap-2">
                {MONTH_SHORT.map((mName, idx) => {
                  const mNum = idx + 1;
                  const isSelected = selectedMonth === mNum;
                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => updateMonth(mNum)}
                      className={`rounded-xl px-4 py-2 text-[13px] font-bold transition ${
                        isSelected
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : 'bg-[#F8FAFC] text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB]'
                      }`}
                    >
                      {mName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Pills for dates with reports */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
                  Date Wise Breakdown <span className="ml-2 inline-flex items-center justify-center rounded-full bg-[#E2E8F0] px-2 py-0.5 text-[10px] text-[#475569]">{dateEntries.length} Active Dates</span>
                </span>
                <button
                  type="button"
                  onClick={() => updateDate('')}
                  className={`text-[12px] font-bold transition ${
                    !selectedDate ? 'text-[#2563EB] underline' : 'text-[#64748B] hover:text-[#0B2A4A]'
                  }`}
                >
                  Show all dates in {MONTH_SHORT[selectedMonth - 1]} ({allReports.length} total)
                </button>
              </div>

              {dateEntries.length === 0 ? (
                <p className="text-[13px] text-[#94A3B8] italic py-2">
                  No reports found for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {dateEntries.map((item) => {
                    const isSelected = selectedDate === item.dateStr;
                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        onClick={() => updateDate(isSelected ? '' : item.dateStr)}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-[13px] transition ${
                          isSelected
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1E40AF] font-bold shadow-xs'
                            : 'border-[#E2E8F0] bg-white text-[#334155] hover:border-[#93C5FD]'
                        }`}
                      >
                        <span>{formatDate(item.dateStr)}</span>
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            isSelected ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#475569]'
                          }`}
                        >
                          {item.count} {item.count === 1 ? 'report' : 'reports'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected date drill-down banner */}
      {selectedDate && (
        <div className="flex items-center justify-between rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] px-4 py-3 text-[#1E40AF]">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-[14px] font-bold">
              Drill-down: Reports sent on {formatDate(selectedDate)} ({displayedReports.length} {displayedReports.length === 1 ? 'recipient' : 'recipients'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateDate('')}
            className="text-[12px] font-bold underline hover:text-[#1D4ED8]"
          >
            Show full month
          </button>
        </div>
      )}

      {reportsQuery.isLoading ? (
        <Spinner label="Loading reports…" />
      ) : displayedReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center text-[14px] text-[#64748B]">
          {selectedDate
            ? `No reports sent on ${formatDate(selectedDate)}.`
            : 'No reports found for the selected period.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedReports.map((report) => {
            const patient = asPatient(report.patientId);
            const patientId =
              typeof report.patientId === 'string'
                ? report.patientId
                : report.patientId?._id || '';
            const href = patientId
              ? APP_ROUTES.ADMIN.USER_DETAIL(patientId)
              : APP_ROUTES.ADMIN.USERS;
            const file = reportFileUrl(report);

            return (
              <article
                key={report._id}
                className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm hover:border-[#BFDBFE] transition"
              >
                <div className="flex items-start gap-3">
                  {patient?.profileImage ? (
                    <img
                      src={patient.profileImage}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-bold text-[#2563EB]">
                      {initials(patient?.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-[#1A1F36]">
                      {patient?.name || 'Patient'}
                    </p>
                    <p className="truncate text-[12px] text-[#64748B]">{patient?.phone || '—'}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-[12px] text-[#64748B]">
                  <div className="flex justify-between gap-2">
                    <dt>Date Shared</dt>
                    <dd className="font-medium text-[#334155]">{formatDate(report.createdAt)}</dd>
                  </div>
                  {formatTime(report.createdAt) && (
                    <div className="flex justify-between gap-2">
                      <dt>Time</dt>
                      <dd className="font-medium text-[#2563EB]">{formatTime(report.createdAt)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <dt>Report Title</dt>
                    <dd className="truncate font-medium text-[#334155]" title={report.title}>{report.title}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Link
                    to={href}
                    className="flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-center text-[13px] font-semibold text-[#334155] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition"
                  >
                    View patient
                  </Link>
                  {file ? (
                    <button
                      type="button"
                      onClick={() =>
                        setPreview({
                          url: file,
                          title: report.title,
                          subtitle: patient?.name,
                        })
                      }
                      className="rounded-xl bg-[#2563EB] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1D4ED8] transition"
                    >
                      Open
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link
          to={APP_ROUTES.ADMIN.PAY}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#2563EB] px-8 py-3 text-[15px] font-bold text-white shadow-sm hover:bg-[#1D4ED8]"
        >
          Pay Now
        </Link>
      </div>

      <DocumentPreviewModal
        open={Boolean(preview)}
        url={preview?.url || ''}
        title={preview?.title || 'Lab report'}
        subtitle={preview?.subtitle}
        onClose={() => setPreview(null)}
      />
    </div>
  );
};

/** Compact “New Reports” list of patients with recent reports. */
export const LabNewReportsListPage = () => {
  const patientsQuery = useLabReportPatients({ page: 1, limit: 20 });
  const items = patientsQuery.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#1A1F36]">New Reports</h1>
          <p className="mt-1 text-[14px] text-[#64748B]">
            Review and process incoming laboratory results for patients.
          </p>
        </div>
        <NotificationBell />
      </div>

      {patientsQuery.isLoading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-12 text-center text-[14px] text-[#64748B]">
          No patient reports yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
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
                <p className="truncate text-[15px] font-semibold text-[#1A1F36]">{row.name || 'Patient'}</p>
                <p className="truncate text-[13px] text-[#64748B]">{row.phone || '—'}</p>
              </div>
              <span className="text-[#94A3B8]">›</span>
            </Link>
          ))}
        </div>
      )}

      {patientsQuery.data ? (
        <p className="text-center text-[13px] text-[#94A3B8]">
          Showing {items.length} of {patientsQuery.data.total} users with reports
        </p>
      ) : null}
    </div>
  );
};
