# AarohaCare Web — agent notes

- React 18 + TypeScript + Vite. Not Next.js.
- Styling: Tailwind CSS v4 (`@tailwindcss/vite`). Brand tokens live in `src/styles/index.css` via `@theme`. Prefer Tailwind utilities; keep that CSS file essential-only.
- Features: route screens live in `src/features/<feature>/` (`pages/`, feature-only `components/`, `index.ts` barrel). Import screens from `@/features/<feature>`.
- Shared UI: `src/components/ui`, `layout`, `auth`, `maps`, `media`. Do not put feature-specific modals here.
- API: all HTTP lives in `src/api/services/<feature>/`. Shared constants live in `src/constants/`.
- Types: request/response DTOs live in `src/types/dto/` (mirrored from backend `src/dto/`). Import from `@/types` or `@/types/dto`.
- Auth (web): httpOnly cookies (`Path=/api`) + `withCredentials`. CSRF double-submit (`aarohcare_csrf` + `X-CSRF-Token`). Redux holds user only — never JWTs / localStorage tokens. Web auth JSON returns `{ user }` only; mobile (`X-Client: mobile`) still receives `token` + `refreshToken`. CORS allowlist via `CLIENT_ORIGINS`.
- Store: `src/store/` — `store.ts`, `slices/`, `selectors/`, `StoreProvider.tsx`. Add a new slice only when state is shared across features (not for server data — use TanStack Query).
- Data: TanStack Query hooks in `src/hooks/` call services. Feature pages only render hook data.
- Path alias: `@/` → `src/`.
- Logging: use `logger` / `logger.child('scope')` from `@/utils/logger` — do not call `console.*` in app code.
- Lint: `npm run lint` (ESLint flat config in `eslint.config.mjs`).
