import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { uploadsService } from '@/api/services/uploads';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { DocumentPreviewModal } from '@/components/ui/DocumentPreviewModal';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { APP_ROUTES } from '@/constants/routes';
import { useCreateLabReport, useDeleteLabReport, useLabPatient, useLabReports } from '@/hooks/useLabReports';
import type { LabReportDto, LabReportPatientDto } from '@/types/dto';

const asPatient = (value: LabReportDto['patientId']): LabReportPatientDto | null => {
  if (!value || typeof value === 'string') return null;
  return value;
};

const reportFileUrl = (report: LabReportDto) => report.fileUrl || report.reportUrl || '';

const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

// Format date header to match the reference design: e.g. "10/10/26", "28/9/26"
const formatDateHeader = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const dayKey = (value?: string) => {
  if (!value) return 'unknown';
  const d = new Date(value);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Patient detail with report history (matches reference dashboard layout). */
export const LabUserDetailPage = () => {
  const { patientId = '' } = useParams();
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const createReport = useCreateLabReport();
  const deleteReport = useDeleteLabReport();
  const patientQuery = useLabPatient(patientId, Boolean(patientId));
  const reportsQuery = useLabReports({ patientId }, Boolean(patientId));
  const reports = reportsQuery.data ?? [];

  const patient = useMemo(() => {
    if (patientQuery.data) {
      return {
        _id: patientQuery.data._id,
        name: patientQuery.data.name,
        phone: patientQuery.data.phone,
        place: patientQuery.data.place,
        age: patientQuery.data.age,
        gender: patientQuery.data.gender,
        profileImage: patientQuery.data.profileImage,
        address: patientQuery.data.address,
      };
    }
    for (const report of reports) {
      const p = asPatient(report.patientId);
      if (p) return p;
    }
    return null;
  }, [patientQuery.data, reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q),
    );
  }, [reports, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, LabReportDto[]>();
    for (const report of filtered) {
      const key = dayKey(report.createdAt);
      const list = map.get(key) ?? [];
      list.push(report);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const onSelectFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFileError('Only image files (JPG, PNG, WebP) are allowed');
      showToast('Only image files are allowed', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds the 5MB limit');
      showToast('File size must be under 5MB', 'error');
      return;
    }
    setSelectedFile(file);
    setFileError('');
  };

  const onSendReport = async () => {
    if (!patientId) return;

    // Report file upload is mandatory
    if (!selectedFile) {
      setFileError('Please select a report file before sending.');
      showToast('Upload Report is required', 'error');
      return;
    }

    try {
      setUploading(true);
      const uploaded = await uploadsService.image(selectedFile, 'aarohcare/lab-reports');
      if (!uploaded?.url) {
        throw new Error('Failed to obtain uploaded file URL');
      }

      await createReport.mutateAsync({
        patientId,
        title: title.trim() || 'Lab Report',
        reportUrl: uploaded.url,
        notes: linkUrl.trim() || undefined,
      });

      setTitle('');
      setLinkUrl('');
      setSelectedFile(null);
      setFileError('');
      showToast('Report sent to patient successfully', 'success');
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    } finally {
      setUploading(false);
    }
  };

  if (reportsQuery.isLoading || patientQuery.isLoading) {
    return <Spinner label="Loading patient…" />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to={APP_ROUTES.ADMIN.USERS}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to users</span>
        </Link>
        <NotificationBell />
      </div>

      {/* Patient info card */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-4 min-w-0">
          {patient?.profileImage ? (
            <img
              src={patient.profileImage}
              alt=""
              className="h-16 w-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2563EB] text-[24px] font-bold text-white shrink-0 shadow-xs">
              {initials(patient?.name)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold text-[#0F172A] truncate">
              {patient?.name || 'Patient'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[13px]">
              <span className="rounded-full bg-slate-100 px-3 py-0.5 font-bold text-slate-600">
                ID · {patientId.slice(-8).toUpperCase()}
              </span>
              <span className="font-semibold text-slate-800">
                {patient?.phone || '—'}
              </span>
              {patient?.place && (
                <span className="text-slate-500">· {patient.place}</span>
              )}
              {patient?.address && (
                <span className="text-slate-500">· {patient.address}</span>
              )}
            </div>
          </div>
        </div>

        {/* Total reports badge box */}
        <div className="rounded-2xl bg-[#E8F1FD] px-7 py-3 text-center min-w-[130px] shrink-0">
          <p className="text-[11px] font-bold tracking-wider uppercase text-blue-600">
            TOTAL REPORTS
          </p>
          <p className="mt-0.5 text-3xl font-extrabold text-[#0F172A]">
            {reports.length}
          </p>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left Column: Send a report */}
        <aside className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs h-fit space-y-4">
          <h2 className="text-xl font-bold text-[#0F172A]">Send a report</h2>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
              Report title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CBC"
              className="w-full rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
              Link (optional)
            </label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste a link"
              className="w-full rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-4 py-3 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0F172A] mb-1.5">
              Upload Report <span className="text-red-500">*</span>
            </label>

            <label
              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all ${
                selectedFile
                  ? 'border-emerald-400 bg-emerald-50/30 hover:border-emerald-500'
                  : fileError
                  ? 'border-red-400 bg-red-50/30'
                  : 'border-blue-200 bg-[#F8FAFC] hover:border-blue-400 hover:bg-blue-50/30'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading || createReport.isPending}
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />

              {uploading ? (
                <div className="flex flex-col items-center py-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600" />
                  <p className="mt-3 text-sm font-semibold text-blue-600">Uploading file…</p>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center w-full px-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-800 truncate max-w-[260px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(0)} KB · Click to replace
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="mt-2 text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-[#2563EB] transition-transform group-hover:scale-105">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 16.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
                      <polyline points="7 9 12 4 17 9" />
                      <line x1="12" y1="4" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Upload an image of the report
                  </p>
                </div>
              )}
            </label>

            {fileError && (
              <p className="mt-1.5 text-xs font-semibold text-red-600">{fileError}</p>
            )}
          </div>

          <button
            type="button"
            disabled={createReport.isPending || uploading}
            onClick={() => void onSendReport()}
            className="mt-2 w-full rounded-2xl bg-[#2563EB] hover:bg-blue-700 active:scale-[0.99] py-3.5 px-6 font-bold text-white shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 -rotate-45"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>
              {uploading
                ? 'Uploading…'
                : createReport.isPending
                ? 'Sending…'
                : 'Send report'}
            </span>
          </button>
        </aside>

        {/* Right Column: Report history */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <h2 className="text-xl font-bold text-[#0F172A] text-center mb-6">
            Report history
          </h2>

          <div className="relative mb-6">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports by name"
              className="w-full rounded-2xl border border-slate-200/80 bg-[#F8FAFC] pl-11 pr-4 py-3 text-sm text-[#0F172A] placeholder-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white"
            />
          </div>

          {grouped.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-slate-500">
              No reports for this patient yet.
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(([key, list]) => (
                <div key={key}>
                  <p className="mb-2 text-sm font-bold text-slate-800">
                    {formatDateHeader(list[0]?.createdAt)}
                  </p>
                  <ul className="space-y-2.5">
                    {list.map((report) => {
                      const file = reportFileUrl(report);
                      return (
                        <li
                          key={report._id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100/80 bg-[#F8FAFC] px-4 py-3.5 hover:bg-slate-100/60 transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-5 w-5 text-slate-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p className="truncate text-sm font-semibold text-[#0F172A]">
                              {report.title}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {file ? (
                              <button
                                type="button"
                                onClick={() => setPreview({ url: file, title: report.title })}
                                className="rounded-full bg-[#2563EB] hover:bg-blue-700 text-white px-5 py-1.5 text-xs font-bold shadow-xs transition"
                              >
                                View
                              </button>
                            ) : null}

                            <button
                              type="button"
                              disabled={deleteReport.isPending}
                              onClick={() =>
                                sweetAlert.confirm(
                                  'Delete Report',
                                  `Are you sure you want to delete "${report.title}"? This cannot be undone.`,
                                  () => {
                                    deleteReport.mutate(report._id, {
                                      onSuccess: () =>
                                        showToast('Report deleted successfully', 'success'),
                                      onError: (err) =>
                                        showToast(getApiErrorMessage(err), 'error'),
                                    });
                                  },
                                  {
                                    tone: 'danger',
                                    confirmText: 'Delete',
                                    cancelText: 'Cancel',
                                  },
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 opacity-60 group-hover:opacity-100"
                              title="Delete report"
                            >
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <DocumentPreviewModal
        open={Boolean(preview)}
        url={preview?.url || ''}
        title={preview?.title || 'Lab report'}
        onClose={() => setPreview(null)}
      />
    </div>
  );
};
