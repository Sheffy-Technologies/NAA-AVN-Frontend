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

## 5. Context-Aware Back Navigation & Subtab State Preservation (RFQ, Procurement, Requisitions, Inventory)

### Problem
When navigating to subpages or detail views (such as **RFQ Details**, **Purchase Orders**, **Procurement Lifecycle**, **Requisitions**, or **Stock Info**) and clicking the "Back" or "Cancel" button, users were kicked back to the generic root hub (`/dashboard/inventory` Overview tab). This caused users to completely lose track of the previous page, subtab (e.g. *Quotations*, *Purchase Orders*, *Pipeline*), filters, search terms, and pagination.

### Solution & Changes
- **Core Navigation Hook (`src/shared/utils/navigationContext.ts`):**
  - Updated `useNavigationContext` to prioritize true browser session history (`canGoBackInHistory` checking `window.history.state.idx > 0` or non-default router keys).
  - Calling `navigateBack()` now executes `navigate(-1)`, restoring the exact prior URL including query parameters (`?tab=procurement&subtab=quotations`, etc.), active filters, and scroll position.
  - Safe fallbacks are used if the user landed via direct link or bookmarks.
- **Cancel Button Component (`src/shared/ui/button/CancelButton.tsx`):**
  - Integrated `CancelButton` with `useNavigationContext(fallbackUrl)` so cancellation respects previous page history instead of hard-redirecting to root hubs.
- **Inventory & Procurement Hub State Sync (`src/features/inventory/pages/InventoryPage.tsx`):**
  - Added `location.search` listener inside `useEffect` so popstate/back navigation immediately activates the exact `activeTab` (`tab` parameter) and `activeProcurementSubTab` (`subtab` parameter).
  - Updated all navigate calls (`handleOpenRfqDetails`, `handleOpenDetail`, `handleOpenEdit`, table row clicks, grid cards, and requisitions) to pass the full query path (`location.pathname + location.search`) in `state.from`.
- **Subtab-Preserving Back Navigation Across Detail & Form Pages:**
  - **RFQ Details (`src/features/inventory/pages/RfqDetailsPage.tsx`):** Set `fallbackUrl="/dashboard/inventory?tab=procurement&subtab=quotations"` and `label="Back to Quotations"`.
  - **Procurement Quotations Tab (`src/features/inventory/components/ProcurementQuotationsTab.tsx`):** Updated row clicks and detail buttons to pass `/dashboard/inventory?tab=procurement&subtab=quotations` in `state.from`.
  - **Procurement Purchase Orders Tab (`src/features/inventory/components/ProcurementPurchaseOrdersTab.tsx`):** Updated row clicks and view buttons to pass `/dashboard/inventory?tab=procurement&subtab=purchase-orders` in `state.from`.
  - **Purchase Order Details (`src/features/inventory/pages/PurchaseOrderDetailsPage.tsx`):** Set `fallbackUrl="/dashboard/inventory?tab=procurement&subtab=purchase-orders"` and `label="Back to Purchase Orders"`.
  - **Create Purchase Order Form (`src/features/inventory/pages/PurchaseOrderFormPage.tsx`):** Updated `BackButton` and post-submit redirect to return to `/dashboard/inventory?tab=procurement&subtab=purchase-orders` (or linked RFQ if created from quote).
  - **Procurement Lifecycle (`src/features/inventory/pages/ProcurementLifecyclePage.tsx`):** Set `fallbackUrl="/dashboard/inventory?tab=procurement&subtab=pipeline"` and preserved hash stage state when navigating to PO details.
  - **Requisition Details & Forms (`InventoryRequisitionDetailsPage.tsx`, `InventoryRequisitionFormPage.tsx`):** Set `fallbackUrl="/dashboard/inventory?tab=requisitions"` and `label="Back to Requisitions"`.
  - **Stock Info & Forms (`InventoryInfoPage.tsx`, `InventoryFormPage.tsx`, `AircraftSparePartsForm.tsx`):** Set `fallbackUrl="/dashboard/inventory?tab=stock"` and `label="Back to Stock"`.
  - **Supplier Addition (`AddSupplierPage.tsx`):** Set `fallbackUrl="/dashboard/inventory?tab=suppliers"` and `label="Back to Suppliers"`.

---

## 7. Optional Serial Numbers Across All Inventory Units & Quantities

### Problem
Previously, when receiving multiple units of a component (e.g. 6 units or 50 units in `AircraftSparePartsForm.tsx`), each individual unit card enforced mandatory serial numbers with `Serial number is required for Unit #N` red validation errors. This blocked users from checking in batches where serial numbers are unassigned, untracked, or stamped on only a subset of units.

