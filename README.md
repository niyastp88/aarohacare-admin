# AarohaCare Web

Admin portal — React + TypeScript + Vite + Tailwind + TanStack Query.

## Structure
```
src/
  api/
    client.ts              Axios instance + interceptors
    services/<feature>/    HTTP services per domain
  features/<feature>/      Route screens + feature-only components
    pages/                 Screen components
    components/            Modals / pieces used only in that feature
    index.ts               Public exports
  hooks/                   TanStack Query hooks (useDoctors, useLogin, …)
  store/                   Redux (auth UI session only; no JWTs)
    slices/                authSlice — user / bootstrap / sessionExpired
    selectors/             memo-friendly selectors
    StoreProvider.tsx      Provider + cookie session bootstrap
  components/ui/           Shared UI (Button, Input, Toast, …)
  components/layout/       Portal shell + sidebar
  components/auth/         Auth shell / icons
  components/maps/         Maps / place picker
  components/media/        Image crop, etc.
  providers/               QueryClient + Auth
  routes/                  AppRouter + guards
  utils/                   formatters, date helpers
  styles/index.css         Tailwind + brand tokens only
```

## Setup
```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000
