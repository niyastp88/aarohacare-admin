import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { AuthShell } from '@/components/auth/AuthShell';
import {
  IconBuilding,
  IconClinic,
  IconLab,
  IconLock,
  IconMail,
  IconPhone,
} from '@/components/auth/icons';
import {
  PlaceLocationPicker,
  type PlaceSelection,
} from '@/components/maps/PlaceLocationPicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP } from '@/constants/app';
import { APP_ROUTES } from '@/constants/routes';
import { FACILITY_TYPE_OPTIONS, FACILITY_TYPES, USER_ROLES } from '@/constants/roles';
import { useRegister } from '@/hooks/useRegister';
import type { FacilityType } from '@/types/dto';
import { isValidPhone, toLocalPhone } from '@/utils/formatters';
import { showToast } from '@/components/ui/Toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FACILITY_ICONS: Record<FacilityType, ReactNode> = {
  [FACILITY_TYPES.CLINIC]: <IconClinic className="h-[22px] w-[22px]" />,
  [FACILITY_TYPES.HOSPITAL]: <IconBuilding className="h-[22px] w-[22px]" />,
  [FACILITY_TYPES.LAB]: <IconLab className="h-[22px] w-[22px]" />,
};

export const RegisterPage = () => {
  const navigate = useNavigate();
  const register = useRegister();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>(FACILITY_TYPES.CLINIC);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [placeSelection, setPlaceSelection] = useState<PlaceSelection | null>(null);
  const [upiId, setUpiId] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter facility name';
    if (!EMAIL_RE.test(email.trim().toLowerCase())) next.email = 'Enter a valid email address';
    if (!isValidPhone(phone)) next.phone = 'Enter a valid contact number';
    if (password.length < 6) next.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    if (!placeSelection?.place || !placeSelection.location) {
      next.place = 'Select a place from suggestions or pin it on the map';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!validate() || !placeSelection) return;

    try {
      await register.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: toLocalPhone(phone),
        password,
        role: USER_ROLES.ADMIN,
        facilityType,
        place: placeSelection.place,
        location: placeSelection.location,
      });
      showToast('Registration submitted. Super Admin will review your facility before it can operate.');
      navigate(APP_ROUTES.ADMIN.ROOT, { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    }
  };

  return (
    <AuthShell wide>
      <div className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0b6bcb]">
          Join Aarohcare
        </p>
        <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-tight text-[#0b2a4a]">
          {APP.NAME} Admin
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#4B5563]">
          Register your hospital, clinic, or lab to start managing appointments.
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div>
          <p className="mb-2.5 text-sm font-semibold text-[#111827]">Facility type</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {FACILITY_TYPE_OPTIONS.map((option) => {
              const active = facilityType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFacilityType(option.value)}
                  className={[
                    'rounded-xl border px-3 py-3.5 text-left transition',
                    active
                      ? 'border-[#0b2a4a] bg-[#F3F7FB] shadow-sm'
                      : 'border-[#D7DEE7] bg-white hover:border-[#9EB4C9]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mb-2.5 flex h-10 w-10 items-center justify-center rounded-full',
                      active ? 'bg-[#0b2a4a] text-white' : 'bg-[#EEF3F8] text-[#0b2a4a]',
                    ].join(' ')}
                  >
                    {FACILITY_ICONS[option.value]}
                  </span>
                  <span
                    className={[
                      'block text-sm font-bold',
                      active ? 'text-[#0b2a4a]' : 'text-[#111827]',
                    ].join(' ')}
                  >
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-[#4B5563]">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Facility name"
            placeholder="e.g. Sunrise Multispeciality Clinic"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
          />
          <Input
            label="Professional email"
            type="email"
            autoComplete="email"
            placeholder="you@clinic.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            leadingIcon={<IconMail />}
          />
        </div>

        <Input
          label="Contact number"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Enter contact number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fieldErrors.phone}
          leadingIcon={<IconPhone />}
        />

        <PlaceLocationPicker
          value={placeSelection}
          onChange={(value) => {
            setPlaceSelection(value);
            if (fieldErrors.place) {
              setFieldErrors((current) => {
                const next = { ...current };
                delete next.place;
                return next;
              });
            }
          }}
          error={fieldErrors.place}
        />

        
        {/* Bank & Settlement Details Section (Optional) */}
        <div className="rounded-xl border border-[#E5EAF0] bg-[#F8FAFC] p-4">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[#0b2a4a]">Bank & UPI Settlement Details (Optional)</h3>
            <p className="text-xs text-[#64748B]">
              All patient OP booking fees for your doctors will be credited to your account. You can set this now or update later in Settings.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Input
              label="UPI ID (e.g. clinicadmin@okicici)"
              placeholder="e.g. clinicadmin@okicici"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Bank Name"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <Input
                label="Account Number"
                placeholder="Account number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
              <Input
                label="IFSC Code"
                placeholder="IFSC Code"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            isPassword
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            leadingIcon={<IconLock />}
          />
          <Input
            label="Confirm password"
            isPassword
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            leadingIcon={<IconLock />}
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-error-soft px-3.5 py-2.5 text-sm text-error">{error}</p>
        ) : null}

        <Button type="submit" variant="navy" fullWidth loading={register.isPending}>
          Create admin account
        </Button>

        <p className="text-center text-sm text-[#4B5563]">
          Already registered?{' '}
          <Link to={APP_ROUTES.LOGIN} className="font-semibold text-[#0b2a4a] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};
