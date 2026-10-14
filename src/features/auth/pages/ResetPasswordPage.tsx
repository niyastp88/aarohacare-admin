import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { authService } from '@/api/services/auth';
import { AuthShell } from '@/components/auth/AuthShell';
import { IconLock } from '@/components/auth/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/components/ui/Toast';
import { APP } from '@/constants/app';
import { APP_ROUTES } from '@/constants/routes';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() || '', [params]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Reset link is missing or invalid. Request a new one.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ token, password });
      showToast('Password updated. You can sign in now.');
      navigate(APP_ROUTES.LOGIN, { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="mb-8 flex items-center justify-between gap-4">
          <p className="text-lg font-bold tracking-tight text-[#0b2a4a]">{APP.NAME}</p>
          <BackButton to={APP_ROUTES.LOGIN} size="sm">
            Back to Login
          </BackButton>
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#0b2a4a]">
          Reset link invalid
        </h1>
        <p className="mt-2 mb-8 text-[15px] leading-relaxed text-[#4B5563]">
          This page needs a valid token from your email. Request a new reset link to continue.
        </p>
        <Link
          to={APP_ROUTES.FORGOT_PASSWORD}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0b2a4a] px-5 text-sm font-semibold text-white"
        >
          Request new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="text-lg font-bold tracking-tight text-[#0b2a4a]">{APP.NAME}</p>
        <BackButton to={APP_ROUTES.LOGIN} size="sm">
          Back to Login
        </BackButton>
      </div>

      <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#0b2a4a]">
        Choose a new password
      </h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-[#4B5563]">
        Enter and confirm your new password to finish resetting access.
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="New password"
          isPassword
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leadingIcon={<IconLock />}
        />
        <Input
          label="Confirm password"
          isPassword
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leadingIcon={<IconLock />}
        />

        {error ? (
          <p className="rounded-lg bg-error-soft px-3.5 py-2.5 text-sm text-error">{error}</p>
        ) : null}

        <Button type="submit" variant="navy" fullWidth loading={loading}>
          Save password
        </Button>
      </form>
    </AuthShell>
  );
};
