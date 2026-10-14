import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { APP } from '@/constants/app';
import { ADMIN_PRIMARY_NAV, APP_ROUTES, LAB_PRIMARY_NAV } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { useIsLabFacility } from '@/hooks/useIsLabFacility';
import { useMyFacility } from '@/hooks/useFacility';
import { showToast } from '@/components/ui/Toast';
import { sweetAlert } from '@/components/ui/SweetAlert';
import {
  IconChat,
  IconDoctors,
  IconHome,
  IconLock,
  IconLogout,
  IconPay,
  IconQueue,
  IconReports,
  IconSearchPatients,
  IconSettings,
  IconWallet,
  type NavIcon,
} from './icons';

const NAV_ICONS: Record<string, NavIcon> = {
  home: IconHome,
  queue: IconQueue,
  doctors: IconDoctors,
  wallet: IconWallet,
  patients: IconSearchPatients,
  reports: IconReports,
};

const iconSlot = 'inline-flex h-5 w-5 shrink-0 items-center justify-center';
const rowBase =
  'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14px] font-semibold transition';

const lockedMessage = (rejected: boolean) =>
  rejected
    ? 'This facility registration was rejected. Contact Aarohcare support.'
    : 'Waiting for Super Admin approval. Only the dashboard is available until then.';

type AdminSidebarProps = {
  onNavigate?: () => void;
};

export const AdminSidebar = ({ onNavigate }: AdminSidebarProps) => {
  const { user, logout } = useAuth();
  const { approved, rejected } = useFacilityAccess();
  const isLab = useIsLabFacility();
  const navigate = useNavigate();
  const facilityQuery = useMyFacility();
  const facilityImage = facilityQuery.data?.image || user?.facility?.image;
  const facilityName =
    facilityQuery.data?.name?.trim() ||
    user?.facility?.name?.trim() ||
    user?.name?.trim() ||
    'Your facility';
  const primaryNav = isLab ? LAB_PRIMARY_NAV : ADMIN_PRIMARY_NAV;
  const roleLabel = isLab ? 'Laboratory Admin' : facilityName;

  const onLocked = () => {
    showToast(lockedMessage(rejected), 'error');
  };

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-[#F8FAFC] px-3 py-5">
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_4px_14px_-6px_rgba(15,23,42,0.25)] ring-1 ring-[#E5EAF0]">
          {facilityImage ? (
            <img
              src={facilityImage}
              alt={facilityName}
              className="h-full w-full object-cover"
            />
          ) : (
            <img src="/aarohcare-logo.png" alt={APP.NAME} className="h-9 w-9 object-contain" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-[#0F172A]">
            {isLab ? facilityName : APP.NAME}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight text-[#64748B]">
            {isLab ? roleLabel : facilityName}
          </p>
          {isLab ? (
            <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">Aarohcare Partner</p>
          ) : null}
          {!approved ? (
            <p
              className={[
                'mt-1 text-[10px] font-bold uppercase tracking-[0.12em]',
                rejected ? 'text-rose-600' : 'text-amber-600',
              ].join(' ')}
            >
              {rejected ? 'Rejected' : 'Pending approval'}
            </p>
          ) : null}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {primaryNav.map((item) => {
          const Icon = NAV_ICONS[item.icon] || IconHome;
          const locked = !approved && !item.end;
          if (locked) {
            return (
              <LockedRow key={item.to} icon={<Icon width={20} height={20} />} onClick={onLocked}>
                {item.label}
              </LockedRow>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  rowBase,
                  isActive
                    ? 'bg-[#0B2A4A] text-white shadow-[0_8px_18px_-10px_rgba(11,42,74,0.55)]'
                    : 'text-[#5B6676] hover:bg-white hover:text-[#0F172A]',
                ].join(' ')
              }
            >
              <span className={iconSlot}>
                <Icon width={20} height={20} />
              </span>
              <span className="min-w-0 truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-[#E8EEF4] pt-3.5">
        <div className="flex flex-col gap-1">
          {approved ? (
            <NavLink
              to={APP_ROUTES.ADMIN.SETTINGS}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  rowBase,
                  isActive
                    ? 'bg-[#0B2A4A] text-white shadow-[0_8px_18px_-10px_rgba(11,42,74,0.55)]'
                    : 'text-[#5B6676] hover:bg-white hover:text-[#0F172A]',
                ].join(' ')
              }
            >
              <span className={iconSlot}>
                <IconSettings width={20} height={20} />
              </span>
              <span className="min-w-0 truncate">Settings</span>
            </NavLink>
          ) : (
            <LockedRow icon={<IconSettings width={20} height={20} />} onClick={onLocked}>
              Settings
            </LockedRow>
          )}

          <NavLink
            to={APP_ROUTES.ADMIN.CHAT}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                rowBase,
                isActive
                  ? 'bg-[#0B2A4A] text-white shadow-[0_8px_18px_-10px_rgba(11,42,74,0.55)]'
                  : 'text-[#5B6676] hover:bg-white hover:text-[#0F172A]',
              ].join(' ')
            }
          >
            <span className={iconSlot}>
              <IconChat width={18} height={18} />
            </span>
            <span className="min-w-0 truncate">Chat & Support</span>
          </NavLink>
        </div>

        {/* Action buttons with increased spacing and clear stroke lines on each box */}
        <div className="flex flex-col gap-2.5 border-t border-[#E8EEF4] pt-3">

          {approved ? (
            <NavLink
              to={APP_ROUTES.ADMIN.PAY}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  'flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] font-bold shadow-xs transition',
                  isActive
                    ? 'border-[#16A34A] bg-[#DCFCE7] text-[#15803D]'
                    : 'border-[#86EFAC] bg-[#F0FDF4] text-[#166534] hover:border-[#4ADE80] hover:bg-[#DCFCE7]',
                ].join(' ')
              }
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#16A34A] text-white shadow-xs">
                <IconPay width={15} height={15} />
              </span>
              <span className="min-w-0 truncate">Pay Aarohcare</span>
            </NavLink>
          ) : (
            <LockedRow icon={<IconPay width={18} height={18} />} onClick={onLocked}>
              Pay Aarohcare
            </LockedRow>
          )}

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-[#FECACA] bg-white px-3.5 py-2.5 text-left text-[13.5px] font-bold text-[#DC2626] shadow-xs transition hover:border-[#F87171] hover:bg-[#FEF2F2]"
            onClick={() => {
              sweetAlert.confirm(
                'Log out?',
                'You will need to sign in again to manage this facility.',
                () => {
                  void logout().then(() => navigate(APP_ROUTES.LOGIN, { replace: true }));
                },
                { confirmText: 'Log out', cancelText: 'Stay signed in', tone: 'danger' },
              );
            }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#DC2626]">
              <IconLogout width={15} height={15} />
            </span>
            <span className="min-w-0 truncate">Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

const LockedRow = ({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`${rowBase} cursor-not-allowed text-[#94A3B8]`}
  >
    <span className={iconSlot}>{icon}</span>
    <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    <IconLock className="shrink-0 opacity-70" />
  </button>
);
