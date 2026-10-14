/** Prefer real health card ID; fall back to last digits of Mongo id. */
export const patientDisplayId = (
  id: string,
  options?: { healthCardId?: string; prefix?: string },
) => {
  const card = options?.healthCardId?.trim();
  if (card) return card;
  const prefix = options?.prefix ?? 'PX';
  const tail = id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase();
  return `${prefix}-${tail || '00000'}`;
};

export const formatGender = (gender?: string) => {
  const g = (gender || '').trim().toLowerCase();
  if (g.startsWith('f')) return 'Female';
  if (g.startsWith('m')) return 'Male';
  if (g.startsWith('o')) return 'Other';
  return '';
};

export const formatConsultDate = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatConsultDateTime = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
