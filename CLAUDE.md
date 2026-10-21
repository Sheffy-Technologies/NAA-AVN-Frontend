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

**Feature-based structure**: `src/app/` (store, router, layout shells), `src/features/<name>/` (one folder per domain: auth, dashboard, personnel, inventory, finance, operations, assets, emergencies, notifications, security, users, maintenance, documents, reports, messages, calls, units, flight-programme), `src/shared/` (cross-feature UI, hooks, utils, realtime, api helpers), `src/context/` (React context providers, e.g. theme).

**Data layer — RTK Query per feature, manually wired**: each feature typically has its own `api.ts` defining an RTK Query `createApi` slice built on the shared `axiosBaseQuery` (`src/shared/api/baseQuery.ts`), which wraps axios, injects the `Authorization: Bearer <token>` header from the auth slice, and auto-dispatches `logout()` + a toast on a 401 "Unauthenticated." response. There is no `injectEndpoints`/dynamic registration — every feature's `api.reducerPath`/`api.middleware` must be added by hand to `src/app/store/index.ts`, so adding a new feature API means touching that file too.

**Auth**: `src/features/auth/authSlice.ts` holds `token`/`user`/`isAuthenticated`, persisted to `localStorage` under `AUTH_STORAGE_KEY` and rehydrated when the store is created (see `getPersistedAuthState` in `src/app/store/index.ts`). Route protection is two-layered: `RequireAuth` (redirects to `/auth/login` if unauthenticated) and `RequireRole` (gates a route behind one or more Spatie permission strings checked against `user.permissions`), both applied per-route in `src/app/router/routes.tsx`. Pages are lazy-loaded through `react-router-dom` v7's `createBrowserRouter`.

**Realtime (Laravel Echo / Reverb)**: `src/shared/realtime/echo.ts` builds a singleton `Echo` client (broadcaster `"reverb"`, via `pusher-js` as the underlying transport) keyed to the current auth token; it's recreated if the token changes. Features that need live updates (messages, calls) subscribe to a private per-user channel `App.Models.User.{id}` inside a component `useEffect` and call `echo.leaveChannel(...)` on cleanup — see `src/features/messages/pages/MessagesPage.tsx` and `src/features/calls/components/CallManager.tsx` for the pattern.

**Calls**: signaling (`.call.invited` / `.call.accepted` / `.call.declined` / `.call.ended`) rides entirely over the Echo/Reverb private channel above; `agora-rtc-sdk-ng` is only used for the actual media session once a call is active (`joinCall` in `CallManager.tsx`) — Agora RTM is not involved in signaling.

**Notification sounds**: `src/shared/utils/sound.ts` synthesizes beeps via the Web Audio API (no audio files). It uses a single lazily-created, module-level `AudioContext` reused across every call — do not switch this back to creating a fresh `AudioContext` per beep; the app runs inside a Tauri WKWebView on macOS, which hard-caps concurrent unclosed `AudioContext` instances, and a per-call context previously caused ringtones to silently stop working during a single ringing call.

**Desktop auto-update**: Tauri's `@tauri-apps/plugin-updater` checks GitHub Releases (`tauri.conf.json` → `plugins.updater.endpoints` → `.../releases/latest/download/latest.json`) via `src/shared/hooks/useAppUpdater.ts`, surfaced by `src/shared/components/UpdateBanner.tsx`, mounted at the app root in `src/main.tsx` (not inside `DashboardLayout`) so it's visible regardless of auth state. `src-tauri/tauri.conf.json` must keep `bundle.createUpdaterArtifacts: true` or the release build won't produce the signed update artifacts/`latest.json` the updater relies on. Restarting after an install uses `@tauri-apps/plugin-process`'s `relaunch()`, which requires the `process:allow-restart` capability in `src-tauri/capabilities/default.json`.

**Release pipeline**: `.github/workflows/release.yml` builds native installers on `macos-latest` (both `aarch64-apple-darwin` and `x86_64-apple-darwin`), `ubuntu-22.04`, and `windows-latest` via `tauri-apps/tauri-action`, triggered by pushing a `v*` tag (or manual `workflow_dispatch`). This is the only reliable way to produce a real Windows installer — cross-compiling from macOS (`tauri:build:win64`) only validates that the Rust side compiles, since NSIS bundling needs to run on Windows.

**Testing**: `vitest` + `jsdom` + `@testing-library/react`, configured directly in `vite.config.ts` (`test.setupFiles: "./src/test/setup.ts"`) rather than a separate vitest config file. Test coverage is currently minimal (`src/test/authSlice.test.ts`, `src/test/LoginPage.test.tsx`).

## Domain architecture

