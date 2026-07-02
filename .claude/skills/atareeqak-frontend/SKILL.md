---
name: atareeqak-frontend
description: Architecture guide and conventions for the Atareeqak admin dashboard frontend (React 19 + TypeScript + Vite in src/). Use when adding or modifying features, pages, components, hooks, API calls, routes, translations, or styling anywhere under src/.
---

# Atareeqak Frontend — Architecture & Conventions

Atareeqak is an admin dashboard for a ride-sharing platform (drivers, passengers, trips, wallet, complaints). The backend is a Laravel API (lives in `4th_year_projects_refractored/`); this skill covers the frontend in `src/`.

## Tech stack

- React 19 + TypeScript (strict), Vite 8
- react-router-dom v7 (`BrowserRouter`, nested routes)
- axios (single shared instance, JWT auth with refresh)
- Tailwind CSS 3 with a custom Material 3 color palette
- i18next + react-i18next (Arabic default, English fallback), RTL-aware UI
- No state library — React Context + custom hooks per feature
- Scripts: `npm run dev`, `npm run build` (runs `tsc -b` first — code must typecheck), `npm run lint`

## Directory layout

```
src/
  app/
    context/AuthContext.tsx   # AuthProvider + useAuth() hook
    i18n.ts                   # i18next setup (ar default, localStorage detection)
  components/layout/          # MainLayout (protected shell), AuthLayout (login/register shell)
  features/<feature>/         # Feature-based modules — THE core pattern
    api/<feature>Api.ts       # API call object + response interfaces
    hooks/use<Feature>.ts     # Data fetching + state logic
    components/               # Feature-specific components
    pages/                    # Route-level page components
  locales/{ar,en}/translation.json
  routes/
    index.tsx                 # All route definitions (AppRoutes)
    ProtectedRoute.tsx        # Auth guard
  services/
    api.ts                    # Shared axios instance + interceptors
    endpoints.ts              # ENDPOINTS constant — ALL API paths live here
  types/index.ts              # Shared types (User, etc.)
```

Existing features: `auth`, `dashboard`, `drivers`, `home`, `reports`, `settings`, `shared`, `staff`, `support`, `trips`, `users`, `verification`, `wallet`.

## Core patterns — follow these when adding code

### 1. API layer (three tiers, never skip one)

1. **Endpoint** — add the path to `src/services/endpoints.ts` in the `ENDPOINTS` object. Static paths are strings; parameterized paths are arrow functions: `PROFILE: (id: string | number) => \`/admin/drivers/${id}/profile\``.
2. **Feature API** — `src/features/<feature>/api/<feature>Api.ts` exports a plain object of async functions (e.g. `tripsApi`). Each function imports the shared `api` from `services/api` and paths from `ENDPOINTS`. Define response shapes as exported interfaces in the same file (e.g. `TripResponse`). Laravel responses may be paginated (`{ data, current_page, last_page, total }`) or wrapped — unwrap with `response.data.data || response.data` where applicable.
3. **Hook** — `src/features/<feature>/hooks/use<Feature>.ts` exports `use<Feature>(): Use<Feature>Return`. It owns `useState` for data/`isLoading`/`error`, fetches with `useCallback` + `useEffect`, maps raw API responses into UI-friendly interfaces defined in the hook file, and returns a typed object. See `src/features/trips/hooks/useTrips.ts` as the reference implementation.

Pages/components never call `api` or axios directly — they consume hooks.

### 2. Auth

- Tokens (`access_token`, `refresh_token`) and `user` are stored in `localStorage`.
- `src/services/api.ts` interceptors attach the Bearer token and auto-refresh on 401 (via `/admin/refresh`), redirecting to `/login` on failure. Do not add per-request auth headers.
- `useAuth()` from `src/app/context/AuthContext.tsx` gives `user`, `isAuthenticated`, `isLoading`, `login()`, `logout()`.
- New protected pages go inside the `<ProtectedRoute>` → `<MainLayout>` block in `src/routes/index.tsx`.

### 3. Routing

All routes are declared in `src/routes/index.tsx`. Public routes render under `AuthLayout`; protected routes under `ProtectedRoute` + `MainLayout`. Detail pages use params like `/drivers/:driverId`, `/passengers/:userId`. Note: the passengers UI routes map to the `users` feature.

### 4. i18n (mandatory for all UI text)

- Never hardcode user-facing strings. Use `const { t } = useTranslation()` and add keys to **both** `src/locales/ar/translation.json` and `src/locales/en/translation.json`.
- Arabic is the default language (`fallbackLng: 'ar'`) and the app is RTL-first — use Tailwind logical/RTL-safe spacing where direction matters.
- Fallback display strings in data mapping are Arabic (e.g. `'غير معروف'` for unknown driver).

### 5. Styling

- Tailwind only, no CSS modules or styled-components. Global styles in `src/index.css`.
- Use the custom Material 3 palette tokens from `tailwind.config.js`: `primary` (#000666 dark blue), `secondary` (#006a6a teal), `surface`, `on-surface`, `surface-container*`, `outline`, `error`, plus `-container` / `on-` variants. Do not introduce raw hex values.
- Fonts: `font-headline` / `font-body` / `font-display` (Cairo-first stacks). Shadow: `shadow-ambient`.

### 6. Components & naming

- Functional components typed as `React.FC` or plain typed functions; files in PascalCase (`TripDetailsCard.tsx`), hooks in camelCase (`useTrips.ts`).
- Cross-feature reusables go in `src/features/shared/` (e.g. `ActionBanner`, `useMockAction`); app-wide layout in `src/components/layout/`.
- Prefer `useMemo`/`useCallback` for derived data and handlers passed down, matching existing hooks.

## Adding a new feature — checklist

1. Add endpoint paths to `src/services/endpoints.ts`.
2. Create `src/features/<name>/api/<name>Api.ts` (API object + response interfaces).
3. Create `src/features/<name>/hooks/use<Name>.ts` (state, fetch, mapping, typed return).
4. Create `pages/` (and `components/` if needed) consuming the hook.
5. Register the route in `src/routes/index.tsx` under the protected block.
6. Add translation keys to both `ar` and `en` translation files.
7. Verify with `npm run build` (typecheck) and `npm run lint`.

## API roles / prefixes

The backend exposes three route groups (see `ENDPOINTS`): `/admin/*` (admin operations — dashboard, drivers, users, wallet, reports), `/staff/*` (support-staff operations — reviews, complaints, verifications, trip/booking cancellation), and `/employees` (employee management). Choose the prefix matching the acting role; note some admin UI actions call staff endpoints (e.g. trip cancellation uses `ENDPOINTS.STAFF.CANCEL_TRIP`).

Base URL comes from `VITE_API_BASE_URL` (defaults to `http://localhost/4th_year_project/public/api`).
