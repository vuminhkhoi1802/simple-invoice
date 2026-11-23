# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Monorepo with two independent npm projects and **no root `package.json`**: `backend/` (NestJS 11, TypeORM, PostgreSQL 16) and `frontend/` (React 19, Vite, TanStack Query). Run npm commands from inside the relevant directory. `README.md` holds the API table, DB schema and a numbered "Design decisions & assumptions" list; those decisions encode the original spec's business rules, so read them before changing behaviour.

## Commands

Full stack: `docker compose up --build` → web http://localhost:8080, API :3000, Swagger :3000/api/docs. Reset the DB with `docker compose down -v`. Seeded login: `admin@simpleinvoice.dev` / `Password123!`.

Backend (`cd backend`):

```bash
npm run start:dev                  # needs a .env and a running Postgres (see below)
npm run lint && npm run typecheck && npm run build
npm test                           # unit specs, src/**/*.spec.ts
npx jest src/invoices/domain/invoice-calculator.spec.ts   # one file
npx jest -t "part of a test name"                         # by name
npm run test:e2e                   # real Postgres; add `-- -t "name"` to filter
npm run seed                       # applies migrations, then idempotent seed
npm run migration:run
npm run format                     # prettier (singleQuote, width 100); not enforced by lint/CI
```

Frontend (`cd frontend`):

```bash
npm run dev                        # :5173, proxies /api -> :3000
npm run lint && npm run typecheck
npm test                           # vitest run
npx vitest run src/lib/format.test.ts     # one file
npx vitest run -t "part of a test name"   # by name
npm run build                      # tsc -b && vite build
```

CI (`.github/workflows/ci.yml`) runs backend lint → typecheck → unit → e2e → build and frontend lint → test → build, then boots the compose stack and smoke-tests the nginx security headers, login and listing through nginx.

### Local setup gotchas

- `backend/.env`: copy `.env.example`. `JWT_SECRET` (≥ 32 chars) is mandatory and `SEED_USER_PASSWORD` must be set for the seed. Even `npm run seed` and `migration:run` fail without a valid `JWT_SECRET`, because the CLI scripts reuse the app's `validateEnv`.
- Postgres: `docker compose up -d db`.
- The e2e suite needs the database `simple_invoice_test` to **already exist**; nothing in the repo creates it (CI gets it via `POSTGRES_DB`): `docker compose exec db createdb -U postgres simple_invoice_test`. The spec then drops and re-migrates that schema in `beforeAll`. `test/setup-e2e.ts` hard-sets `DB_NAME` (only `E2E_DB_NAME` redirects it), so a stray `DB_NAME` can't point it at your dev DB. Keep `--runInBand`: specs share one database.

## Architecture

**Request path.** Browser → Vite proxy (dev) or nginx `:8080` (Docker) → `/api/*` with the prefix **stripped** → Nest on `:3000`. The API has no global prefix (`/auth/*`, `/invoices`, `/health`); only Swagger is mounted at `/api/docs`. Same-origin serving is deliberate: the JWT travels in an httpOnly `SameSite=Strict` cookie and CORS is off unless `CORS_ORIGIN` is set. Don't add `setGlobalPrefix` or point the SPA at a cross-origin API without revisiting that.

**Security headers.** `frontend/nginx.conf.template` sets them at server level, but nginx drops every inherited `add_header` in a `location` that declares its own, so `/assets/` and `/` repeat the three headers next to their `Cache-Control`, and any location you add with its own `add_header` must do the same. `/api/` declares none and inherits them, while `proxy_hide_header` strips Helmet's copies (the backend sends the same headers with different values). The CI smoke test requires exactly one copy of each on `/`, one built asset and `/api/health`.

### Backend (`backend/src`)

