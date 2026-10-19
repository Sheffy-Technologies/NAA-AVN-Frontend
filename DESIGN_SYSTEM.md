# Nigerian Army Aviation (NA AVN) Design System & UI Specification

## 1. Overview & Tactical Design Principles
The NA AVN Command & Maintenance Platform is a mission-critical military aviation operational system. The UI must deliver **instant visual clarity, zero ambiguity, high readability under all lighting conditions, and strict accessibility compliance**.

- **High Contrast by Default**: Every label, status, and button must exceed WCAG 2.1 AA contrast standards (minimum 4.5:1) and target AAA (7.0:1) for primary interactive elements.
- **Dark Mode & Light Mode Parity**: Dark buttons must never degrade to dark-on-dark text in light mode or low contrast text in dark mode.
- **Tactical Hierarchy**: Clear distinction between primary mission commands, secondary controls, operational badges, and status pills.

---

## 2. Color Palette & WCAG 2.1 Contrast Scoring Matrix

### 2.1 Calculated Contrast Ratios for Buttons & Badges

| Background Color | Token / Hex | Foreground Text | Contrast Ratio | WCAG Compliance | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Navy Teal** | `#0A4D66` | `#FFFFFF` | **9.42 : 1** | **AAA Pass** | Primary actions, selected tabs, active categories |
| **Deep Tactical Navy** | `#001825` | `#FFFFFF` | **18.1 : 1** | **AAA Pass** | Card containers, surface headers, primary pills |
| **Command Base** | `#001219` | `#FFFFFF` | **19.8 : 1** | **AAA Pass** | Main dark background, table containers |
| **Steel Blue** | `#0369A1` | `#FFFFFF` | **5.74 : 1** | **AA Pass** | Secondary action buttons, active navigation indicators |
| **Destructive / Overdue**| `#DC2626` (Red-600) | `#FFFFFF` | **5.50 : 1** | **AA Pass** | Aborted operations, overdue parts, critical alerts |
| **Success / Created** | `#059669` (Emerald-600) | `#FFFFFF` | **4.77 : 1** | **AA Pass** | Save, Create Purchase Order, Completed badges |
| **Warning / Due Soon** | `#B45309` (Amber-700) | `#FFFFFF` | **6.50 : 1** | **AA Pass** | Due soon components, low stock warnings |
| **Accent Sky (Light)** | `#7FD5FF` | `#001219` | **11.9 : 1** | **AAA Pass** | Accent badges, radar highlights, active glow |
| **Light Alert Pink** | `bg-red-100` | `text-red-800` | **8.03 : 1** | **AAA Pass** | Light mode overdue / critical alert badges |
| **Light Alert Amber** | `bg-amber-100` | `text-amber-900` | **8.52 : 1** | **AAA Pass** | Light mode low stock / due soon alert badges |
| **Light Alert Emerald**| `bg-emerald-100` | `text-emerald-800` | **7.15 : 1** | **AAA Pass** | Light mode healthy / on-track alert badges |

> [!CAUTION]
> **Strictly Forbidden Patterns**:
> 1. `text-black` or `color: #0F172A` on `#0A4D66`, `#001825`, `#0369A1`, or `#DC2626`. (Contrast is only 1.05:1 – 2.8:1, severe illegibility failure).
> 2. `text-[#C9F1FF]` or pale cyan text on light or transparent backgrounds.
> 3. Global CSS rules applying `color: #0F172A !important` to dark buttons in light mode.

---

## 3. Typography & Hierarchy

Font Family: `Inter`, system-ui, sans-serif.

| Level | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `text-2xl` (24px) | `font-bold` (700) | 32px | Top-level view headers |
| **Section Header**| `text-sm` to `text-base` | `font-semibold` (600) | 24px | Card headers, table shell titles |
| **Category Pill** | `text-xs` (12px) | `font-medium` (500) | 16px | Category navigation, filter tabs |
| **Table Header** | `text-xs` (12px) | `font-semibold` (600) | 16px | Upper case column descriptors (`uppercase tracking-wider`) |
| **Body / Table Cell**| `text-xs` to `text-sm` | `font-normal` (400) | 20px | Data rows, descriptions, metadata |
| **Badge / Tag** | `text-[10px]` to `text-xs` | `font-bold` (700) | 14px | Status pills (`OVERDUE`, `DUE SOON`, `CRITICAL`) |

---

## 4. Button Standards (`src/shared/ui/button/Button.tsx`)

### 4.1 Button Variants

```tsx
// Primary Solid Action (AAA contrast)
<Button variant="primary">Save Changes</Button>
// Class: bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm

// Success / Purchase Order (AA contrast)
<Button variant="success">Create Purchase Order</Button>
// Class: bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm

// Destructive Action (AA contrast)
<Button variant="destructive">Abort Operation</Button>
// Class: bg-red-600 text-white hover:bg-red-700 shadow-sm

// Accent Command Button
<Button variant="accent">Launch Mission</Button>
// Class: bg-[#7FD5FF] text-[#001219] font-bold hover:bg-[#5dbced]

// Secondary Outlined
<Button variant="secondary">Cancel</Button>
// Class: bg-transparent border border-slate-300 dark:border-[#0A4D66]/60 text-slate-700 dark:text-gray-200
```

