import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { BackButton } from '@/components/ui/BackButton';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useFacilityPatients } from '@/hooks/useAppointments';
import { toTitleCase } from '@/utils/formatters';
import {
  formatConsultDate,
  formatGender,
  initialsOf,
} from '../utils';

const formatNumber = (value: number) => value.toLocaleString('en-IN');

const PatientAvatar = ({ name, image }: { name: string; image?: string }) => {
  if (image) {
    return <img src={image} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[13px] font-bold text-[#1D4ED8]">
      {initialsOf(name)}
    </div>
  );
};

/** Full-page Total Users Directory — opened from Search Patients. */
export const UserDirectoryPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refundFilter, setRefundFilter] = useState<'all' | 'pending' | 'refunded'>('all');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const patientsQuery = useFacilityPatients({
    search: search || undefined,
    page,
    limit: 10,
    refundStatus: refundFilter === 'all' ? undefined : refundFilter,
  });

  const pageData = patientsQuery.data;
  const patients = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const total = pageData?.total ?? 0;
  const limit = pageData?.limit ?? 10;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  const exportCsv = () => {
    if (patients.length === 0) {
      showToast('No patients to export', 'error');
      return;
    }
    const rows = [
      ['Name', 'Phone', 'Age', 'Gender', 'Patient Number', 'Last Consultation', 'Place'],
      ...patients.map((p) => [
        toTitleCase(p.name),
        p.phone,
        p.age != null ? String(p.age) : '',
        formatGender(p.gender),
        p.phone,
        formatConsultDate(p.lastBookingAt),
        p.place ?? '',
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-directory.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackButton to={APP_ROUTES.ADMIN.PATIENTS} size="sm">
            Total Users Directory
          </BackButton>
          <p className="mt-1 text-[13.5px] text-[#64748B]">
            All registered and walk-in patients across the entire facility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-[#D7DEE7] bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-[#334155] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F8FAFC]"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 4v10" />
              <path d="M8 10l4 4 4-4" />
              <path d="M5 18h14" />
            </svg>
            Export
          </button>
          <NotificationBell />
        </div>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16.5 16.5 21 21" />
          </svg>
        </span>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search patients by name, phone, or ID..."
          className="w-full rounded-2xl border border-[#E5EAF0] bg-white py-3.5 pl-11 pr-4 text-[14.5px] text-[#0F172A] shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none placeholder:text-[#94A3B8] focus:border-[#0B2A4A]/35 focus:ring-2 focus:ring-[#0B2A4A]/10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all' as const, label: 'All users' },
            { id: 'pending' as const, label: 'Refund pending' },
            { id: 'refunded' as const, label: 'Refunded' },
          ] as const
        ).map((opt) => {
          const active = refundFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setRefundFilter(opt.id);
                setPage(1);
              }}
              className={[
                'rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition',
                active
                  ? 'bg-[#0B2A4A] text-white'
                  : 'border border-[#E5EAF0] bg-white text-[#475569] hover:bg-[#F8FAFC]',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5EAF0] bg-[#F7FAFC] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {patientsQuery.isLoading ? (
          <div className="bg-white p-8">
            <Spinner label="Loading directory…" />
          </div>
        ) : patientsQuery.isError ? (
          <p className="bg-white p-6 text-[#DC2626]">{getApiErrorMessage(patientsQuery.error)}</p>
        ) : patients.length === 0 ? (
          <p className="bg-white p-8 text-center text-[#64748B]">No users found.</p>
        ) : (
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E5EAF0] bg-[#F0F5FA]">
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8]">
                    PATIENT PROFILE
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8]">
                    FULL NAME
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8]">
                    PATIENT NUMBER
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8]">
                    LAST CONSULTATION DATE
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold tracking-[0.08em] text-[#94A3B8]">
                    REFUND
                  </th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => {
                  const gender = formatGender(patient.gender);
                  const meta = [
                    patient.age != null ? `Age: ${patient.age}` : null,
                    gender || null,
                  ]
                    .filter(Boolean)
                    .join(' | ');
                  const refundLabel = patient.hasPendingRefund
                    ? `Pending${patient.pendingRefundAmount ? ` · ₹${formatNumber(patient.pendingRefundAmount)}` : ''}`
                    : patient.lastRefunded
                      ? 'Refunded'
                      : '—';
                  return (
                    <tr
                      key={patient._id}
                      onClick={() => navigate(APP_ROUTES.ADMIN.PATIENT_DETAIL(patient._id))}
                      className="cursor-pointer border-b border-[#EEF2F6] transition last:border-b-0 hover:bg-[#F8FAFC]"
                    >
                      <td className="px-5 py-4">
                        <PatientAvatar name={patient.name} image={patient.profileImage} />
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-[15px] font-bold text-[#0F172A]">
                          {toTitleCase(patient.name)}
                        </p>
                        {meta ? (
                          <p className="mt-0.5 text-[13px] text-[#94A3B8]">{meta}</p>
                        ) : (
                          <p className="mt-0.5 text-[13px] text-[#94A3B8]">{patient.phone}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[14px] font-medium text-[#64748B]">
                        {patient.phone}
                      </td>
                      <td className="px-5 py-4 text-[14px] font-medium text-[#64748B]">
                        {formatConsultDate(patient.lastVisitAt || (patient.lastStatus === 'COMPLETED' ? patient.lastBookingAt : undefined))}
                      </td>
                      <td className="px-5 py-4 text-[13px] font-semibold">
                        <span
                          className={
                            patient.hasPendingRefund
                              ? 'text-[#B45309]'
                              : patient.lastRefunded
                                ? 'text-[#15803D]'
                                : 'text-[#94A3B8]'
                          }
                        >
                          {refundLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!patientsQuery.isLoading && !patientsQuery.isError && total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EAF0] bg-[#F0F5FA] px-5 py-3.5">
            <p className="text-[13px] text-[#64748B]">
              Showing{' '}
              <span className="font-bold text-[#0F172A]">
                {rangeStart}-{rangeEnd}
              </span>{' '}
              of <span className="font-bold text-[#0F172A]">{formatNumber(total)}</span> users
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5EAF0] bg-white text-[#0B2A4A] transition hover:bg-[#F8FAFC] disabled:opacity-35"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <span className="min-w-[4.5rem] text-center text-[13px] font-semibold text-[#0F172A]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                aria-label="Next page"
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5EAF0] bg-white text-[#0B2A4A] transition hover:bg-[#F8FAFC] disabled:opacity-35"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
