// This file was updated to improve the Lab Admin Dashboard.
// It changes the "New Reports" description to reflect today's count instead of the last 7 days.
import { Link } from 'react-router-dom';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Spinner } from '@/components/ui/Spinner';
import { APP_ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { useMyFacility } from '@/hooks/useFacility';
import { useLabReportStats } from '@/hooks/useLabReports';

const formatNumber = (value: number) => value.toLocaleString('en-IN');

/** Lab Command Center — New Reports + All Users cards. */
export const LabDashboardPage = () => {
  const { user } = useAuth();
  const { approved } = useFacilityAccess();
  const facilityQuery = useMyFacility();
  const statsQuery = useLabReportStats(approved);

  const facilityImage = facilityQuery.data?.image || user?.facility?.image;
  const facilityName =
    facilityQuery.data?.name || user?.facility?.name || user?.name || 'Lab';
  const stats = statsQuery.data;
  const loading = approved && statsQuery.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm ring-4 ring-[#F1F5F9]">
            {facilityImage ? (
              <img
                src={facilityImage}
                alt={facilityName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0B2A4A] to-[#1D4ED8] text-[22px] font-extrabold text-white">
                {facilityName.charAt(0).toUpperCase() || 'L'}
              </div>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-[#EFF6FF] px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wider text-[#1D4ED8] ring-1 ring-inset ring-[#DBEAFE]">
                Laboratory Admin
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Active Facility
              </span>
            </div>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-[#1A1F36] sm:text-[34px]">
              {facilityName}
            </h1>
            <p className="mt-0.5 text-[14.5px] text-[#64748B]">
              Real-time oversight for your laboratory. Review new reports and manage patients.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </div>

      {!approved ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-[15px] text-[#64748B]">
          Waiting for Super Admin approval. Lab tools unlock once your facility is approved.
        </div>
      ) : loading ? (
        <Spinner label="Loading lab stats…" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to={`${APP_ROUTES.ADMIN.REPORTS}?mode=TODAY`}
            className="group flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:border-[#3B82F6]/hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[#64748B]">New Reports</p>
                <p className="mt-3 text-[42px] font-bold leading-none tracking-tight text-[#1A1F36]">
                  {formatNumber(stats?.newReports ?? 0)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-[#94A3B8]">
              Reports created today
            </p>
            <span className="mt-6 text-[14px] font-semibold text-[#2563EB] group-hover:underline">
              Review All
            </span>
          </Link>

          <Link
            to={`${APP_ROUTES.ADMIN.REPORTS}?mode=ALL_MONTHS`}
            className="group flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:border-[#3B82F6]/hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[#64748B]">Total Reports</p>
                <p className="mt-3 text-[42px] font-bold leading-none tracking-tight text-[#1A1F36]">
                  {formatNumber(stats?.totalReports ?? 0)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-[#94A3B8]">
              All-time reports for this facility
            </p>
            <span className="mt-6 text-[14px] font-semibold text-[#2563EB] group-hover:underline">
              Review All
            </span>
          </Link>

          <Link
            to={APP_ROUTES.ADMIN.USERS}
            className="group flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:border-[#3B82F6]/hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[#64748B]">Lab Patients</p>
                <p className="mt-3 text-[42px] font-bold leading-none tracking-tight text-[#1A1F36]">
                  {formatNumber(stats?.allUsers ?? 0)}
                </p>
              </div>
              <span className="rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[12px] font-bold text-[#15803D]">
                Patients
              </span>
            </div>
            <p className="mt-4 text-[13px] text-[#94A3B8]">
              Unique patients with reports
            </p>
            <span className="mt-6 text-[14px] font-semibold text-[#2563EB] group-hover:underline">
              Manage Users
            </span>
          </Link>
        </div>
      )}
    </div>
  );
};