### Solution & Changes
- **Frontend Form Validation (`src/features/inventory/components/AircraftSparePartsForm.tsx` & `InventoryFormPage.tsx`):**
  - Removed mandatory serial number validation loops across all units.
  - Retained intra-batch duplicate detection strictly for non-empty serial numbers (blank units are never treated as duplicates of each other).
  - Updated unit card labels to `Serial Number (Optional)` and removed HTML `required` attributes.
  - Updated Section 2 badge from `"{qty} Serialized Units Required"` to `"{qty} Units Breakdown"`.
  - Updated Review step table to display `Unassigned` instead of red `Missing` for blank serial numbers.
  - Updated payload assembly to serialize `serial_number: null` for blank units, with parent item `serial_number` taking the first available serial or `null`.
- **Type Definitions (`src/features/inventory/api.ts` & `InventoryInfoPage.tsx`):**
  - Updated `InventorySerializedUnit.serial_number` to `string | null | undefined`.
  - Added null-safe guards for clipboard copying of serial numbers in `InventoryInfoPage.tsx`.
- **Backend Validation & Storage (`app/Http/Controllers/InventoryController.php`):**
  - Changed validation rule `'units.*.serial_number'` from `required_with:units` to `sometimes|nullable|string|max:255` in both `store` and `update` methods.
  - Filtered out empty strings before running database and intra-batch uniqueness checks so blank units pass smoothly.
  - Stored `serial_number => !empty($u['serial_number']) ? trim($u['serial_number']) : null`.
- **Database Schema Migration (`database/migrations/2026_10_28_000001_make_serial_number_nullable_in_inventory_units_table.php`):**
  - Added migration altering `inventory_units.serial_number` to `nullable()`.

---

## 8. Back-Flow Context Preservation & Physical Print Capabilities for RFQ & Purchase Orders

### Problem
1. **Lost Navigation State:**
   - Navigating to RFQ Details, Purchase Order Details, or Create Purchase Order from subtabs (e.g. Kanban Pipeline, Quotations, Stock Received, Consignments, or Overview) lost track of the caller's active subtab.
   - Clicking "Back" or "Cancel" kicked the user out to the default root tab (`/dashboard/inventory`) or lost their active pipeline stage.
   - In `PurchaseOrderFormPage.tsx`, on submit it hardcoded `navigate('/dashboard/inventory?tab=procurement&subtab=purchase-orders')` even when launched from an RFQ or Kanban pipeline, and lacked a bottom `CancelButton`.
2. **Broken/Missing Printing on RFQ & Purchase Orders:**
   - Unlike Spares Requests and Work Orders (which have clean 1-click physical printing via popup windows), RFQ and PO lacked top toolbar "Print" buttons.
   - Inside their preview modals, "Print Form" called `window.print()` directly on the active document, which attempted to print the dark theme dashboard shell (sidebars, modal backdrop, scroll containers) or failed because offscreen printable documents were hidden.

### Solution & Changes
- **Shared Isolated Print Utility (`src/shared/utils/printElement.ts`):**
  - Created a dedicated `printElement(element, documentTitle)` utility based on the proven tracker print pattern.
  - Clones the target printable document into an isolated browser window with clean A4 `@page` print styles, transfers dynamic inputs/textareas, strips `.noprint` chrome, and initiates native browser print dialog immediately.
- **RFQ Print & Back Navigation (`src/features/inventory/pages/RfqDetailsPage.tsx`):**
  - Added direct **Print** button in the executive action toolbar next to "Preview Document".
  - Connected the preview modal's "Print Form" button to `handlePrint()` (using `printElement`).
  - Updated `handleCreatePO()` to pass `state: { from: location.pathname + location.search, fromLabel: 'RFQ #' + (rfq.rfq_number || id) }`.
- **Purchase Order Print & Back Navigation (`src/features/inventory/pages/PurchaseOrderDetailsPage.tsx`):**
  - Added direct **Print** button in the executive action toolbar.
  - Connected the preview modal's "Print Form" button to `handlePrint()` (using `printElement`).
  - Supported dynamic return paths in `BackButton` to return seamlessly to originating RFQ, Overview, Kanban, or Shipments tabs.
- **Purchase Order Form Navigation (`src/features/inventory/pages/PurchaseOrderFormPage.tsx`):**
  - Added dynamic `returnUrl` resolution honoring `location.state.from`, falling back to originating RFQ or the PO list.
  - Added bottom `CancelButton` alongside `Create Purchase Order`.
  - Updated post-submission redirect to return to `returnUrl`.
- **Procurement Pipeline & Subtab Callers Updated with Router State:**
  - `ProcurementPurchaseOrdersTab.tsx`: "Create Purchase Order" link and table links now carry `state: { from, fromLabel }`.
  - `ProcurementQuotationsTab.tsx`: "Create PO" action button now carries `state: { from, fromLabel }`.
  - `ProcurementOverviewTab.tsx`: "Create Purchase Order" button, "View PO" button/row click, "View RFQ" button/row click, and shipment PO clicks now carry `state: { from, fromLabel }`.
  - `ProcurementPipelineKanbanTab.tsx`: Drag-and-drop PO generation, stage actions, "Inspect RFQ", "Generate PO", and "View PO" card buttons now carry `state: { from, fromLabel }`.
  - `ProcurementStockReceivedTab.tsx`: Linked PO table links and inspect actions carry `state: { from, fromLabel }`.
  - `ProcurementShipmentsTab.tsx` & `ShipmentDetailsModal.tsx`: Linked PO links carry `state: { from, fromLabel }`.
  - `InventoryOverviewTab.tsx`: "Create Purchase Order" and "Procure" buttons carry `state: { from, fromLabel }`.
  - `PurchaseOrdersPage.tsx`: Standalone page creation and row links carry `state: { from, fromLabel }`.

