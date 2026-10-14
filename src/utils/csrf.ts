/** Cookie name must match backend AUTH_COOKIE.CSRF */
const CSRF_COOKIE = 'aarohcare_csrf';

export const CSRF_HEADER = 'X-CSRF-Token';

/** In-memory fallback when the CSRF cookie is not readable (cross-site). */
let memoryCsrfToken: string | null = null;

export const rememberCsrfToken = (token?: string | null) => {
  if (token) memoryCsrfToken = token;
};

export const clearRememberedCsrfToken = () => {
  memoryCsrfToken = null;
};

const readCsrfCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) || null;
};

export const readCsrfToken = (): string | null => memoryCsrfToken || readCsrfCookie();
