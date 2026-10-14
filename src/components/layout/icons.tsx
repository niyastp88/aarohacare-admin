import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconHome = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
  </svg>
);

export const IconQueue = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <circle cx="8" cy="8" r="2.5" />
    <circle cx="16" cy="8" r="2.5" />
    <path d="M3.5 18.5c.8-2.6 2.8-4 4.5-4s3.7 1.4 4.5 4" />
    <path d="M11.5 18.5c.8-2.6 2.8-4 4.5-4s3.7 1.4 4.5 4" />
  </svg>
);

export const IconDoctors = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    {/* Clean stethoscope — reads clearly as “doctors” in the nav */}
    <path d="M8.5 3.5v6.2a3.5 3.5 0 0 0 7 0V3.5" />
    <path d="M8.5 3.5H6.8M15.5 3.5h1.7" />
    <path d="M15.5 9.7a4.8 4.8 0 1 1-4.8 4.8" />
    <circle cx="18.2" cy="16.8" r="2.2" />
  </svg>
);

export const IconWallet = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <path d="M19 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
    <path d="M16 12h5v3h-5a1.5 1.5 0 0 1 0-3Z" />
    <circle cx="18.5" cy="13.5" r="0.6" fill="currentColor" />
    <path d="M6 7V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V7" />
  </svg>
);

export const IconLock = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconSearchPatients = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16.5 16.5 21 21" />
  </svg>
);

export const IconSettings = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

export const IconHeart = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </svg>
);

export const IconSupport = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.5-2.2 2-2.2 3.4" />
    <path d="M12 16.8v.2" />
  </svg>
);

export const IconLogout = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
    <path d="M14 16.5 18.5 12 14 7.5" />
    <path d="M8.5 12h10" />
  </svg>
);

export const IconPay = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </svg>
);

export const IconBell = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...props}>
    <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const IconChat = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H11l-4 3.2V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z" />
  </svg>
);

export const IconCalendar = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="28" height="28" {...base} {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
  </svg>
);

export const IconStethoscope = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="28" height="28" {...base} {...props}>
    <path d="M6 4v6a4 4 0 0 0 8 0V4" />
    <path d="M6 4H4.5M14 4h1.5" />
    <path d="M14 10a4 4 0 1 0 4.5 4" />
    <circle cx="18.5" cy="16.5" r="2" />
  </svg>
);

export const IconWarning = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <path d="M12 3.8 21 19.5H3L12 3.8Z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.2v.2" />
  </svg>
);

export const IconSend = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <path d="M4 11.5 20 4 13.2 20l-2-6.5L4 11.5Z" />
    <path d="M11.2 13.5 20 4" />
  </svg>
);

export const IconClock = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8.5V12l2.8 1.8" />
  </svg>
);

export const IconArrowRight = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconUsers = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M2.5 19c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15.5 19c.5-2 1.8-3.2 3.5-3.8" />
  </svg>
);

export const IconReports = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
    <path d="M14.5 3.5V8H19" />
    <path d="M9 12h6M9 15.5h6M9 19h3.5" />
  </svg>
);

export const IconMaximize = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);

export const IconMinimize = (props: IconProps) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...props}>
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
  </svg>
);

export type NavIcon = (props: IconProps) => JSX.Element;