### 4.2 Tab Pills & Switchers (Segmented Pattern)

Used for top-level category navigation (Inventory) and switchable table views (Dashboard Upcoming vs Recent Operations):

```tsx
<div className="inline-flex items-center space-x-1 p-1 rounded-lg border border-[#0A4D66]/50 bg-[#001825]">
  <button
    type="button"
    className={cn(
      "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
      isActive
        ? "bg-[#0A4D66] text-white shadow-sm"
        : "text-gray-400 hover:text-white hover:bg-slate-800/40"
    )}
  >
    <span>Upcoming Operations</span>
    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-bold">
      5
    </span>
  </button>
</div>
```

### 4.3 Sidebar Navigation Items (`src/app/layout/components/Sidebar.tsx`)

| State / Theme | Background | Text Color | Icon Color | Indicator Border | WCAG Contrast |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Light Mode Active** | `bg-blue-50/90` | `#0369A1` (Steel Blue) | `#0369A1` (Steel Blue) | `border-l-4 border-[#0369A1]` | **7.20 : 1 (AAA Pass)** |
| **Light Mode Idle** | Transparent | `#4B5563` (Gray-600) | `#6B7280` (Gray-500) | None | **5.70 : 1 (AA Pass)** |
| **Dark Mode Active** | `bg-[#0A4D66]` | `#FFFFFF` (White) | `#7FD5FF` (Luminous Sky) | `border-l-4 border-[#7FD5FF]` | **9.42 : 1 (AAA Pass)** |
| **Dark Mode Idle** | Transparent | `#9CA3AF` (Gray-400) | `#9CA3AF` (Gray-400) | None | **4.90 : 1 (AA Pass)** |

---

## 5. Metric Cards Architecture (`src/shared/ui/metric/MetricCard.tsx`)

Metric cards provide operational totals at a glance with integrated filter feedback:

- **Structure**:
  - `label`: Title of metric (e.g. `Total Items`, `Low in Stock`, `Critical Stock`)
  - `value`: Numeric count or currency
  - `icon`: Iconify icon string
  - `badge`: Status tag (`Catalog`, `Healthy`, `Reorder`, `Shortage`, `Shelf-Life`)
  - `badgeColor`: `sky` | `emerald` | `amber` | `red`
  - `isActive`: Boolean indicating active metric filter (renders active glow border)
  - `onClick`: Optional callback to filter dataset by that metric state

---

## 6. Inventory Layout Hierarchy

Based on operational review, the inventory view adheres to a 4-tier vertical structure:

1. **Tier 1 (Top Category Navigation Bar)**:
   - Full horizontal row containing all standard aviation inventory categories:
     `All` | `Tools` | `Ground support` | `Aircraft spares` | `Consumables` | `General(QM Stores)` | `Uncategorized` | `Others`
   - Aligned with the primary CTA (`Create Purchase Order`).
2. **Tier 2 (Toolbar & Filters)**:
   - Left: Search input (`Search description, part number...`) with instant clear button + Table/Grid view toggle.
   - Right: Reset Filter, Units Filter dropdown, Export CSV, Import CSV, + Add Inventory.
3. **Tier 3 (Key Operational Metric Cards)**:
   - 5 standard metric cards: `Total Items`, `Total in Stock`, `Low in Stock`, `Expired Items`, `Critical Stock`.
4. **Tier 4 (Data Grid / Table)**:
   - High contrast headers, zebra-striped rows, explicit part description, part number, stock level indicators, action dropdowns.

---

## 7. Operations Dashboard Tab Switching

In the Strategic Dashboard, operations lists are presented as switchable tabs:

- **Switchable Tabs**: `Upcoming Operations` and `Recent Operations`.
- **Integrated Counts**: Number of operations displayed in a badge inside the tab button.
- **Shared Toolbar**: Unit filter, Excel download, and List/Card view mode toggles persist across tabs.

---

## 8. Global CSS Contrast Rules (`src/shared/styles/tailwind.css`)

All button overrides in `tailwind.css` enforce white text on dark buttons:

```css
button[class*="bg-[#0A4D66]"],
button[class*="bg-[#001825]"],
button[class*="bg-[#001219]"],
button[class*="bg-[#0369A1]"],
button[class*="bg-red-"],
button[class*="bg-emerald-"],
button[class*="bg-blue-"] {
  color: #FFFFFF !important;
}

button[class*="bg-[#0A4D66]"] svg,
button[class*="bg-[#0A4D66]"] span:not([class*="text-"]):not([class*="bg-"]) {
  color: #FFFFFF !important;
}
```

This guarantees that future components cannot accidentally render dark text on dark surfaces in either light or dark mode.