Two developers work on this codebase in parallel (PR #13, branch `feature/maintenance-hub-fleet-updates`). A merge has already dropped imports, hooks and buttons silently (commit `9c1d231`). After any merge, run `npm run build`, then check that each conflicted page still has the features both sides had, not just that it compiles. Change history: `NAA_Aviation_Comprehensive_Update_Report_Oct16_Oct19.md` and `NAA_Aviation_Update_Report_Oct21.md` in the repo root.

**Maintenance Hub vs Assets**: there are two separate aircraft views that share only basic airframe attributes (registration, model, manufacturer, unit).
- `/dashboard/assets/:id` (`features/assets/pages/AssetDetailsPage.tsx`) is the flight-operations view.
- `/dashboard/maintenance/aircraft/:id` (`features/maintenance/pages/MaintenanceAircraftDetailsPage.tsx`) is the engineering view: components, engines and avionics editing; an independent flight ledger (`/flight-logs`, via `features/assets/components/FlightLogModal.tsx`); read-only operation history with a "Log Duration in Flight" action; defects; tracking.
- Maintenance Hub tables link to the engineering route, never to the asset page.

**Pilot type rating vs airframe**:
- A pilot's qualification belongs to the aircraft *platform* (backend `AssetType`, e.g. "Bell UH-1H Helicopter"). It is stored on `personnel.rating_type` and never as a tail number.
- Operations and flight hours attach to the *physical airframe* (`Asset`, e.g. NA 010).
- The backend eager-loads `assetType` on assets. `OperationForm` labels airframes as `Platform → Tail` and shows whether the chosen crew is type-rated for that platform.

**Procurement** (`features/inventory`):
- The flow lives in `components/ProcurementSection.tsx` and its tabs: Overview, a Kanban pipeline with a `+` button per stage, Part Requisitions, RFQs (shown before Suppliers), Quotations, Purchase Orders, Stock Issued, Stock Received.
- `pages/ProcurementLifecyclePage.tsx` is the older all-in-one flow; it still works and can still create requisitions.
- Items "not in stock" are sent inline as `new_inventory` on PO, work-order and requisition payloads (`newInventoryItem.ts`, `components/NewInventoryItemFields.tsx`). The backend creates the inventory record inside the same transaction.

**Inventory**:
- Inventory now has multiple stores (`/stores`; system stores cannot be deleted).
- Serialized `inventory_units` track individual components.
- New fields: NSN, ATA chapter, CAGE code, plus batch, GSE and consumable fields.
- Aircraft spare parts use their own batch intake form (`components/AircraftSparePartsForm.tsx`, chosen by category in `InventoryFormPage.tsx`). Common details are entered once; serial numbers are optional per unit and can be auto-generated in sequence.
- Other categories (minor spares, consumables, GSE, general/QM stores) stay on non-serialized batch intake.
- The backend rejects duplicate serial numbers, both within one batch and against existing records.

**Official NAAVN documents** (Purchase Order NAAVN-006, RFQ, Work Order). Two implementations exist; pick one before extending either.
- `src/shared/documents/` (`naavnDocument.ts` model, `naavnExcel.ts` via ExcelJS, `naavnPdf.ts` vector jsPDF) is driven by builders in `features/inventory/procurementDocuments.ts` and `features/maintenance/workOrderDocument.ts`. It follows the sample templates kept in `docs/` and is used for **all Excel exports** and for the **work-order PDF**.
- `features/inventory/components/PurchaseOrderPrintDocument.tsx` and `RfqPrintDocument.tsx` are on-screen HTML layouts captured with `downloadElementAsPdf` (html2canvas). They are used for **PO and RFQ PDF** and the in-page document preview.
- ExcelJS shares style objects between cells of a column, so always assign a fresh `cell.style` object; never mutate `cell.border` and similar in place.

**Operations**:
- `OperationLocationPicker.tsx` waypoints are draggable and recompute coordinates (lat/lon, MGRS, DMS), leg distances and flight time as they move.
- Fuel calculation and unit fuel stock appear per allocated aircraft in section 3 of `OperationForm`.
- A weather briefing (NOAA METAR/TAF) is served by `/weather/briefing`.
- The backend wraps broadcasts in try/catch, so an offline Reverb server no longer turns mission saves into 500 errors.
- Operation asset rows come back as the asset itself (`id` = asset id), with crew and flight times under `pivot`. Read `asset_id ?? asset.id` and `pilot_id ?? pivot.pilot_id`, as `OperationForm` and `AfterActionReportForm` do.

**Attendance**: personnel clock in and out themselves from the header (`features/personnel/components/ClockInModal.tsx` → `/attendance/clock-in` / `clock-out`, with geolocation for the unit geofence). This needs the user account linked to a personnel record. `AttendancePage` is view, export and delete only; no screen creates or edits attendance manually.

## UI conventions

- **Clickable table rows**: use `onInteractiveRowClick` / `onInteractiveRowKeyDown` from `src/shared/utils/onInteractiveRowClick.ts`, with `tabIndex={0}` on the row. They ignore clicks that start on buttons, menus, checkboxes, inputs, links or text selections.
- **Back navigation**: use `BackButton` (`src/shared/ui/button`) instead of `navigate(-1)`. It resolves the destination via `src/shared/utils/navigationContext.ts`: router state `from`/`fromLabel` first, then `?returnTo=` / `?from=`, then `fallbackUrl`, validated to same-origin paths only. Pass `isDirty` to get the unsaved-changes prompt. When linking to a detail page, pass `state={{ from, fromLabel }}` so the button reads "Back to …".
- **`SearchableSelect`** (`src/shared/ui/select`) matches the selected value with `===`. Pass `value` with the same type as the option values (numbers vs strings); a mismatch silently shows the placeholder.
- Show the API's `error.data.message` in toasts and error states rather than a generic "Failed to …".

## Backend deploy notes

New migrations must be run (`php artisan migrate`) on staging/production before the matching frontend ships: stores, `inventory_units` (+ ATA columns), inventory specification/batch/GSE fields, `personnel.rating_type`, work-order `status`, inventory `nsn`/`ata_chapter`, and the platform/airframe seed migration (`2026_10_21_000002`). The deployed API is `https://avn-api.claimify.ng/api`; local `.env` points at it, so local backend data may not match what the app shows.
