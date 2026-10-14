type CloseBookingChoiceModalProps = {
  open: boolean;
  doctorName: string;
  onClose: () => void;
  onMoveOp: () => void;
  onCloseOp: () => void;
};

export const CloseBookingChoiceModal = ({
  open,
  doctorName,
  onClose,
  onMoveOp,
  onCloseOp,
}: CloseBookingChoiceModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#061526]/45 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[440px] rounded-2xl border border-[#E5EAF0] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EEF2F6] px-6 py-4">
          <div>
            <h2 className="text-[18px] font-bold text-[#1A1F36]">Close booking</h2>
            <p className="mt-0.5 text-[13px] text-[#64748B]">{doctorName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9AA3B2] transition hover:bg-[#F3F5F8] hover:text-[#4B5563]"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-[14px] text-[#4B5563]">
            Stop new bookings for today. Choose what to do with pending OPs still in the queue.
          </p>

          <button
            type="button"
            onClick={onMoveOp}
            className="flex w-full flex-col items-start gap-1 rounded-xl border-2 border-[#BFDBFE] bg-[#F5F9FF] px-4 py-4 text-left transition hover:border-[#0B2A4A]"
          >
            <span className="text-[15px] font-bold text-[#0B2A4A]">Move OP</span>
            <span className="text-[13px] text-[#475569]">
              Send a pending OP range to another doctor, then close this booking.
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseOp}
            className="flex w-full flex-col items-start gap-1 rounded-xl border-2 border-[#FECACA] bg-[#FFF8F8] px-4 py-4 text-left transition hover:border-[#DC2626]"
          >
            <span className="text-[15px] font-bold text-[#B91C1C]">Close OP</span>
            <span className="text-[13px] text-[#475569]">
              Close booking only. Existing tokens stay on this doctor&apos;s queue.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
