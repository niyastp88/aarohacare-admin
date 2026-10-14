import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
}

export const Card = ({ children, title, className = '', ...rest }: CardProps) => (
  <div
    className={['rounded-2xl border border-border bg-white p-5 shadow-sm', className]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {title && <h3 className="mb-3 text-base font-bold text-gray-900">{title}</h3>}
    {children}
  </div>
);
