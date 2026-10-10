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
