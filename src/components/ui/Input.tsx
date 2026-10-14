import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconEye, IconEyeOff } from '@/components/auth/icons';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  isPassword?: boolean;
  leadingIcon?: ReactNode;
  /** Hide the floating label for more compact icon-led fields */
  hideLabel?: boolean;
}

export const Input = ({
  label,
  error,
  isPassword = false,
  leadingIcon,
  hideLabel = false,
  type,
  className = '',
  ...rest
}: InputProps) => {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : (type ?? 'text');

  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel ? (
        <label htmlFor={id} className="text-sm font-semibold text-[#111827]">
          {label}
        </label>
      ) : (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leadingIcon ? (
          <span className="pointer-events-none absolute left-3.5 text-[#6B7280]">{leadingIcon}</span>
        ) : null}
        <input
          id={id}
          type={resolvedType}
          className={[
            'w-full rounded-lg border bg-white text-[15px] text-[#111827] outline-none transition placeholder:text-[#6B7280] focus:border-[#0b2a4a] focus:ring-2 focus:ring-[#0b2a4a]/10',
            leadingIcon ? 'py-3 pl-11' : 'px-3.5 py-3',
            isPassword ? 'pr-11' : 'pr-3.5',
            error ? 'border-error' : 'border-[#D7DEE7]',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute right-3 border-0 bg-transparent text-[#4B5563] transition hover:text-[#0b2a4a]"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        ) : null}
      </div>
      {error ? <span className="text-[13px] text-error">{error}</span> : null}
    </div>
  );
};
