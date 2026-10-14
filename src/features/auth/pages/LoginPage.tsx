import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { AuthBrandMark, AuthShell } from '@/components/auth/AuthShell';
import { IconLock, IconPhone } from '@/components/auth/icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/components/ui/Toast';
import { APP_ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';
import { useLogin } from '@/hooks/useLogin';
import { isValidPhone, toLocalPhone } from '@/utils/formatters';

export const LoginPage = () => {
  const navigate = useNavigate();
  const login = useLogin();
  const { sessionExpired, clearSessionExpired } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionExpired) return;
    setError('Your session expired. Please sign in again.');
    clearSessionExpired();
  }, [sessionExpired, clearSessionExpired]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!isValidPhone(phone)) {
      setError('Enter a valid phone number');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }

    try {
      await login.mutateAsync({ phone: toLocalPhone(phone), password });
      showToast('Signed in successfully');
      navigate(APP_ROUTES.ADMIN.ROOT, { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    }
  };

  return (
    <AuthShell>
      <AuthBrandMark subtitle="Sign in to manage your facility" />

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Phone number"
          hideLabel
          inputMode="tel"
          autoComplete="tel"
          placeholder="Enter your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          leadingIcon={<IconPhone />}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-end">
            <Link
              to={APP_ROUTES.FORGOT_PASSWORD}
              className="text-sm font-semibold text-[#0b2a4a] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            label="Password"
            hideLabel
            isPassword
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leadingIcon={<IconLock />}
          />
        </div>

        {error ? (
          <p className="rounded-lg bg-error-soft px-3.5 py-2.5 text-sm text-error">{error}</p>
        ) : null}

        <Button type="submit" variant="navy" fullWidth loading={login.isPending} className="mt-1">
          Sign in
        </Button>

        <p className="pt-1 text-center text-sm text-[#4B5563]">
          New hospital, clinic, or lab?{' '}
          <Link to={APP_ROUTES.REGISTER} className="font-semibold text-[#0b2a4a] hover:underline">
            Register here
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};
