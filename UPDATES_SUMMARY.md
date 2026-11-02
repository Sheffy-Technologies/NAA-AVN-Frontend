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

## 12. Stakeholder Feedback, System Audit & Root Cause Analysis (November 2026)

### Issue 1: New Memo Submission Reference Collision ("Another memo already uses this reference")

#### Problem Identified (from Executive Feedback Screenshot)
When an officer (e.g., Ag AD Proc) creates a New Memo (`/dashboard/documents/memos/new`) directed to the Commander (`To: Comd`) with an official military reference (e.g., `NA AVN COMD/G4/100/58`), clicking **"Sign & Submit"** (or **"Save Draft"**) triggers an immediate error toast:
> **"Another memo already uses this reference."**

#### Why It Happened (System Root Cause)
1. **Backend Database Strict Global Uniqueness:**
   - Migration `2026_10_24_000002_create_memos_tables.php` defines `$table->string('reference')->nullable()->unique();`.
   - In `app/Http/Controllers/MemoController.php` (line 433):
     ```php
     if ($data['reference'] && MemoReference::exists($data['reference'], $memo?->id)) {
         throw ValidationException::withMessages(['reference' => 'Another memo already uses this reference.']);
     }
     ```
   - `MemoReference::exists()` queries across the entire database without global scopes (`Memo::withoutGlobalScopes()`), checking every draft, rejected, or active memo across all users.
2. **Frontend Double-Submit / State Desynchronization Trap in `MemoFormPage.tsx`:**
   - On `/dashboard/documents/memos/new`, `memoId` is undefined.
   - When the user clicks **"Sign & Submit"**, `signAndSubmit()` calls `persist()`.
   - `persist()` executes `createMemo(payload)`. If `createMemo()` successfully creates the draft record on the server, but the subsequent `submitMemo()` call encounters an error (signature, approving officer, or connection delay), the form remains on `/new` with `memoId` still `undefined`.
   - Subsequent clicks on **"Sign & Submit"** or **"Save Draft"** re-trigger `createMemo(payload)` with the exact same reference instead of `updateMemo()`, causing the backend to reject it as a duplicate of the memo just saved.
3. **Visibility Isolation (`MemoVisibilityScope`):**
   - Because memos are restricted to originators, approvers, and recipients, an officer cannot view other memos sharing that reference. This leaves the user with no visible explanation or way to locate the conflicting record.

#### How We Can Solve It
1. **Frontend Active Memo ID Tracking:**
   - Keep a local `activeMemoId` in state inside `MemoFormPage.tsx`. As soon as `persist()` succeeds, record `activeMemoId = saved.id` and switch the form to update mode (`updateMemo`) for subsequent submissions or retries.
   - Disable submission buttons while `isSaving` is active to eliminate duplicate parallel requests.
2. **In-Form Reference Validation & Next Folio Suggestion:**
   - Add debounced on-blur validation for the `reference` field.
   - If a collision occurs on a military reference ending in a folio (e.g., `.../100/58`), offer a smart action button: **"Use Next Folio (.../59)"**.
   - If the collision belongs to the user's own un-submitted draft, offer: *"You have an open draft with this reference. [Open Draft]"*.
3. **Backend Same-User Draft Overwrite:**
   - If the existing memo with that reference is an un-submitted `draft` belonging to the same originator, update that draft rather than throwing a validation exception.

---

### Issue 2: Shipment & Consignment Tracking Missing Item Manifests

#### Problem Identified (from Stakeholder Feedback: Super Admin John Omole)
> *"I mentioned in the tracking we should be able to list out items that are to be tracked with the air waybills or so. We are only seeing air waybills and status, nothing to what item or items it is assigned to. This was not done..."*

In the **Shipment & Consignment Tracking Hub** (`/dashboard/inventory?tab=procurement&subtab=shipments`), operators only see high-level metadata (AWB number, carrier, origin/destination, status stage). There is no visibility into the specific aircraft spares, rotables, or tools packed into each consignment.

