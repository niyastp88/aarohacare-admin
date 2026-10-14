import type { ReactNode } from 'react';

type AuthShellProps = {
  children: ReactNode;
  /** Wider form column for denser signup forms */
  wide?: boolean;
};

export const AuthShell = ({ children, wide = false }: AuthShellProps) => (
  <div className="auth-shell min-h-screen bg-white lg:grid lg:grid-cols-[minmax(440px,42%)_minmax(0,58%)]">
    <div
      className={[
        'relative z-10 flex min-h-screen flex-col justify-center bg-white px-6 py-10 sm:px-10 lg:px-12 xl:px-16',
        wide ? 'max-w-none' : '',
      ].join(' ')}
    >
      <div className={['mx-auto w-full', wide ? 'max-w-[560px]' : 'max-w-[420px]'].join(' ')}>
        {children}
      </div>
    </div>

    <aside
      className="relative hidden bg-[#0e2a45] lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-hidden"
      aria-hidden
    >
      <img
        src="/auth-hero.jpg"
        alt=""
        className={[
          'absolute inset-0 h-full w-full object-cover',
          // Keep the clinician (right/center of the photo) in frame on tall sidebars.
          wide ? 'object-[72%_32%]' : 'object-[68%_28%]',
        ].join(' ')}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061526]/50 via-[#061526]/10 to-[#061526]/20" />
    </aside>
  </div>
);

export const AuthBrandMark = ({ subtitle }: { subtitle?: string }) => (
  <div className="mb-8">
    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b2a4a] text-lg font-bold tracking-tight text-white shadow-sm">
      A
    </div>
    <h1 className="text-[30px] font-bold leading-tight tracking-tight text-[#0b2a4a]">
      Aarohcare Admin
    </h1>
    {subtitle ? (
      <p className="mt-2 text-[15px] leading-relaxed text-[#6b7280]">{subtitle}</p>
    ) : null}
  </div>
);
