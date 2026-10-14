import { IconMaximize, IconMinimize } from './icons';

type FullScreenButtonProps = {
  isFullScreen: boolean;
  onToggle: () => void;
  className?: string;
};

export const FullScreenButton = ({
  isFullScreen,
  onToggle,
  className,
}: FullScreenButtonProps) => {
  return (
    <div className="relative group inline-flex items-center">
      <button
        type="button"
        onClick={onToggle}
        title="Full Screen"
        aria-label="Full Screen"
        data-testid="full-screen-button"
        className={
          className ||
          'relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5EAF0] bg-white text-[#1A1F36] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F8FAFC] focus:outline-none'
        }
      >
        {isFullScreen ? (
          <IconMinimize className="h-5 w-5 text-[#1A1F36]" />
        ) : (
          <IconMaximize className="h-5 w-5 text-[#1A1F36]" />
        )}
      </button>

      {/* Hover tooltip displaying "Full Screen" */}
      <div
        role="tooltip"
        className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-[#1A1F36] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      >
        Full Screen
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#1A1F36]" />
      </div>
    </div>
  );
};