#### Why It Happened (System Root Cause)
1. **Shipments Table UX (`ProcurementShipmentsTab.tsx`):**
   - The table's `Purpose & Cargo` column only displays a broad purpose pill and the generic title (`s.title`), completely omitting the names, part numbers, and quantities of the parts being moved.
2. **Consignment Details Modal (`ShipmentDetailsModal.tsx`):**
   - The modal renders carrier details, tracking timeline, and a link to the PO, but contains **no cargo manifest table** listing the parts, NSNs, serials, and quantities assigned to that AWB.
3. **Creation Form Omission (`CreateShipmentModal.tsx`):**
   - For PO-linked shipments, the modal does not let users select which specific PO line items are packed into this specific consignment (especially relevant when orders are split into multiple air shipments).
   - For Standalone Consignments (RTV, MRO repairs, base transfers, emergency AOG parts), there is no manifest item input at all.
4. **Backend Schema & Payload Limitation:**
   - The `shipments` table lacks a dedicated item manifest structure (`cargo_manifest` / `shipment_items`), forcing users to cram descriptions into a free-text `notes` field.

#### How We Can Solve It
1. **Shipment Cargo Manifest Data Structure:**
   - Add a structured item manifest (`cargo_manifest` JSON or `shipment_items` relationship) to `Shipment` supporting:
     * Item Description / Name
     * Part Number (P/N) & Alternate P/N
     * NATO Stock Number (NSN) or Serial Number
     * Quantity & Unit of Measure (UOM)
     * Condition / Remarks (e.g., "Serviceable", "Awaiting Overhaul")
2. **Consignment Creation Modal Upgrade (`CreateShipmentModal.tsx`):**
   - **When Linked to a PO:** Auto-populate items from `purchase_order.items`, allowing operators to check/uncheck items and adjust quantities included in this specific AWB package.
   - **When Standalone (No PO):** Provide an interactive "Add Items to Air Waybill" table allowing technicians to quickly add parts and quantities.
3. **Tracking Hub Table Display (`ProcurementShipmentsTab.tsx`):**
   - Add a visible cargo summary directly in the table row (e.g., `"2 Items: Main Rotor Seal Kit (x2), Fuel Pump (x1)"`) with a quick popover or pill counter.
4. **Comprehensive Consignment Details Modal (`ShipmentDetailsModal.tsx`):**
   - Add a dedicated **"Tracked Cargo Manifest & Aircraft Spares"** section displaying the full breakdown of parts, part numbers, serials, and quantities assigned to that airwaybill.

---

### Issue 3: Maintenance Inventory — Unserviceable Spares Management Module

#### Problem Identified (from Stakeholder Feedback: Capt. Omole)
> *"Maintenance Inventory – Unserviceable Spares Management Module: Add a dedicated Unserviceable Spares Register to the Maintenance Inventory Management System to record, track, and manage aircraft components removed from service."*

Currently, the maintenance system records components installed on active aircraft (`Component` records with `asset_id` and installation dates) and general store balances. However, when a component, rotable, or engine is removed from an airframe (e.g., **NA 010** or **NA 011**), there is no dedicated, auditable register to capture:
- Part Name & Manufacturer Part Number (P/N)
- Component Serial Number (S/N)
- Source Aircraft Registration (`NA 010` / `NA 011`)
- Operating Life Accumulators at Removal:
  * **TSN:** Time Since New
  * **TSO:** Time Since Overhaul
  * **TSI:** Time Since Installation
  * **CSN:** Cycles Since New (where applicable)
  * **CSO:** Cycles Since Overhaul (where applicable)
- Date Removed & Reason for Removal (Defect, scheduled life-limit expiration, premature wear, cannibalization)
- Component Disposition / Quarantine Status (Awaiting R&O / MRO dispatch, Repairable In-House, Scrap / Beyond Economical Repair [BER], Quarantine Inspection)

#### Why It Happened (System Root Cause)
1. **Absence of Dedicated Unserviceable Spares Register:**
   - Removal actions in the system previously detached the component from the aircraft or set a `removed_at` date, but did not transition the component into an active quarantine/unserviceable inventory holding state.
