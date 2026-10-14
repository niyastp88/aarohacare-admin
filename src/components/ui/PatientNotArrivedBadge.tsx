/**
 * PatientNotArrivedBadge
 * Displayed directly under an "Auto Cancelled" appointment status or in refund areas
 * when the patient was never marked as arrived.
 * Styled as clean, high-visibility red plain text with no background badge, border, or decorative icon.
 */
export const PatientNotArrivedBadge = ({
  className = '',
}: {
  className?: string;
}) => (
  <span
    className={[
      'inline-block text-[11px] font-bold text-[#DC2626] whitespace-nowrap tracking-tight leading-none',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    Patient Not Arrived
  </span>
);
