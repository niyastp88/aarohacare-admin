import { useState } from 'react';
import type { FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { authService } from '@/api/services/auth';
import { AuthShell } from '@/components/auth/AuthShell';
import { IconMail } from '@/components/auth/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { showToast } from '@/components/ui/Toast';
import { APP } from '@/constants/app';
import { APP_ROUTES } from '@/constants/routes';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.forgotPassword({ email: normalized });
      setSuccess(result.message);
      showToast(result.message);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="text-lg font-bold tracking-tight text-[#0b2a4a]">{APP.NAME}</p>
        <BackButton to={APP_ROUTES.LOGIN} size="sm">
          Back to Login
        </BackButton>
      </div>

      <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#0b2a4a]">
        Reset Your Password
      </h1>
      <p className="mt-2 mb-8 text-[15px] leading-relaxed text-[#4B5563]">
        Enter your professional email to receive a secure reset link.
      </p>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          hideLabel
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leadingIcon={<IconMail />}
        />

        {error ? (
          <p className="rounded-lg bg-error-soft px-3.5 py-2.5 text-sm text-error">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-lg bg-success-soft px-3.5 py-2.5 text-sm text-success">{success}</p>
        ) : null}

        <Button type="submit" variant="navy" fullWidth loading={loading}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
};