2. **Missing Counter Snapshots at Time of Removal:**
   - Operating hours (TSN, TSO, TSI) and cycle counts (CSN, CSO) were not systematically frozen into an unserviceable ledger row upon removal, risking loss of airworthiness traceability.
3. **Disconnection from Logistics & Consignment Hub:**
   - Unserviceable parts awaiting external repair (R&O) could not be directly selected and dispatched into the **Shipment & Consignment Tracking Hub** (Air Waybill tracking) for vendor delivery.

#### How We Can Solve It
1. **Unserviceable Spares Ledger & Schema:**
   - Create a dedicated database schema and API (`unserviceable_spares` / `component_removals`) capturing:
     * `part_name`, `part_number`, `serial_number`, `asset_id` (aircraft registration), `ata_chapter_id`
     * `tsn_hours`, `tso_hours`, `tsi_hours`, `csn_cycles`, `cso_cycles`
     * `removed_date`, `removed_by_user_id`, `reason_for_removal`, `defect_id` (optional link to logged defect)
     * `disposition_status`: `quarantine`, `awaiting_mro`, `in_repair`, `ber_scrap`, `serviceable_reclaimed`
     * `storage_location` / `quarantine_bay`
     * `airworthiness_tags` / `removal_tag_number`
2. **UI Integration in Maintenance Hub & Inventory:**
   - Add a dedicated **"Unserviceable Spares Register"** tab under both Maintenance Inventory (`TrackerInventoryTab`) and Global Inventory (`/dashboard/inventory`).
   - Include quick filters: All Unserviceable, NA 010, NA 011, Awaiting MRO, Quarantined, Scrapped.
3. **One-Click Dispatch to Consignment / AWB Tracking:**
   - Add an action button on any unserviceable component: **"Create R&O Shipment (AWB)"**, linking directly into the Shipment Tracking Hub so outbound repair shipments carry exact part and serial numbers.

---

### Issue 4: Multi-Segment Operations Display (Command & Control C2 Dashboard)

#### Problem Identified (from Stakeholder Feedback: Capt. Omole)
> *"Additional Feature: Multi-Segment Operations Display (Command Dashboard). Integrate a Multi-Segment Display System into the Nigerian Army Aviation Command Management System. This feature should allow users to divide a single screen into multiple independently configurable panels, enabling simultaneous monitoring of operational, technical, logistical, and administrative information for large monitors, command centres, operations rooms, and individual workstations."*

#### Why It Happened (System Root Cause)
1. **Tab-Isolated Dashboard Architecture:**
   - The current `DashboardPage.tsx` uses a traditional tab-switched model (`Operations`, `Maintenance tracking`, `Finances`, `Inventory`, `Personnel`).
   - In an Operations Room or Command Center setting, switching tabs hides critical real-time information from other domains (e.g., viewing the tactical flight map hides maintenance serviceability and pending approvals).
2. **Fixed Layout Constraints:**
   - Existing pages lack modular, resizable panel segmentation (split-screen / grid system) to support multi-monitor setups, wide command displays, or customizable watch-officer workstations.

#### How We Can Solve It
1. **Multi-Segment Command Grid Engine (C2 Multi-Panel Display):**
   - Build a flexible multi-panel workspace supporting:
     * 2-Panel Split (Horizontal / Vertical)
     * 3-Panel Tri-View
     * 4-Panel Quad Matrix (2x2)
     * 6-Panel Command Wall (3x2)
     * Independent panel controls: **Content Selector**, **Maximize to Fullscreen**, **Minimize**, **Refresh Interval**, and **Drag-to-Swap**.
