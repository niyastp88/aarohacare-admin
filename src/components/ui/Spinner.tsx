export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex flex-col items-center gap-2.5 py-10" role="status" aria-live="polite">
    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary-soft border-t-primary" />
    <span className="text-sm text-muted">{label}</span>
  </div>
);
