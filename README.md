# Coffee Shop Admin — Frontend

A React + TypeScript admin dashboard for managing a coffee shop: users, products/categories,
materials/inventory, orders, shipping, and revenue/product reports. Built as the frontend half
of a student thesis (DATN) project; the backend is a separate Spring Boot repo (`coffee-shop-be`)
exposing a REST API plus a STOMP-over-SockJS websocket endpoint at `/ws`.

This project is intentionally written to be **maintainable by AI assistants** (Claude Code,
Copilot, etc.) on behalf of a non-frontend-developer owner. Code favors explicitness and small,
single-purpose files over cleverness.

## Tech stack & why

| Concern | Choice | Why |
|---|---|---|
| Build tool | Vite | Fast dev server, zero-config TS+React |
| UI kit | Ant Design (`antd`) + `@ant-design/icons` + `@ant-design/charts` | Batteries-included admin components (Table, Form, Modal) and charts, minimal custom CSS |
| Routing | `react-router-dom` v6 | Standard, with a `ProtectedRoute` wrapper for auth/role gating |
| Server state | `@tanstack/react-query` | Caching, background refetch, and cache invalidation triggered by websocket events |
| Client state | `zustand` (persisted) | Tiny store for the JWT + logged-in user, survives page refresh via localStorage |
| HTTP | `axios` | Single instance in `src/api/client.ts` with interceptors for auth header + 401 handling |
| Realtime | `@stomp/stompjs` + `sockjs-client` | Matches the backend's Spring STOMP/SockJS `/ws` endpoint |
| Dates | `dayjs` | antd's default date library, lightweight |

## Project layout

```
src/
  api/            one file per REST resource (auth, users, categories, products,
                  materials, orders, shipments, reports) + client.ts (axios instance)
  components/     shared/reusable UI pieces (currently empty — add as needed)
  layouts/        AppLayout.tsx: Sider + Header shell used by all authenticated pages
  pages/          one file per route/screen
  realtime/       RealtimeProvider.tsx: STOMP connection + notifications + cache invalidation
  routes/         ProtectedRoute.tsx: auth/role route guard
  store/          authStore.ts: zustand store for JWT + user
  types/          shared TypeScript interfaces mirroring the backend API contract
```

## Getting started

```bash
npm install
cp .env.example .env   # then edit .env if your backend runs somewhere other than localhost:8080
npm run dev
```

The app runs at http://localhost:5173 and expects the backend at the URLs in `.env`.

### Environment variables (build-time!)

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080/api` | Base URL for all REST calls (`src/api/client.ts`) |
| `VITE_WS_URL` | `http://localhost:8080/ws` | SockJS/STOMP endpoint for realtime updates |

**Important:** Vite inlines `import.meta.env.VITE_*` values into the JS bundle **at build time**,
not at container/server start time. That means:
- Changing `.env` requires restarting `npm run dev` (dev) or re-running `npm run build` (prod).
- When deploying (Docker or Render), these must be set as **build-time** variables/build-args —
  setting them as ordinary runtime environment variables on the server has no effect once the
  static bundle is built. See the Docker and Render sections below.

## Authentication flow

1. `LoginPage` posts `{ username, password }` to `POST /api/auth/login`.
2. On success the backend returns `{ token, user }` (JWT + user profile including `role`).
3. `useAuthStore.setAuth(token, user)` stores both in memory and persists them to
   `localStorage` under the `coffee-shop-auth` key.
4. `src/api/client.ts`'s axios request interceptor reads the token from the store and attaches
   `Authorization: Bearer <token>` to every outgoing request.
5. If any request comes back `401 Unauthorized`, the response interceptor calls
   `useAuthStore.logout()` and redirects to `/login`.
6. `ProtectedRoute` (in `src/routes/ProtectedRoute.tsx`) wraps all authenticated routes; it
   redirects unauthenticated users to `/login`, and (when given a `roles` prop) redirects users
   without the right role back to `/`. The `Users` page is wrapped with `roles={['ADMIN']}`.

## Realtime updates

`RealtimeProvider` (`src/realtime/RealtimeProvider.tsx`) wraps the whole app inside
`QueryClientProvider`. Once the user is authenticated it opens a STOMP connection over SockJS to
`VITE_WS_URL` and subscribes to:

- `/topic/orders` — new/updated order events. Shows an antd `notification.info` and invalidates
  the `['orders']` and `['reports']` react-query cache keys so open tables/dashboards refresh.
- `/topic/inventory-alerts` — low-stock material events. Shows an antd `notification.warning`
  and invalidates the `['materials']` cache key.

A small "Live/Offline" badge in the header (see `AppLayout.tsx`) reflects the connection state.
If your backend's topic names or payload shapes differ, this is the only file to change.

## Pages