2. **Modular C2 Display Widgets:**
   Implement the 6 operational display modules requested by Capt. Omole:
   * **Module A: Flight Operations Tracking:** Real-time tactical map, live aircraft positions, tail numbers, flight plan status, route vectors, and ETAs.
   * **Module B: Weather Intelligence:** Live aerodrome search, METAR & TAF feeds, wind speed/direction dials, cloud base, visibility, and severe weather warnings.
   * **Module C: Aircraft Maintenance Status:** Fleet readiness status (NA 010 / NA 011), AOG alerts, open defects, components approaching life limits ($\le 50$h, $\le 100$h), and ongoing work orders.
   * **Module D: Logistics & Inventory:** Serviceable spares inventory, unserviceable spares holding register, outbound/inbound AWB consignments, and critical stock level alerts.
   * **Module E: Mission Planning & Execution:** Scheduled sorties, mission profiles, pilot/crew readiness, and tasking status.
   * **Module F: Command Directives & Approvals:** Pending approval requests, urgent executive correspondence, and priority operational alerts.
3. **Preset Profiles & Full-Screen Ops Room Mode:**
   - Allow duty officers to save and load display presets (e.g., *"Commander Overview"*, *"Flight Line Ops"*, *"Technical Logistics"*).
   - Provide a borderless full-screen kiosk toggle for operations center wall displays.

---

## 13. Verification & Quality Assurance

- **Build Check:** Ran `npx tsc --noEmit` and `npx tsc -b` with 0 compiler errors across the entire frontend codebase.
- **Git Branch Check:** Confirmed target branch is `feature/maintenance` on both Frontend and Backend (never pushed to `main`).





## 14. Phase 4 Implementation: Multi-Segment Operations Display (Command C2 Dashboard)

### Overview
Integrated an operational Multi-Segment Display System into the Nigerian Army Aviation Command Management System. Built specifically as a Command and Control (C2) Operations Display for large wall monitors, operations control rooms, and executive workstations.

### Architecture & Capabilities
1. **Configurable Multi-Segment Layouts:**
   - **2-Split (`split_2`):** Dual high-resolution panels side-by-side.
   - **3-Tri (`tri_3`):** 3-panel split for combined tactical oversight.
   - **4-Quad (`quad_4`):** 2x2 grid layout providing simultaneous real-time views across 4 primary domains.
   - **6-Matrix (`matrix_6`):** Comprehensive 3x2 matrix hosting all 6 operational modules concurrently.
2. **Dynamic Panel Management:**
   - **Module Selector:** In every panel tile, operators can dynamically swap to any of the 6 display modules on the fly via a quick header dropdown.
   - **Maximize / Restore:** 1-click expand button allows any panel to take over 100% of the display area, then cleanly restore back to the active grid.
   - **Fullscreen Kiosk Mode:** Native browser fullscreen mode toggle for wall displays and command center projectors.
   - **Tactical Clocks:** Synchronized dual digital military clocks displaying **Zulu (UTC)**, **Local (WAT)**, and standard military date format (`DD MMM YYYY`).
3. **The 6 Command Display Modules:**
   - **Module A: Flight Operations Tracking (`C2FlightOpsModule`):**
     - Live fleet serviceability badges (NA 010 & NA 011 Bell 412).
     - Active sorties, flight status, departure/destination, ETA, route, and tactical mission telemetry.
   - **Module B: Weather Monitoring & Intel (`C2WeatherModule`):**
     - Direct selector for key military and operational aerodromes: DNAA (Abuja), DNKA (Kaduna Air Base), DNMM (Lagos), DNKN (Kano), DNPO (Port Harcourt), DNEN (Enugu).
     - Live METAR & TAF reports, flight category tags (VFR/IFR), wind vectors, visibility/CAVOK, cloud ceilings, QNH altimeter setting, and live refresh.
   - **Module C: Aircraft Maintenance Status (`C2MaintenanceModule`):**
     - Serviceable vs. Grounded/AOG fleet counters.
     - Urgent component wear monitor: airworthiness life limit items approaching overhaul horizon (≤ 50h / ≤ 100h remaining).
     - Open defects / technical snags and ongoing Work-In-Progress (WIP) work orders.
   - **Module D: Logistics & Spares Inventory (`C2LogisticsModule`):**
     - Available serviceable spares stock counts and reorder threshold alerts.
     - Direct integration with Unserviceable Spares Register (components in stores, awaiting disposition, or sent for external MRO overhaul).
     - Active Air Waybills (AWB) tracker with multi-item cargo manifests.
   - **Module E: Mission Planning & Execution (`C2MissionModule`):**
     - Scheduled Air Tasking Orders (ATO) vs. Active In-Flight sorties.
     - Mission airframe allocation (NA 010 / NA 011) and Pilot-in-Command (PIC) / aircrew taskings.
     - Aircrew readiness and flight progress tracking.
   - **Module F: Command Directives & Approvals (`C2DirectivesModule`):**
     - Executive pending approvals stream (Memos, Purchase Orders, Spares Requisitions, Mission clearances).
     - Official correspondence & memo register with security classification badges (SECRET, CONFIDENTIAL, RESTRICTED).
     - Urgent technical notices and AOG action requirements.

