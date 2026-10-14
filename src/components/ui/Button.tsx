import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'navy';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-primary-light text-primary-dark hover:bg-primary-soft',
  danger: 'bg-error text-white hover:bg-red-700',
  navy: 'bg-[#0b2a4a] text-white hover:bg-[#081f37]',
};

export const Button = ({
  children,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) => (
  <button
    className={[
      'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
      variantClass[variant],
      fullWidth ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled || loading}
    {...rest}
  >
    {loading ? 'Please wait…' : children}
  </button>
);