| Route | Access | Description |
|---|---|---|
| `/login` | public | Username/password login |
| `/` | any authenticated user | Summary cards (today's revenue/orders/low-stock count), revenue trend chart, top-products chart |
| `/products` | any | Product CRUD, active toggle, per-product material "recipe" editor |
| `/categories` | any | Category CRUD |
| `/materials` | any | Material/inventory CRUD, stock-in (restock) action, transaction history |
| `/orders` | any | Order table with status filter, create-order flow, status transition buttons |
| `/shipping` | any | Shipment table, assign shipper (SHIPPER-role users), status updates |
| `/users` | **ADMIN only** | Staff/shipper account CRUD with role assignment |
| `/reports` | any | Revenue-by-date-range and top-products reports, CSV export |

## API contract assumptions

The full assumed contract lives as typed request/response interfaces in `src/types/index.ts`
and thin wrapper functions in `src/api/*.ts` (one file per resource, all built on the shared
`apiClient` axios instance in `src/api/client.ts`). If the real `coffee-shop-be` backend uses
different field names or paths, these are the only files that should need edits — page
components only import from `src/api/*`, never call axios directly.

Assumed endpoints: `/api/auth/login`, `/api/users`, `/api/categories`, `/api/products`,
`/api/products/{id}/materials`, `/api/materials`, `/api/materials/low-stock`,
`/api/materials/{id}/transactions`, `/api/orders`, `/api/orders/{id}/status`, `/api/shipments`,
`/api/reports/revenue`, `/api/reports/top-products`.

## Docker

```bash
docker build \
  --build-arg VITE_API_URL=https://your-backend.example.com/api \
  --build-arg VITE_WS_URL=https://your-backend.example.com/ws \
  -t coffee-shop-fe .

docker run -p 8080:80 coffee-shop-fe
```

The `Dockerfile` is a two-stage build: `node:20-alpine` builds the static Vite bundle, then
`nginx:1.27-alpine` serves it. `nginx.conf` adds `try_files ... /index.html` so client-side
routes (e.g. `/orders`) work on a hard refresh.

## CI/CD

- `.github/workflows/ci.yml` — on every push/PR to `main`: `npm ci`, `npm run lint`,
  `npm run build`. The workflow fails if the build fails.
- `.github/workflows/deploy.yml` — on push to `main`, POSTs to a Render deploy hook URL stored
  in the `RENDER_DEPLOY_HOOK_URL` GitHub secret. **This is optional** — see below.

### Deploying to Render (static site)

You have two options; pick one (don't do both):

**Option A — Render auto-deploy from GitHub (simplest, recommended)**
1. In Render, create a new **Static Site** and connect this GitHub repo.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Under "Environment", add build-time env vars: `VITE_API_URL`, `VITE_WS_URL` (pointing at your
   deployed backend). Render treats these as available during the build step, which is what
   Vite needs.
5. Under "Redirects/Rewrites", add a rewrite rule: source `/*` → destination `/index.html`,
   action "Rewrite" — this makes client-side routes work.
6. Every push to `main` triggers a new Render build automatically. In this case you can leave
   `.github/workflows/deploy.yml` in place but never set the `RENDER_DEPLOY_HOOK_URL` secret —
   the step is skipped when the secret is empty.

**Option B — GitHub Actions triggers a Render deploy hook**
1. In Render, create the Static Site as above but set it to **not** auto-deploy on push (or use
   a "deploy hook" trigger only).
2. Copy the site's Deploy Hook URL (Render dashboard → your service → Settings → Deploy Hook).
3. In GitHub, add it as a repository secret named `RENDER_DEPLOY_HOOK_URL`.
4. Now every push to `main` runs CI, and `deploy.yml` calls the hook to tell Render to build
   and publish. The `VITE_API_URL`/`VITE_WS_URL` build-time vars still need to be configured
   in the Render service itself (Render bakes them in during its own `npm run build`, not in
   the GitHub Actions runner).

## Known simplifications / TODOs

- No automated tests are set up yet (would suggest Vitest + React Testing Library once the
  backend API is stable enough to mock).
- Table pagination relies on antd's client-side default; if the backend returns paged
  responses (`Paged<T>` type is defined in `src/types/index.ts` for this) the `src/api/*.ts`
  functions and page components would need small changes to pass `page`/`size` params and read
  `content`/`totalElements` instead of a plain array.
- `ProductRecipeModal` (in `ProductsPage.tsx`) assumes `PUT /api/products/{id}/materials`
  accepts `{ materials: [{ materialId, quantity }] }` and replaces the whole recipe; adjust if
  the backend instead wants individual add/remove calls.
- CSV export in the Reports page is a simple client-side blob download (no backend endpoint
  needed) — good enough for a thesis demo, not a general-purpose CSV writer.
- No dark mode / theming beyond antd's default token overrides in `App.tsx`.