---

## 15. Executive Summary for Commander NAAVN

| # | Item / Feedback | Root Cause / Requirement | Resolution Implemented | Status |
|---|---|---|---|---|
| **1** | **New Memo Reference Collision Error** | Reference string collision with existing draft or sequential numbering collision. | Added real-time reference validation endpoint (`GET /memos/check-reference`), auto-update on same-user draft resubmission, and interactive 1-click **"Use next folio"** button. | **COMPLETE** |
| **2** | **Consignment Tracking Missing Cargo Items** | Shipments table only tracked AWB tracking numbers and carrier status without item manifests. | Added `cargo_manifest` structured JSON schema to backend `shipments` table, interactive cargo item builder in shipment creation, cargo line-item badges in tracking table, and detailed parts manifest in modal. | **COMPLETE** |
| **3** | **Unserviceable Spares Management Register** | Need dedicated register for removed components from NA 010 & NA 011 with airworthiness counters. | Created backend `unserviceable_spares` table, model, and controller with TSN, TSO, TSI, CSN, CSO tracking, reason for removal, and disposition workflow (In Stores, Sent for Repair/Overhaul, Scrapped, Quarantine). Built dedicated register tab in Inventory and Maintenance Tracker. | **COMPLETE** |
| **4** | **Multi-Segment C2 Operations Display** | Single-screen multi-panel workstation display for command center monitoring. | Built C2 Operations Display supporting 2-Split, 3-Tri, 4-Quad, and 6-Matrix layouts with live Zulu/Local clocks, fullscreen mode, and 6 interchangeable modules (Flight Ops, Weather, Maintenance, Logistics, Missions, Directives). | **COMPLETE** |


---

## 16. Security Hardening & Data Breach Mitigation (Completed & Pushed)

| Ref | Domain / Area | Vulnerability Mitigated | Resolution & Commits | Status |
|---|---|---|---|---|
| **SEC-01** | Database Management | Adminer web client open with `'guest'` middleware | Set `'enabled' => false` and restricted middleware to `['auth', 'role:Super Admin']`. | **RESOLVED & PUSHED** |
| **SEC-02** | Operations Intel | `/dashboard/c2` lacked permission guard | Wrapped with `guardWithPermissions(..., STRATEGIC_ROUTE_PERMISSIONS)` and hidden for non-strategic users. | **RESOLVED & PUSHED** |
| **SEC-03** | Maintenance RBAC | `unserviceable-spares` missing from `ApiPermissionRegistry` | Added to `resources()` to ensure complete Spatie permission generation. | **RESOLVED & PUSHED** |
| **SEC-04** | Telemetry Ingestion | Unauthenticated flight telemetry injection (Garmin) | Added pre-shared webhook secret verification (`GARMIN_WEBHOOK_SECRET`), returning 401 on invalid feeds. | **RESOLVED & PUSHED** |
| **SEC-05** | Notification Security | Unauthenticated device token registration (IDOR) | Enforced `$request->user()->id` binding, preventing rogue device association. | **RESOLVED & PUSHED** |
| **SEC-06** | Auth Boundary | Open public account self-registration | Guarded behind `allow_public_registration` flag & `users.create` permission. | **RESOLVED & PUSHED** |
| **SEC-07** | Debug Monitoring | Telescope payload and query logging exposure | Disabled by default in configuration (`TELESCOPE_ENABLED=false`). | **RESOLVED & PUSHED** |
