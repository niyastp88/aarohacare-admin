export const APP = {
  NAME: 'Aarohcare',
  DEFAULT_API_URL: 'http://localhost:4000',
  API_TIMEOUT_MS: 15_000,
  SESSION_EXPIRED_EVENT: 'aarohcare:session-expired',
  /** Default map centre — Kochi, Kerala (adjust as needed) */
  DEFAULT_MAP_CENTER: { lat: 9.9312, lng: 76.2673 },
  MAP_COUNTRY: 'in',
} as const;

export const QUERY_DEFAULTS = {
  STALE_TIME_MS: 30_000,
  RETRY: 1,
} as const;