---

---

## 10. Aviation Spares Form Layout Standardization Across Purchase Orders, Stock Issuance, & Receipts (GRN)

### Problem
The user requested standardizing forms across **Stock Issuance, Receipts (GRN), and Purchase Orders (PO)** to mirror the comprehensive aviation form architecture and executive layout established in `ADD STOCK — AIRCRAFT SPARE PARTS [AVIATION SPARES WORKFLOW]`. Previously:
1. Registering new inventory items inside Purchase Orders lacked key aviation traceability attributes (Alt P/N, ATA chapter, CAGE code, NSN, Manufacturer, and Special Storage Environment).
2. Stock Issuance (`StockIssueFormPage.tsx`) was a rudimentary form that lacked rich aviation fields, store badges, and individual serialized unit selection.
3. Receipts / Goods Received Notes (GRN) modals in `ProcurementStockReceivedTab.tsx` and `PurchaseOrderDetailsPage.tsx` lacked the executive aviation layout and structured line inspection breakdowns.

### Solution & Changes
- **Backend Purchase Order Non-Catalogue Inventory Handler (`app/Http/Controllers/PurchaseOrderController.php`):**
  - Expanded `$newInventoryRules` and `createInventoryForItem()` to validate and persist aviation specifications:
    - `alternate_support_part_no`, `nsn`, `cage_code`, `ata_chapter`, `ata_chapter_id`, `manufacturer`, `special_storage`, `asset_id`.
- **Frontend Inventory Types & Payload Serialization (`src/features/inventory/newInventoryItem.ts`):**
  - Updated `NewInventoryDraft` and `NewInventoryPayload` interfaces to include all aviation specifications.
  - Updated `toNewInventoryPayload` and `toCreateInventoryPayload` with null-safe type casting and defaults.
- **Purchase Order New Item Card Grid (`src/features/inventory/components/NewInventoryItemFields.tsx`):**
  - Rebuilt into the standardized **"1. COMMON PART INFORMATION [SHARED SPECIFICATIONS]"** card grid matching `AircraftSparePartsForm`.
  - Added Part Name/Description, Part Number (P/N), Alternate Part Number (Alt P/N), Manufacturer (MFR), ATA Chapter, NATO Stock Number (NSN), CAGE Code, Storage Environment dropdown, Unit Cost, UOM, Re-Order Level, and optional Serial Number.
- **Stock Issuance Form Upgrade (`src/features/stock-issues/pages/StockIssueFormPage.tsx`):**
  - Rebuilt the entire form into the executive Aviation Spares Workflow architecture:
    - **Header:** Executive command bar with `BackButton`, `CancelButton`, status badges, and action buttons.
    - **Top Bar:** Sending Unit (Source) badge, Receiving Unit selector, Date of Issue, and searchable Stock Ledger Item selector.
    - **Section 1: COMMON PART INFORMATION [SHARED SPECIFICATIONS]:** Auto-populates and allows editing description, P/N, Alt P/N, MFR, ATA Chapter, NSN, CAGE Code, Storage Environment, available quantity badge, and Quantity to Issue.
    - **Section 2: UNIT & SERIAL NUMBER DISPATCH:** Displays interactive unit badges for serialized stock items, allowing the issuing officer to select exactly which serialized units are dispatched.
    - **Section 3: MILITARY AUTHORIZATION & TRANSFER DETAILS:** Authorizing Officer & Receiving Officer selectors with military rank/service numbers, plus detailed remarks / purpose of issue.
    - **Section 4: SUPPORTING VOUCHER DOCUMENTS:** Document upload rows for issue voucher photos, AFG/1033 vouchers, and airworthiness certificates.
- **Goods Received Note (GRN) Modals Upgrade (`ProcurementStockReceivedTab.tsx` & `PurchaseOrderDetailsPage.tsx`):**
  - Upgraded the GRN creation and review modals with the "Aviation Stores" workflow badge, vendor delivery windows, delivered items batch cards, and acceptance inspection notes.

---

## 11. Verification & Quality Assurance

- **Build Check:** Ran `npx tsc --noEmit` and `npx tsc -b` with 0 compiler errors across the entire frontend codebase.
- **Git Branch Check:** Confirmed target branch is `feature/maintenance` on both Frontend and Backend (never pushed to `main`).



