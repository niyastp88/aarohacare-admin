import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { emergencyService } from '@/api/services/emergency';
import { uploadsService } from '@/api/services/uploads';
import { ImageCropModal } from '@/components/media/ImageCropModal';
import { IconClock, IconSend, IconWarning } from '@/components/layout/icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { sweetAlert } from '@/components/ui/SweetAlert';
import { showToast } from '@/components/ui/Toast';
import { useChangePassword } from '@/hooks/useChangePassword';
import { useMyFacility, useUpdateMyFacility } from '@/hooks/useFacility';
import type { WeekDay } from '@/types/dto';
import { isValidPhone, toLocalPhone } from '@/utils/formatters';
import { CancellationPolicySection } from '../components/CancellationPolicySection';

const LOGO_ASPECT = 1;
const DEFAULT_HOURS = { from: '08:00', to: '18:00' };
const WEEKDAY_DEFAULT: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

const OPEN_DAYS: Array<{ id: WeekDay; label: string }> = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

const fieldClass =
  'w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-[14px] text-[#111827] outline-none transition placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100';

const NAV_ITEMS: Array<{ id: string; label: string; icon: string; badge?: string }> = [
  { id: 'business', label: 'Business Details', icon: '🏥' },
  { id: 'hours',    label: 'Working Hours',    icon: '🕐' },
  { id: 'policy',  label: 'Cancellation Policy', icon: '📋', badge: 'Soon' },
  { id: 'security',label: 'Security',          icon: '🔒' },
  { id: 'alert',   label: 'Admin Alert',       icon: '🚨' },
];

