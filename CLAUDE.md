# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Naavn DDBMS — an enterprise dashboard frontend for a distributed database/command system (React + TypeScript + Redux Toolkit + Tailwind CSS v4), shipped as a desktop app via Tauri (primary) and Electron (legacy/alternate packaging).

The API backend (Laravel 12) lives in a separate repo at `/Users/ram/Herd/avn-backend`. It is not part of this repo — consult it directly for endpoint routes, request/response shapes, and Eloquent model definitions when wiring up a new `features/*/api.ts`. It uses Laravel Sanctum for token auth, Laravel Reverb for websocket broadcasting (the frontend's realtime layer talks to this), and Scramble for API docs.

## Commands

```bash
npm run dev              # Vite dev server (http://localhost:5173)
npm run build             # tsc -b && vite build
npm run lint               # eslint .
npm run preview             # preview a production build

# Tests (vitest + jsdom + @testing-library, no npm script defined)
npx vitest                       # watch mode
npx vitest run                    # run once, all tests
npx vitest run src/test/authSlice.test.ts   # run a single test file
npx vitest run -t "test name"      # run tests matching a name

# Desktop — Tauri (primary target)
npm run tauri dev
npm run tauri build                                      # builds for the host arch (e.g. aarch64-apple-darwin on Apple Silicon)
npm run tauri:build:win64                                  # cross-compile check only (--target x86_64-pc-windows-gnu --no-bundle); does NOT produce a distributable installer
# Real Windows/Linux/multi-arch installers are built by .github/workflows/release.yml on native runners, triggered by pushing a `v*` tag.

# Desktop — Electron (legacy/alternate packaging)
npm run electron-dev
npm run electron-build
npm run electron-build:win
npm run electron-build:msi
```

Env vars (see `.env.example`): `VITE_API_BASE_URL`, `VITE_REVERB_APP_KEY`, `VITE_REVERB_HOST`, `VITE_REVERB_PORT`, `VITE_REVERB_SCHEME`.

## Architecture

**Feature-based structure**: `src/app/` (store, router, layout shells), `src/features/<name>/` (one folder per domain: auth, dashboard, personnel, inventory, stock-issues, finance, operations, assets, accommodation, generators, emergencies, notifications, security, users, maintenance, safety, approvals, documents, memos, reports, messages, calls, units, flight-programme), `src/shared/` (cross-feature UI, hooks, utils, realtime, api helpers), `src/context/` (React context providers, e.g. theme).

**Data layer — RTK Query per feature, manually wired**: each feature typically has its own `api.ts` defining an RTK Query `createApi` slice built on the shared `axiosBaseQuery` (`src/shared/api/baseQuery.ts`), which wraps axios, injects the `Authorization: Bearer <token>` header from the auth slice, and auto-dispatches `logout()` + a toast on a 401 "Unauthenticated." response. There is no `injectEndpoints`/dynamic registration — every feature's `api.reducerPath`/`api.middleware` must be added by hand to `src/app/store/index.ts`, so adding a new feature API means touching that file too.

**Auth**: `src/features/auth/authSlice.ts` holds `token`/`user`/`isAuthenticated`, persisted to `localStorage` under `AUTH_STORAGE_KEY` and rehydrated when the store is created (see `getPersistedAuthState` in `src/app/store/index.ts`). Route protection is two-layered: `RequireAuth` (redirects to `/auth/login` if unauthenticated) and `RequireRole` (gates a route behind one or more Spatie permission strings checked against `user.permissions`), both applied per-route in `src/app/router/routes.tsx`. Pages are lazy-loaded through `react-router-dom` v7's `createBrowserRouter`.

**Realtime (Laravel Echo / Reverb)**: `src/shared/realtime/echo.ts` builds a singleton `Echo` client (broadcaster `"reverb"`, via `pusher-js` as the underlying transport) keyed to the current auth token; it's recreated if the token changes. Features that need live updates (messages, calls) subscribe to a private per-user channel `App.Models.User.{id}` inside a component `useEffect` and call `echo.leaveChannel(...)` on cleanup — see `src/features/messages/pages/MessagesPage.tsx` and `src/features/calls/components/CallManager.tsx` for the pattern.

**Calls**: signaling (`.call.invited` / `.call.accepted` / `.call.declined` / `.call.ended`) rides entirely over the Echo/Reverb private channel above; `agora-rtc-sdk-ng` is only used for the actual media session once a call is active (`joinCall` in `CallManager.tsx`) — Agora RTM is not involved in signaling.

**Notification sounds**: `src/shared/utils/sound.ts` synthesizes beeps via the Web Audio API (no audio files). It uses a single lazily-created, module-level `AudioContext` reused across every call — do not switch this back to creating a fresh `AudioContext` per beep; the app runs inside a Tauri WKWebView on macOS, which hard-caps concurrent unclosed `AudioContext` instances, and a per-call context previously caused ringtones to silently stop working during a single ringing call.

**Desktop auto-update**: Tauri's `@tauri-apps/plugin-updater` checks GitHub Releases (`tauri.conf.json` → `plugins.updater.endpoints` → `.../releases/latest/download/latest.json`) via `src/shared/hooks/useAppUpdater.ts`, surfaced by `src/shared/components/UpdateBanner.tsx`, mounted at the app root in `src/main.tsx` (not inside `DashboardLayout`) so it's visible regardless of auth state. `src-tauri/tauri.conf.json` must keep `bundle.createUpdaterArtifacts: true` or the release build won't produce the signed update artifacts/`latest.json` the updater relies on. Restarting after an install uses `@tauri-apps/plugin-process`'s `relaunch()`, which requires the `process:allow-restart` capability in `src-tauri/capabilities/default.json`.

**Release pipeline**: `.github/workflows/release.yml` builds native installers on `macos-latest` (both `aarch64-apple-darwin` and `x86_64-apple-darwin`), `ubuntu-22.04`, and `windows-latest` via `tauri-apps/tauri-action`, triggered by pushing a `v*` tag (or manual `workflow_dispatch`). This is the only reliable way to produce a real Windows installer — cross-compiling from macOS (`tauri:build:win64`) only validates that the Rust side compiles, since NSIS bundling needs to run on Windows.

**Testing**: `vitest` + `jsdom` + `@testing-library/react`, configured directly in `vite.config.ts` (`test.setupFiles: "./src/test/setup.ts"`) rather than a separate vitest config file. Test coverage is currently minimal (`src/test/authSlice.test.ts`, `src/test/LoginPage.test.tsx`).

## Domain architecture

Two developers work on this codebase in parallel (PR #13, branch `feature/maintenance-hub-fleet-updates`). Merges have repeatedly gone wrong: `9c1d231` silently dropped imports, hooks and buttons, and `401b372` and `27a5a83`/`6cd84c2` were committed with `<<<<<<<` conflict markers still in the source. After any merge, run `git diff --check` (flags leftover markers) and `npm run build`, then check that each conflicted page still has the features both sides had, not just that it compiles. Change history in the repo root: `NAA_Aviation_Comprehensive_Update_Report_Oct16_Oct19.md`, `NAA_Aviation_Update_Report_Oct21.md`, and `MAINTENANCE_FEATURE_AUDIT_AND_HANDOVER.md` (Oct 24: tracking sheet, strategic map, shipments, generators, accommodation; its file links point at the other developer's Windows paths).

**Maintenance Hub vs Assets**: there are two separate aircraft views that share only basic airframe attributes (registration, model, manufacturer, unit).
- `/dashboard/assets/:id` (`features/assets/pages/AssetDetailsPage.tsx`) is the flight-operations view.
- `/dashboard/maintenance/aircraft/:id` (`features/maintenance/pages/MaintenanceAircraftDetailsPage.tsx`) is the engineering view: components, engines and avionics editing; an independent flight ledger (`/flight-logs`, via `features/assets/components/FlightLogModal.tsx`); read-only operation history with a "Log Duration in Flight" action; defects; tracking.
- Maintenance Hub tables link to the engineering route, never to the asset page.
- **Tracking sheet tables** (`components/TrackingSheetTables.tsx`, shown on the aircraft details pages; planning at `/dashboard/maintenance/planning`, `pages/PlanningPage.tsx`): parts track three independent clocks (flight hours, cycles, calendar days) with life limits and inspection intervals. Due levels: 1 = overdue (< 0% life left, red), 2 = critical (< 5%, amber), 3 = impending (< 15%, yellow), otherwise normal (green). The backend `MaintenanceDueCalculator` computes them and `maintenance:check-due` runs daily to alert staff.
- **Maintenance tracker** (`/dashboard/maintenance/tracking`, `features/maintenance/tracker/`). It implements the backend repo's `aircraft_maintenance_tracker_2.html`; that file's data is dummy.
  - **Layout:** one aircraft at a time, picked in the header, with a "Calendar items as of" date. State is in the URL: `?aircraft=…&view=…&wo=…|sr=…|voucher=…`, so records can be linked to.
  - **Tabs:** Dashboard, Airframe/Engine components, Inspections (with the phase banner), Work orders (NAAVN-005 workpack), Spares requests (NAAVN-007), Spares catalog (Excel/CSV upload), Inventory (stock per unit), Issues & movements (multi-line issue vouchers, receipts and adjustments), Flight log, History, Data (JSON backup/import, copy from another aircraft, bring in installed parts) and Document (uploads to the Documents module as `classification: open`, `module: maintenance`).
  - **Calculations:** every figure comes from the backend `TrackingCalculator`. The levels are overdue < 0, due soon ≤ 10 h or ≤ 10%, watch ≤ 25%, and for calendar items 30 / 90 days.
  - **Help texts:** the ⓘ texts are in `tracker/trackerHelpers.ts`; keep them in step with the calculator.
  - **API:** the endpoints are injected into `maintenanceApi` (`tracker/api.ts`, `enhanceEndpoints` + `injectEndpoints`), so the store needed no change.
  - **Paper forms:** `components/NaavnPaper.tsx` lays the forms out like the originals; `paperPrint.ts` prints them alone or captures them as a PDF.
  - **Look:** the tracker follows the HTML file's design, not the app's usual teal styling. `tracker/trackerTheme.ts` holds that file's stylesheet: colour tokens, header, tab bar, cards, pills, meters, tables, buttons and dialogs. It is scoped under `.mt`, with dark mode set from the app theme via `data-theme`, and sits in the `components` layer so Tailwind utilities still override it. Tracker screens use its classes (`mt-card`, `mt-tw`, `mt-pill`, `mt-btn` through `components/TButton.tsx`) rather than the shared `Button` or the app palette; restyle the tracker there.
- **Airframe baselines**: when registering an aircraft (`AddAssetPage`), tracking-sheet baselines can be entered (A/C total time as `hours`, `engine_total_hours`, `engine_starts`, `hobbs_hours`, `hook_cycles`, `hook_hours`, `external_lifts`). The API returns `current_*` values as baseline plus recorded flight hours, or `null` when no baseline was entered.
- **Serviceability**: assets have two status fields. `serviceability_status` (serviceable / under_maintenance / grounded) is the authoritative one; `operation_status` is free text the backend never maintains. The asset details page, the assets list (status column, counts, filter) and the Maintenance Hub overview's "Serviceable" count all read `serviceability_status`, falling back to `operation_status` only when it is missing. Don't reintroduce `operation_status` as a primary source. `WorkOrderDetailsPage` still shows `operation_status` in its asset panel.

**Pilot type rating vs airframe**:
- A pilot's qualification belongs to the aircraft *platform* (backend `AssetType`, e.g. "Bell UH-1H Helicopter"). It is stored on `personnel.rating_type` and never as a tail number.
- Operations and flight hours attach to the *physical airframe* (`Asset`, e.g. NA 010).
- The backend eager-loads `assetType` on assets. `OperationForm` labels airframes as `Platform → Tail` and shows whether the chosen crew is type-rated for that platform.

**Approval workflows** (`features/approvals`, `/dashboard/approvals`):
- Admins configure a chain of signing stages per module (`components/WorkflowSettings.tsx`). Approvers sign with a drawn signature (`SignaturePad.tsx`); signatures, names and times are stored per stage and cannot be edited.
- Modules (backend `app/Support/Approvals/ApprovalRegistry.php`): `purchase-orders`, `passes`, `inventory-requisitions`, `stock-issues`, `operations`, `after-action-reports`, `courses`, `memos`. The registry defines which record status each step writes.
- When a module has an active workflow, the server refuses direct approve/reject and status changes; only the workflow can approve. Check `useGetActiveApprovalModulesQuery` before offering a direct approve button (as `PassPage` does).
- `<ApprovalPanel module=… recordId=… />` shows the stage timeline and sign actions. It is mounted on the requisition, PO, operation and stock-issue details pages. The Approvals page is the inbox; `?pass=ID` on the Pass page opens that pass's approval.
- **Requisition approver**: `inventory_requisitions.approved_by`/`approved_at` are set by a model `saving` hook whenever status becomes `approved` (direct change or final workflow signature), and cleared if it goes back to pending/under review/rejected. Shown on the requisition details page and as an "Approved By" column in the Requisitions list.

**Procurement** (`features/inventory`):
- The flow lives in `components/ProcurementSection.tsx` and its tabs: Overview, Pipeline (a Kanban board with a `+` button per stage), Part Requisitions, Quotations, Purchase Orders, Shipments, Stock Received, Stock Issued.
- **Shipments** (`ProcurementShipmentsTab`, `CreateShipmentModal`, `ShipmentTrackerStepper`, `ShipmentDetailsModal`): live carrier tracking through the TrackingMore API (backend `TrackingMoreService`, checkpoints from carrier webhooks). A shipment can be tied to a PO or stand alone, with a `purpose`: `procurement`, `repair_overhaul`, `inter_base_transfer`, `aog_emergency`, `exchange_loan` or `direct_consignment`.
- `pages/ProcurementLifecyclePage.tsx` is the older all-in-one flow; it still works and can still create requisitions.
- Items "not in stock" are sent inline as `new_inventory` on PO, work-order and requisition payloads (`newInventoryItem.ts`, `components/NewInventoryItemFields.tsx`). The backend creates the inventory record inside the same transaction.

**Inventory**:
- Inventory now has multiple stores (`/stores`; system stores cannot be deleted).
- Serialized `inventory_units` track individual components.
- New fields: NSN, ATA chapter, CAGE code, plus batch, GSE and consumable fields.
- Aircraft spare parts use their own batch intake form (`components/AircraftSparePartsForm.tsx`, chosen by category in `InventoryFormPage.tsx`). Common details are entered once; serial numbers are optional per unit and can be auto-generated in sequence.
- Other categories (minor spares, consumables, GSE, general/QM stores) stay on non-serialized batch intake.
- The backend rejects duplicate serial numbers, both within one batch and against existing records.
- `components/InventoryOverviewTab.tsx` is the inventory overview, with links into each area.
- **Stock issues** (`features/stock-issues`, `/dashboard/inventory/issues/...`): inter-unit transfers of stock. Status runs `draft` → `pending_approval` → `approved` → `issued` → `received` (or `rejected`/`cancelled`). An issue can reference a requisition and records authorising and receiving officers; the backend refuses to issue more than the sending unit holds.

**Official NAAVN documents** (Purchase Order NAAVN-006, RFQ, Work Order). Two implementations exist; pick one before extending either.
- `src/shared/documents/` (`naavnDocument.ts` model, `naavnExcel.ts` via ExcelJS, `naavnPdf.ts` vector jsPDF) is driven by builders in `features/inventory/procurementDocuments.ts` and `features/maintenance/workOrderDocument.ts`. It follows the sample templates kept in `docs/` and is used for **all Excel exports** and for the **work-order PDF**.
- `features/inventory/components/PurchaseOrderPrintDocument.tsx` and `RfqPrintDocument.tsx` are on-screen HTML layouts captured with `downloadElementAsPdf` (html2canvas). They are used for **PO and RFQ PDF** and the in-page document preview.
- ExcelJS shares style objects between cells of a column, so always assign a fresh `cell.style` object; never mutate `cell.border` and similar in place.

**Operations**:
- `OperationLocationPicker.tsx` waypoints are draggable and recompute coordinates (lat/lon, MGRS, DMS), leg distances and flight time as they move.
- Fuel calculation and unit fuel stock appear per allocated aircraft in section 3 of `OperationForm`.
- A weather briefing (NOAA METAR/TAF) is served by `/weather/briefing`.
- The backend wraps broadcasts in try/catch, so an offline Reverb server no longer turns mission saves into 500 errors.
- **Navigation**: `utils/navigationEngine.ts` does the E6B/vector calculations (true airspeed, wind drift, ground speed, heading, magnetic variation). `MissionPlanningCard` and `OperationLocationPicker` use it, and `AeronauticalDatabaseModal` supplies aerodromes and navaids.
- **Map tiles** are served by the backend (`/api/map/tiles/{layer}/{z}/{x}/{y}.png`, layers dark/osm/topo/imagery/weather) so maps work offline once cached; `getTileUrl` builds the URL from `VITE_API_BASE_URL`. Pre-seed tiles with `php artisan map:seed-tiles --layer=… --min-zoom=… --max-zoom=…` (defaults cover Nigeria). In dev, `vite.config.ts` proxies relative `/api` requests to `http://127.0.0.1:8000`.
- **Satellite comms**: `SatelliteCommsCard` shows Garmin inReach telemetry and messaging for an operation (backend `GarminIpcService`).
- **After Action Reports** carry tactical, formation and signature fields. `AARSignatureTable` and `DigitalSignatureModal` collect the signatures, and AARs can go through the `after-action-reports` approval workflow. `/dashboard/after-action-reports/:id` (linked from the approvals inbox) redirects to the operation's AAR tab (`?tab=aar`).
- Operation asset rows come back as the asset itself (`id` = asset id), with crew and flight times under `pivot`. Read `asset_id ?? asset.id` and `pilot_id ?? pivot.pilot_id`, as `OperationForm` and `AfterActionReportForm` do.

**Strategic Dashboard** (`/dashboard/strategic`): `components/StrategicOperationsMap.tsx` plots live and planned sorties (routes, waypoints, bases, crew) with MGRS support, alongside fleet readiness, grounded aircraft and personnel readiness. Readiness counts link to filtered lists (see Personnel).

**Personnel**:
- A user account can be linked to a personnel record (`components/LinkedAccountCard.tsx`). The link is required for clock-in, and `/dashboard/users/my-personnel` (`MyPersonnelPage`) shows the signed-in user their own record.
- API fields typed as `string` (`call_sign`, `service_number`, `firstname`, `lastname`) can come back `null`. Default them (`?? ""`) when mapping, and make search filters null-safe.
- Filtered lists can be opened from links: `/dashboard/personnel?flight_status=due_for_flight,overdue` (values: `current`, `due_for_flight`, `overdue`, `no_flights`; the chip above the table clears it) and `/dashboard/personnel/pass?pass_status=on_pass` (any pass status). The Strategic Dashboard's Personnel Readiness counts link to these.

**Safety & Quality** (`features/safety`, routes `/dashboard/safety-quality/:section`):
- The sidebar item and route are gated by any one of the Safety & Quality permissions (`SAFETY_QUALITY_ROUTE_PERMISSIONS` in `routes.tsx`, matching list in `Sidebar.tsx`). These permissions are defined in the backend's `ApiPermissionRegistry` and only exist once `php artisan db:seed --class=ApiPermissionSeeder` has run. That seeder grants them to `super-admin` only; other roles get them via Security → Roles. If the menu item is missing, check the user's permissions first, not the frontend.
- Section tables use `SqTable` (`components/sqUi.tsx`), whose `onRowClick` ignores clicks on buttons. On Ratings & Qualifications, a row click opens the person's personnel page and editing is a separate Edit button; profile-sourced type ratings (`id === null`) are edited on the personnel profile instead.

**Documents → Memos** (`features/memos`, `/dashboard/documents/memos/...`): internal memos with inbox/outbox views, routed to a chosen officer through the `memos` approval workflow, then copied to recipients.

**Facilities** (tabs on the Assets page):
- **Generators** (`features/generators`, details at `/dashboard/assets/generators/:id`): operating hours, fuel tank capacity, daily fuel and maintenance, and usage logs that increment the hour meter.
- **Accommodation** (`features/accommodation`): categories, blocks, residences and personnel occupancies, with capacity checks on allocation.

**Attendance**: personnel clock in and out themselves from the header (`features/personnel/components/ClockInModal.tsx` → `/attendance/clock-in` / `clock-out`, with geolocation for the unit geofence). This needs the user account linked to a personnel record. `AttendancePage` is view, export and delete only; no screen creates or edits attendance manually.

## UI conventions

- **Clickable table rows**: use `onInteractiveRowClick` / `onInteractiveRowKeyDown` from `src/shared/utils/onInteractiveRowClick.ts`, with `tabIndex={0}` on the row. They ignore clicks that start on buttons, menus, checkboxes, inputs, links or text selections.
- **Back navigation**: use `BackButton` (`src/shared/ui/button`) instead of `navigate(-1)`. It resolves the destination via `src/shared/utils/navigationContext.ts`: router state `from`/`fromLabel` first, then `?returnTo=` / `?from=`, then `fallbackUrl`, validated to same-origin paths only. Pass `isDirty` to get the unsaved-changes prompt. When linking to a detail page, pass `state={{ from, fromLabel }}` so the button reads "Back to …".
- **`InfoTip`** (`src/shared/ui/tooltip/InfoTip.tsx`) is the shared hover/focus help icon for explaining fields and metrics.
- **`MultiSelect`** (`src/shared/ui/multi-select`) has a built-in search: pass `searchable` (and `searchPlaceholder`) for long option lists, as the role-permission pickers in `SecurityPage` do. "Select all" then applies to the filtered options only.
- **`SearchableSelect`** (`src/shared/ui/select`) matches the selected value with `===`. Pass `value` with the same type as the option values (numbers vs strings); a mismatch silently shows the placeholder.
- Show the API's `error.data.message` in toasts and error states rather than a generic "Failed to …".

## Backend deploy notes

- The deployed API is `https://avn-api.claimify.ng/api`. Local `.env` points at it, so local backend data may not match what the app shows.
- Run `php artisan migrate` on staging/production before the matching frontend ships. Recent migrations:
  - Oct 21: inventory stores, `inventory_units` (+ ATA columns), inventory specification/batch/GSE fields and `nsn`/`ata_chapter`, work-order `status`, `personnel.rating_type`, and the platform/airframe seed (`2026_10_21_000002`).
  - Oct 22–23: Safety & Quality tables; approval workflow tables (also creates `stock_issues`).
  - Oct 24–25: tracking-sheet fields on parts and counters on assets, Garmin inReach telemetry/messages, memos, AAR tactical/formation/signature fields, generators.
  - Oct 26–28: accommodation, shipments (+ checkpoints, multipurpose upgrade), requisition `approved_by`/`approved_at` (`2026_10_27_000001`), generator daily fuel and maintenance.
  - Oct 29 (`2026_10_29_000001`–`000007`): maintenance tracker. Then run `php artisan permissions:sync-api` for its permissions (`maintenance-tracking.*`, `maintenance-tracking-items.*`, `part-catalog.*`, `spares-requests.*`, `stock-issues.cancel`).
- After `2026_10_27_000001`, run `php artisan requisitions:backfill-approvers` once (try `--dry-run` first). It recovers approvers of older requisitions from workflow signatures, then the activity log, and leaves the rest blank rather than guessing.
- After adding permissions to `ApiPermissionRegistry`, run `php artisan db:seed --class=ApiPermissionSeeder` (or `php artisan permissions:sync-api`). It grants them to `super-admin` only. The app re-reads the user's permissions from `/auth/me` on each load.
- Backend env: `TRACKINGMORE_API_KEY` (shipment tracking); `GARMIN_IPC_USERNAME`/`GARMIN_IPC_PASSWORD` (inReach). The scheduler must run for `maintenance:check-due` (daily).
