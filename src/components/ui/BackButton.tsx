import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type BackButtonBase = {
  children?: ReactNode;
  className?: string;
  /** compact = icon + short label; pill is the default look */
  size?: 'sm' | 'md';
};

type BackButtonLinkProps = BackButtonBase & {
  to: string;
  onClick?: never;
};

type BackButtonActionProps = BackButtonBase & {
  to?: never;
  onClick: () => void;
};

export type BackButtonProps = BackButtonLinkProps | BackButtonActionProps;

const BackChevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="m14.5 6-6 6 6 6" />
  </svg>
);

/** Shared back navigation control — use on detail / form pages. */
export const BackButton = (props: BackButtonProps) => {
  const { children = 'Back', className = '', size = 'md' } = props;
  const padding = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-3.5 py-2 text-[14px]';
  const iconBox = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';

  const classes = [
    'group inline-flex items-center gap-2.5 rounded-full border border-[#E5EAF0] bg-white',
    'font-bold text-[#0F172A] shadow-[0_2px_8px_rgba(15,23,42,0.05)]',
    'transition-all duration-200',
    'hover:-translate-x-0.5 hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.2)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2A4A]/20',
    'active:scale-[0.98]',
    padding,
    className,
  ].join(' ');

  const content = (
    <>
      <span
        className={[
          'inline-flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#0B2A4A]',
          'transition-colors duration-200 group-hover:bg-[#0B2A4A] group-hover:text-white',
          iconBox,
        ].join(' ')}
      >
        <BackChevron />
      </span>
      <span className="pr-0.5">{children}</span>
    </>
  );

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={classes}>
      {content}
    </button>
  );
};