export const SettingsPage = () => {
  const facilityQuery = useMyFacility();
  const updateFacility = useUpdateMyFacility();
  const changePassword = useChangePassword();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoPreviewRef = useRef('');
  const cropSrcRef = useRef<string | null>(null);

  const [section, setSection] = useState('business');

  const handleNavClick = (itemId: string) => {
    if (itemId === 'policy') {
      sweetAlert.confirm(
        'Coming Soon',
        'Cancellation Policy is currently under development and will be available in the next update.',
        () => {},
        {
          tone: 'info',
          confirmText: 'Understood',
          cancelText: 'Close',
        },
      );
      return;
    }
    setSection(itemId);
  };

  const [alertMessage, setAlertMessage] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertError, setAlertError] = useState('');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hoursFrom, setHoursFrom] = useState(DEFAULT_HOURS.from);
  const [hoursTo, setHoursTo] = useState(DEFAULT_HOURS.to);
  const [is24Hours, setIs24Hours] = useState(false);
  const [openDays, setOpenDays] = useState<WeekDay[]>(WEEKDAY_DEFAULT);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState('');
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const facility = facilityQuery.data;
  logoPreviewRef.current = logoPreview;
  cropSrcRef.current = cropSrc;

  useEffect(() => {
    if (!facility) return;
    setName(facility.name || '');
    setAddress(facility.address || '');
    setPhone(facility.phone ? toLocalPhone(facility.phone) : '');
    setHoursFrom(facility.workingHours?.from || DEFAULT_HOURS.from);
    setHoursTo(facility.workingHours?.to || DEFAULT_HOURS.to);
    setIs24Hours(Boolean(facility.workingHours?.is24Hours));
    setOpenDays(facility.openDays ?? WEEKDAY_DEFAULT);
    setLogoUrl(facility.image || '');
    setAlertMessage(facility.globalAlert || '');
    // Hydrate once per facility so sending an alert does not wipe in-progress edits.
  }, [facility?._id]);

  useEffect(
    () => () => {
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current);
      if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    },
    [],
  );

  const displayedLogo = logoPreview || logoUrl;

  const toggleDay = (day: WeekDay) => {
    setOpenDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  };

  const handleLogoPick = (file: File | null) => {
    if (!file) return;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleCropConfirm = (file: File) => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleSendAlert = async (event: FormEvent) => {
    event.preventDefault();
    setAlertError('');
    if (!alertMessage.trim()) {
      setAlertError('Enter a message to send');
      return;
    }
    try {
      setSendingAlert(true);
      await updateFacility.mutateAsync({ globalAlert: alertMessage.trim() });
      await emergencyService.create({
        body: alertMessage.trim(),
        subject: 'Super Admin Alert',
        channel: 'SETTINGS_ALERT',
        priority: 'EMERGENCY',
      });
      showToast('Alert sent to Super Admin');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setAlertError(message);
      showToast(message, 'error');
    } finally {
      setSendingAlert(false);
    }
  };

  const handleSaveBusiness = async (event: FormEvent) => {
    event.preventDefault();
    setBusinessError('');

    if (!name.trim()) {
      setBusinessError('Business name is required');
      return;
    }
    if (!isValidPhone(phone)) {
      setBusinessError('Enter a valid contact number');
      return;
    }

    setSavingBusiness(true);
    try {
      let image = logoUrl;
      if (logoFile) {
        const uploaded = await uploadsService.image(logoFile, 'aarohcare/facilities');
        image = uploaded.url;
      }

      await updateFacility.mutateAsync({
        name: name.trim(),
        address: address.trim(),
        phone: toLocalPhone(phone),
        image,
        workingHours: {
          from: is24Hours ? '00:00' : hoursFrom,
          to: is24Hours ? '23:59' : hoursTo,
          is24Hours,
        },
        openDays,
      });
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview('');
      setLogoFile(null);
      setLogoUrl(image);
      showToast('Business details saved');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setBusinessError(message);
      showToast(message, 'error');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleUpdatePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError('');

    if (!currentPassword || !newPassword) {
      setPasswordError('Current and new password are required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully');
    } catch (err) {
      const message = getApiErrorMessage(err);
      setPasswordError(message);
      showToast(message, 'error');
    }
  };

  if (facilityQuery.isLoading) {
    return <Spinner label="Loading settings…" />;
  }

  if (facilityQuery.isError) {
    return (
      <p className="text-sm text-[#DC2626]">{getApiErrorMessage(facilityQuery.error)}</p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1060px]">

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A] sm:text-[32px]">
          Settings
        </h1>
        <p className="mt-1 text-[14px] text-[#64748B]">
          Manage your facility profile, working hours, cancellation rules, and account security.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

        {/* ── Left Nav ───────────────────────────────────────── */}
        <nav className="shrink-0 lg:sticky lg:top-6 lg:w-52">
          <ul className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition text-left',
                    section === item.id
                      ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                      : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-[15px] leading-none">{item.icon}</span>
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#B45309]">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Right Content ──────────────────────────────────── */}
        <div className="min-w-0 flex-1 flex flex-col gap-6">

          {/* ── Business Details ─────────────────────────── */}
          {section === 'business' && (
            <SettingsCard icon="🏥" title="Business Details"
              description="Your facility's public name, address, phone, and logo.">
              <form onSubmit={handleSaveBusiness} className="space-y-5">
                {/* Logo */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-[#374151]">Business Logo</p>
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC]">
                      {displayedLogo ? (
                        <img src={displayedLogo} alt="Business logo" className="h-full w-full object-cover rounded-2xl" />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Logo</span>
                      )}
                    </div>
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleLogoPick(event.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="rounded-xl border border-[#BFDBFE] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1D4ED8] transition hover:bg-[#EFF6FF]"
                      >
                        Upload Logo
                      </button>
                      <p className="mt-1.5 text-[11px] text-[#94A3B8]">JPG, PNG or WebP · Square recommended</p>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-[#F1F5F9]" />

                <Input
                  label="Business Name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Aarohcare Central Clinic"
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="business-address" className="text-[13px] font-semibold text-[#374151]">
                    Address
                  </label>
                  <textarea
                    id="business-address"
                    rows={3}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Street, district, city"
                    className={`${fieldClass} min-h-[88px] resize-y`}
                  />
                </div>

                <Input
                  label="Contact Number"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="98765 43210"
                  inputMode="tel"
                />

                {businessError ? <ErrorBanner message={businessError} /> : null}

                <Button type="submit" variant="navy" loading={savingBusiness}>
                  Save Business Details
                </Button>
              </form>
            </SettingsCard>
          )}

          {/* ── Working Hours ───────────────────────────── */}
          {section === 'hours' && (
            <SettingsCard icon="🕐" title="Working Hours"
              description="Days and hours your facility is open for patient bookings.">
              <form onSubmit={handleSaveBusiness} className="space-y-6">

                {/* 24-hour toggle row */}
                <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F172A]">24-Hour Service</p>
                    <p className="mt-0.5 text-[12px] text-[#64748B]">
                      Enable if your facility operates round the clock.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={is24Hours}
                      onChange={(event) => setIs24Hours(event.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="h-6 w-11 rounded-full bg-[#CBD5E1] transition-colors peer-checked:bg-[#3B82F6] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-5" />
                  </label>
                </div>

                {is24Hours ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#1D4ED8]">24h</span>
                    <div>
                      <p className="text-[14px] font-semibold text-[#1E3A8A]">24 Hours Service Active</p>
                      <p className="text-[12px] text-[#3B82F6]">
                        This facility operates 24 hours round the clock on the selected open days.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <TimeField label="Opens at" value={hoursFrom} onChange={setHoursFrom} />
                    <TimeField label="Closes at" value={hoursTo} onChange={setHoursTo} />
                  </div>
                )}

                {/* Open days */}
                <div>
                  <p className="mb-3 text-[13px] font-semibold text-[#374151]">Open Days</p>
                  <div className="flex flex-wrap gap-2">
                    {OPEN_DAYS.map((day) => {
                      const on = openDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={[
                            'rounded-full border px-4 py-1.5 text-[13px] font-semibold transition',
                            on
                              ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-sm'
                              : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#93C5FD] hover:text-[#1D4ED8]',
                          ].join(' ')}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-[#94A3B8]">Tap a day to toggle it on or off.</p>
                </div>

                {businessError ? <ErrorBanner message={businessError} /> : null}

                <Button type="submit" variant="navy" loading={savingBusiness}>
                  Save Working Hours
                </Button>
              </form>
            </SettingsCard>
          )}

          {/* ── Cancellation Policy (Temporarily unavailable - planned for next update) ─────────────────────── */}
          {section === 'policy' && (
            <SettingsCard
              icon="📋"
              title="Cancellation Policy"
              description="Configure refund windows and cancellation rules shown to patients."
            >
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 sm:p-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[26px]">
                  🚧
                </div>
                <span className="mt-3 inline-flex items-center rounded-full bg-[#DBEAFE] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
                  Coming Soon
                </span>
                <h3 className="mt-3 text-[17px] font-bold text-[#0F172A]">
                  Feature Under Development
                </h3>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#64748B]">
                  Cancellation Policy is currently under development and will be available in the next update.
                </p>
              </div>

              {/* Existing Cancellation Policy code preserved below for upcoming release */}
              {false && <CancellationPolicySection facility={facility} />}
            </SettingsCard>
          )}

          {/* ── Security ───────────────────────────────── */}
          {section === 'security' && (
            <SettingsCard icon="🔒" title="Security"
              description="Change your admin account password to keep it secure.">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <Input
                  label="Current Password"
                  isPassword
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  label="New Password"
                  isPassword
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm New Password"
                  isPassword
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />

                {passwordError ? <ErrorBanner message={passwordError} /> : null}

                <div>
                  <button
                    type="submit"
                    disabled={changePassword.isPending}
                    className="rounded-xl border border-[#BFDBFE] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#1D4ED8] transition hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {changePassword.isPending ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            </SettingsCard>
          )}

          {/* ── Admin Alert ─────────────────────────────── */}
          {section === 'alert' && (
            <div className="overflow-hidden rounded-2xl border border-[#FCA5A5] bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-[#FEE2E2] bg-[#FEF2F2] px-6 py-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2]">
                  <IconWarning fill="#DC2626" stroke="white" />
                </span>
                <div>
                  <h2 className="text-[17px] font-bold text-[#991B1B]">Super Admin Alert</h2>
                  <p className="text-[13px] text-[#B91C1C]">
                    Send an urgent message directly to the Super Admin dashboard.
                  </p>
                </div>
              </div>
              <form onSubmit={handleSendAlert} className="space-y-4 p-6">
                <div>
                  <label htmlFor="global-alert" className="mb-2 block text-[13px] font-semibold text-[#374151]">
                    Alert Message
                  </label>
                  <textarea
                    id="global-alert"
                    rows={4}
                    value={alertMessage}
                    onChange={(event) => setAlertMessage(event.target.value)}
                    placeholder="Describe the urgent issue for Super Admin..."
                    className={`${fieldClass} min-h-[100px] resize-y`}
                  />
                </div>
                {alertError ? <ErrorBanner message={alertError} /> : null}
                <div className="rounded-xl border border-[#FEE2E2] bg-[#FFF7F7] px-4 py-3">
                  <p className="text-[12px] font-medium text-[#B91C1C]">
                    ⚠ Use only for genuine urgent situations. This will immediately notify Super Admin.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={sendingAlert}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <IconSend />
                  {sendingAlert ? 'Sending…' : 'Send Super Admin Alert'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {cropSrc ? (
        <ImageCropModal
          imageSrc={cropSrc}
          aspect={LOGO_ASPECT}
          title="Crop logo"
          confirmLabel="Use logo"
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  );
};

// ── Shared sub-components ──────────────────────────────────────────

const SettingsCard = ({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-[#F1F5F9] px-6 py-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-xl">
        {icon}
      </span>
      <div>
        <h2 className="text-[17px] font-bold text-[#0F172A]">{title}</h2>
        <p className="text-[13px] text-[#64748B]">{description}</p>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const ErrorBanner = ({ message }: { message: string }) => (
  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
    <span className="text-red-500 text-[15px]">⚠</span>
    <p className="text-[13px] text-[#DC2626]">{message}</p>
  </div>
);

const TimeField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[13px] font-semibold text-[#374151]">{label}</label>
    <div className="relative">
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 pr-10 text-[14px] text-[#111827] outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-100"
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">
        <IconClock />
      </span>
    </div>
  </div>
);