- `app.setup.ts` → `configureApp()` is the one place that wires helmet, cookies, CORS, the global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`), the exception filter and Swagger. Both `main.ts` and the e2e tests call it, so tests exercise the production pipeline; add global setup there, not in `main.ts`.
- **Secure by default:** `JwtAuthGuard` is the global `APP_GUARD` (`auth/auth.module.ts`), so every new route requires auth unless marked `@Public()` (currently login, logout, health). Only login also uses `ThrottlerGuard`.
- **Config:** `config/env.validation.ts` is the schema for every env var and fails fast at boot. A new variable needs a field there, plus `.env.example` and, if the container needs it, `docker-compose.yml`.
- **The schema is owned by hand-written raw-SQL migrations** (`synchronize: false`). Entities are not generated from or checked against them, so a column change means a new migration **and** a manual entity edit. Migrations are registered by explicit import in `database/typeorm-options.ts` (no glob): add each new migration class to that `migrations` array or it will never run. The Nest app (`migrationsRun: true`), `run-migrations.ts` and the seeder all share that options builder, and the container runs the seed (which migrates first) before `main.js` on every start.
- NUMERIC columns must use `decimalTransformer` (node-postgres returns strings), as the money columns in `invoice.entity.ts` do.
- **Overdue is derived, never stored** (the `invoice_status` enum has no such value). Two code paths must stay in lockstep: `deriveInvoiceStatus()` (`invoices/domain/invoice-status.ts`, applied in `invoice.mapper.ts` on read) and `applyStatusFilter()` (`invoices.service.ts`, the same predicate in SQL for `?status=`). Both take "today" from `ClockService` (honours `APP_TIMEZONE`); never use `new Date()` for business dates. Dates are plain `YYYY-MM-DD` strings compared lexicographically (helpers in `common/utils/date.ts`).
- **Money:** `calculateInvoiceTotals()` (`invoices/domain/invoice-calculator.ts`) is the only place totals are computed (decimal.js, round half-up at each step). DB CHECK constraints back it up, and the client never computes totals. `discount` is an absolute amount, `taxRate` a percentage.
- Duplicate invoice numbers are caught by the DB unique index on `lower(invoice_number)`; the service maps SQLSTATE `23505` to 409 instead of pre-checking. Create accepts exactly one line item (a validator limit, not a schema one).

### Frontend (`frontend/src`)

- `api/client.ts` holds the single axios instance (`withCredentials`; base URL `VITE_API_BASE_URL`, default `/api`, baked in at build time) and `toApiError()`, which normalises every failure to `ApiError { status, messages[] }`. A 401 from any call except `/auth/login` fires `onUnauthorized`, which `AuthProvider` uses to drop the session and clear the query cache; `ProtectedRoute` then redirects to `/login`. The SPA never sees the JWT; session state comes from `/auth/me` on boot.
- Invoice-list state lives in the URL. Read and write it through `hooks/useInvoiceListParams` (invalid values fall back to defaults; any change other than `page` resets to page 1), not component state.
- **Two hand-maintained mirrors of backend contracts, no codegen:** `api/types.ts` (response DTOs) and `pages/createInvoiceSchema.ts` (a Zod schema duplicating the rules in `create-invoice.dto.ts`, including the invoice-number regex and length limits). Change both sides together. The form is flat (`customerName`, `itemName`, …) and `toCreatePayload()` maps it to the nested API payload.
- **Dark is the only theme (no toggle).** Every colour is a custom property in `:root` at the top of `index.css`; add a token rather than a literal. `theme.test.ts` reads that file as raw text and fails on a WCAG AA contrast miss, an undeclared `var(--x)`, or a hex literal outside `:root`. It only works because `vite.config.ts` sets `test.css.include` for `*.css?raw` (plain `css: false` blanks the import).

### Testing conventions

- Backend unit specs stub the TypeORM `Repository` and `QueryBuilder` with Jest mocks, so they **don't verify SQL**. The status filter, search, unique index and CHECK constraints are only covered by `backend/test/invoices.e2e-spec.ts`, which boots the real `AppModule` against Postgres, migrates, seeds and logs in.
- Frontend tests (Vitest, jsdom, globals on) mock at the module boundary (`vi.mock('../api/auth')`, `vi.mock('../api/invoices')`); there is no MSW and no HTTP. `renderWithProviders` mounts `AuthProvider`, which calls `/auth/me` on mount, so every page test must mock `../api/auth` (jsdom's origin is `localhost:3000`, so an unmocked call reaches whatever listens there) and set `me` in `beforeEach` because `restoreMocks` is on. Use `renderWithProviders`, the `summary()`/`detail()` fixtures and `LocationProbe` from `src/test/utils.tsx`.
