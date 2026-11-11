# Frontend (`frontend/`)

Next.js App Router application. Deployed as static export or SSR depending on build config; hosted on S3 + CloudFront via GitHub Actions (see [INFRA.md](./INFRA.md)).

## Layout

- `frontend/app/` — App Router pages and API routes
- `frontend/app/components/` — UI components (features, visualizations, layout, modals)
- `frontend/app/lib/` — services, hooks, server helpers, config
- `frontend/app/api/` — Next.js route handlers that proxy or wrap backend calls

## Main experience

- **Landing page (`/`):** `app/page.tsx` + `components/landing/` — static intro with animated replicas of the dashboard cards (Framer Motion via the `motion` package, fictional sample data in `components/landing/sampleData.ts`); spec in `specs/landing-page/`
- **Explorer / dashboard (`/app`):** `app/app/page.tsx` + `components/ParliamentExplorerClient.tsx`. Old root links are redirected in `next.config.ts` (`/?person_id`, `/?open=donate`, `/?code&state` Cognito callback, `/?tour=1` starts the guided tour)
- **Static pages:** `about/`, `privacy/`, `terms/`, `payment-success/`, `payment-cancel/`; `app/sitemap.ts` lists the public routes
- **Visualizations:** ideological scatter, Japan map, seat charts, relevance/productivity bars — under `components/visualizations/`

## Data fetching

- Client services: `app/lib/services/` (`dataService.ts`, `speechesService.ts`, `electionHistoryService.ts`, `paymentService.ts`)
- Server-side fetch helpers: `app/lib/server/dataFetcher.ts`
- API config: `app/lib/config/api.ts`
- Some routes use Next.js API handlers under `app/api/` (speeches, electionHistory, donors, payment) rather than calling the FastAPI backend directly from the browser

## Auth & admin

- Server auth helpers: `app/lib/server/auth.ts`, `app/actions/auth.ts`
- On-demand revalidation: `app/actions/revalidate.ts`, `components/admin/RevalidateButton.tsx`
- See `app/lib/server/README_AUTH.md` for auth setup details

## Party / config constants

- `app/lib/config/parties.ts` — party names and colors
- `app/data/available.json` — cached availability config

## API contract

See [CONTRACTS.md](./CONTRACTS.md) for endpoint shapes shared with the backend.
