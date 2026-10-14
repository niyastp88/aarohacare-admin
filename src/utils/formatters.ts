export const normalizePhone = (phone: string): string => phone.replace(/\D/g, '');

/** Last 10 digits — ignores +91 / leading 0 so login works either way. */
export const toLocalPhone = (phone: string): string => {
  const digits = normalizePhone(phone);
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export const isValidPhone = (phone: string): boolean => toLocalPhone(phone).length >= 10;

export const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const toTitleCase = (value: string): string =>
  value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
