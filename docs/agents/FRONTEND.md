# Frontend (`frontend/`)

Next.js App Router application. Deployed as static export or SSR depending on build config; hosted on S3 + CloudFront via GitHub Actions (see [INFRA.md](./INFRA.md)).

## Layout

- `frontend/app/` — App Router pages and API routes
- `frontend/app/components/` — UI components (features, visualizations, layout, modals)
- `frontend/app/lib/` — services, hooks, server helpers, config
- `frontend/app/api/` — Next.js route handlers that proxy or wrap backend calls

## Design system

- [`frontend/DESIGN.md`](../../frontend/DESIGN.md) — target colours, type scale, radii, spacing, component recipes and content rules (DESIGN.md format: YAML tokens + prose). Read it before adding or restyling UI.
- Tokens are Tailwind utilities from `@theme` in `app/globals.css` (`bg-surface-raised`, `text-body-md`, `z-(--z-modal)`); use them in new code. Older UI is migrated area by area: [`specs/design-system/`](../../specs/design-system/README.md).
- Shared components (`components/shared/`): `Button`/`ButtonLink`/`IconButton`, `Tabs`/`SegmentedControl`, `Chip`, `Badge`, `TextInput`/`SearchInput`/`Select`/`Field`, `Pager`, `Card`/`CardHeader`/`Panel`/`Heading`, `Loading`/`Empty`/`ErrorState`, `ExpandableText`, `Legend`, `Dialog`/`SidePane`. Every one is shown in every state at `/dev/ui` (development only).
- `npm run lint` runs `scripts/check-design-tokens.mjs` first: it fails if off-system class counts rise above `design-baseline.json`. After a migration lowers them, run it with `--update`.

## Main experience

- **Landing page (`/`):** `app/page.tsx` + `components/landing/` — static intro with animated replicas of the dashboard cards (Framer Motion via the `motion` package, fictional sample data in `components/landing/sampleData.ts`); spec in `specs/landing-page/`
- **Explorer / dashboard (`/app`):** `app/app/page.tsx` + `components/ParliamentExplorerClient.tsx`. Old root links are redirected in `next.config.ts` (`/?person_id`, `/?open=donate`, `/?code&state` Cognito callback, `/?tour=1` starts the guided tour)
- **Dashboard loading screen:** `app/app/loading.tsx` (static backdrop + start signal) and `app/app/layout.tsx` → `components/loading/LoadingOverlay.tsx` (staged progress, tip/fact/quiz cards in `components/loading/content/`, state in `loadingStore.ts`; `ParliamentExplorerClient` renders `DashboardReadySignal`). Landing `/app` links wrap their label in `components/landing/LinkPending.tsx`. Spec in `specs/dashboard-loading/`
- **Static pages:** `about/`, `privacy/`, `terms/`, `payment-success/`, `payment-cancel/`; `app/sitemap.ts` lists the public routes
- **Detail pane (`components/features/DetailPane.tsx`):** four sliding tabs 発言 / やり取り / 選挙履歴 / 立場 (`PANEL_ORDER`). 立場 is `PersonStancePanel.tsx` (helpers in `lib/stances.ts`): AI stance summary per topic, three runs, percentile bars per sub-topic from the loaded ideology data, 「根拠が少ない」 under 10 opinions, 「元になった発言を見る」 marks the source speeches in 発言. Scatter-plot clicks open the pane on 立場 at the plot's topic; every other entry opens on 発言. The guided tour drives tabs through `setDetailPanel` (`tutorial/tutorialSteps.ts`). Vercel Analytics events: `DetailPanelView{panel}` on every tab change, `StanceProvenanceClick{topic}`.
- **Visualizations:** ideological scatter, Japan map, seat charts, relevance/productivity bars — under `components/visualizations/`

## Data fetching

- Client services: `app/lib/services/` (`dataService.ts`, `speechesService.ts`, `ideologyService.ts`, `electionHistoryService.ts`, `paymentService.ts`)
- Server-side fetch helpers: `app/lib/server/dataFetcher.ts`
- API config: `app/lib/config/api.ts`
- Some routes use Next.js API handlers under `app/api/` (speeches, ideology/person, electionHistory, donors, payment) rather than calling the FastAPI backend directly from the browser

## Auth & admin

- Server auth helpers: `app/lib/server/auth.ts`, `app/actions/auth.ts`
- On-demand revalidation: `app/actions/revalidate.ts`, `components/admin/RevalidateButton.tsx`
- See `app/lib/server/README_AUTH.md` for auth setup details

## Party / config constants

- `app/lib/config/parties.ts` — party names and colors
- `app/data/available.json` — cached availability config

## API contract

See [CONTRACTS.md](./CONTRACTS.md) for endpoint shapes shared with the backend.
