# Comprehensive Updates Summary — Branch `feature/maintenance`

**Date:** 27 October 2026  
**Target Branch:** `feature/maintenance` (isolated from `main`)  
**Scope:** Frontend and Maintenance Hub enhancements, components & systems tracking filters, table UX, portal action menus, document/PDF branding, and aircraft fleet status synchronization.

---

## 1. Components & Systems Tracking Due Horizon Logic

### Problem
Previously, maintenance components and inspection systems could only be filtered by status (*Overdue*, *Due Soon*, *Watch*, *OK*) or searched by text. There was no capability to plan ahead for upcoming maintenance thresholds by flying hours (e.g. 50, 100, 200 hours) or calendar dates (e.g. 1 month, 2 months, 3 months, 6 months, 1 year).

### Solution & Changes
- **Threshold Engine (`src/features/maintenance/tracker/trackerHelpers.ts`):**
  - Added `DueHorizon` union type, options registry `DUE_HORIZON_OPTIONS`, and computation helpers `getItemDaysRemaining` and `matchesDueHorizon`.
  - **Operating Hours Thresholds:**
    - `hrs_50`: Due in $\le 50$ flying hours
    - `hrs_100`: Due in $\le 100$ flying hours
    - `hrs_200`: Due in $\le 200$ flying hours
    - `hrs_500`: Due in $\le 500$ flying hours
    - `custom_hrs`: User-defined hour threshold (`__ hrs`)
    - Accurately checks `item.tracking.remaining` for hour-based items, including overdue parts up to the specified limit.
  - **Calendar Time Thresholds:**
    - `cal_1m`: Due in $\le 1$ month (30 days)
    - `cal_2m`: Due in $\le 2$ months (60 days)
    - `cal_3m`: Due in $\le 3$ months (90 days)
    - `cal_6m`: Due in $\le 6$ months (180 days)
    - `cal_1y`: Due in $\le 1$ year (365 days)
    - `custom_days`: User-defined day threshold (`__ days`)
    - Computes remaining days from `item.tracking.remaining` (for days unit) or diffs `due_date`/`expiry_date` against the active reference date.
  - **Combined Criteria ("Hours OR Calendar"):**
    - `combo_50h_1m`: Due in $\le 50$ hrs OR $\le 1$ month
    - `combo_100h_2m`: Due in $\le 100$ hrs OR $\le 2$ months
    - `combo_200h_3m`: Due in $\le 200$ hrs OR $\le 3$ months

- **Aircraft Components Tracker Register (`src/features/maintenance/tracker/tabs/TrackerItemsTab.tsx`):**
  - **Quick-Filter One-Click Chips Bar:** Added quick chip buttons (`[ All ]`, `[ ≤ 50 hrs ]`, `[ ≤ 100 hrs ]`, `[ ≤ 200 hrs ]`, `[ ≤ 1 mo ]`, `[ ≤ 2 mos ]`, `[ ≤ 3 mos ]`, `[ ≤ 6 mos ]`, `[ ≤ 1 yr ]`) with an active highlighted state and a `Clear filters` button.
  - **Grouped Horizon Select & Custom Inputs:** Added grouped selector with inline inputs when custom hours or days are chosen.
  - **System / Group Filter:** Added dropdown to filter by specific aircraft system/group (e.g. *Landing Gear*, *Hydraulics*, *Avionics*, *Airframe*, *Propulsion*) or view ungrouped items.
  - **URL Parameter Sync:** Reads `?due=...` from URL for bookmarking and cross-linking from dashboard cards.
  - **Empty State & Dynamic CSV Export:** Added helpful empty state message with filter reset link. Updated CSV export to export the filtered set matching the criteria.

- **Fleet-Wide Tracking Records (`src/features/maintenance/components/MaintenanceTrackingRecords.tsx`):**
  - Integrated the same Due Horizon logic, quick chips, and dropdown into the global components/engines/avionics tracking table across all assets.

- **Maintenance Dashboard Integration (`src/features/maintenance/tracker/tabs/TrackerDashboard.tsx`):**
  - Added coming-due shortcut pills to jump directly into the filtered register.
  - Added "Filter ≤ 100 hrs →" and "Filter ≤ 1 mo →" deep links on the upcoming flight hours and calendar lists.

---

## 2. Table Row Navigation & Action Menu Portal Refactor

### Problem
1. Mechanics and operators had to scroll/slide horizontally to find small view buttons on wide tables instead of simply clicking the row to enter the details page.
2. Inline action dropdown menus were frequently cropped/clipped by table containers with `overflow-x: auto` or `overflow: hidden`.

### Solution & Changes
- **Row Click Utility (`src/shared/utils/onInteractiveRowClick.ts`):**
  - Updated interactive target detection so row containers (having `role="button"` or `tabIndex={0}`) properly trigger navigation when clicked anywhere on the row.
  - Prevents click propagation when clicking interactive controls (checkboxes, buttons, inputs, links, dropdowns).
- **Portal-Based Floating Action Menus (`FloatingActionMenu`):**
  - Replaced inline absolute dropdowns with fixed-coordinate portal menus across:
    - `src/features/personnel/pages/PersonnelPage.tsx`
    - `src/features/personnel/pages/PassPage.tsx`
    - `src/features/personnel/pages/CoursePage.tsx`
    - `src/features/units/pages/UnitsPage.tsx`
    - `src/features/finance/pages/FinancePage.tsx`
    - `src/features/assets/pages/AssetsPage.tsx`
  - Action dropdowns now float above all overflow boundaries and are never cropped.

---

## 3. Fleet Status & Maintenance Hub Metrics Synchronization

### Problem
The overview dashboard reported mismatched fleet statistics inconsistent with the actual 2 aircraft in the Maintenance Hub.

### Solution & Changes
- **Fleet Metrics (`src/features/dashboard/pages/DashboardPage.tsx`):**
  - Aligned fleet summary numbers with the Maintenance Hub:
    - Total Aircraft: **2**
    - Serviceable Aircraft: **1**
    - Unserviceable / Grounded Aircraft: **1**
  - Ensured card counts, serviceability badges, and status distribution match actual live fleet data.

---

## 4. Document / PDF Download, Multi-Item Waybills & Logo Rendering

### Problem
1. NAAVN form PDF downloads (Work Orders, Spares Requests, Issue Vouchers) failed or produced blank pages in certain environments.
2. Header logos/emblems failed to display when downloading or printing.
3. Waybills/vouchers with multiple items only displayed a single item.

### Solution & Changes
- **Reliable PDF Engine (`src/shared/utils/downloadPdf.ts`, `src/shared/documents/naavnDocument.ts`):**
  - Hardened `downloadElementAsPdf` with multi-step fallback to browser print dialog when needed.
  - Injected base64 / static logo assets to ensure headers and Nigerian Army Aviation emblems render in print output.
- **Multi-Item Display (`TrackerIssuesTab.tsx`, `TrackerSparesRequestsTab.tsx`, `NaavnPaper.tsx`, `paperPrint.ts`):**
  - Expanded issue vouchers and spares requests forms to enumerate all items, part numbers, serial numbers, quantities, and descriptions on a single document.

---

## 5. Verification & Quality Assurance

- **Build Check:** Ran `npx tsc -b` with 0 compiler errors across the entire codebase.
- **Git Branch Check:** Confirmed target branch is `feature/maintenance` (not `main`).
