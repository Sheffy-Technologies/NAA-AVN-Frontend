import { useMemo, useState, useEffect, type ChangeEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { BackButton, CancelButton } from "@/shared/ui/button";
import { MultiSelect, type MultiSelectOption } from "@/shared/ui/multi-select/MultiSelect";
import {
  useCreateInventoryMutation,
  useGetExpenseCategoriesQuery,
  useGetInventoryByIdQuery,
  useUpdateInventoryMutation,
  useGetStoresQuery,
  useGetCurrenciesQuery,
  useGetAtaChaptersQuery,
  useGetSuppliersQuery,
  type InventoryItem,
} from "@/features/inventory/api";
import { useGetUnitsQuery, type Unit } from "@/shared/api/units";
import { useGetAssetTypesQuery } from "@/features/assets/api";
import { formatCategoryName, extractAtaCode } from "@/features/inventory/inventoryUtils";
import { AircraftSparePartsForm } from "../components/AircraftSparePartsForm";

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 1, name: "Aircraft spares", description: null },
  { id: 5, name: "Minor spare", description: null },
  { id: 2, name: "Consumables", description: null },
  { id: 3, name: "Ground support", description: null },
  { id: 4, name: "General(Qm Stores)", description: null },
];

const UNIT_OF_ISSUE_OPTIONS = [
  { value: "EA", label: "EA - Each" },
  { value: "SET", label: "SET - Set" },
  { value: "KIT", label: "KIT - Kit" },
  { value: "ASSY", label: "ASSY - Assembly" },
  { value: "PKG", label: "PKG - Package" },
  { value: "BX", label: "BX - Box" },
  { value: "RL", label: "RL - Roll" },
  { value: "PR", label: "PR - Pair" },
  { value: "LTR", label: "LTR - Liter" },
  { value: "KG", label: "KG - Kilogram" },
  { value: "MTR", label: "MTR - Meter" },
  { value: "FT", label: "FT - Feet" },
  { value: "GL", label: "GL - Gallon" },
  { value: "CAN", label: "CAN - Can" },
  { value: "DRUM", label: "DRUM - Drum" },
  { value: "TUBE", label: "TUBE - Tube" },
];

const SPECIAL_STORAGE_OPTIONS = [
  { value: "standard", label: "Standard Warehouse Storage" },
  { value: "bonded", label: "Bonded Store (Customs Controlled)" },
  { value: "quarantine", label: "Quarantine / Inspection Hold" },
  { value: "flammable", label: "Flammable Liquid / Combustible Locker" },
  { value: "cold_storage", label: "Cold Storage / Refrigerated" },
  { value: "esd_sensitive", label: "ESD Sensitive (Electrostatic Discharge)" },
  { value: "hazmat", label: "Hazardous Materials (HAZMAT)" },
  { value: "rubber", label: "Rubber & Elastomer Controlled Environment" },
  { value: "high_security", label: "High Security / Armory Vault" },
  { value: "others", label: "Other Specialized Storage" },
];

const METRIC_OPTIONS: MultiSelectOption[] = [
  { value: "hours", label: "Hours (Flight / Operating)" },
  { value: "cycles", label: "Cycles (Takeoff / Landing)" },
  { value: "calendar", label: "Calendar (Date / Duration)" },
];

type FormMode = "create" | "edit";

type StockType =
  | "bonded"
  | "quarantine"
  | "flammable"
  | "rubber"
  | "others";

export type FormSerializedUnit = {
  id?: number;
  unit_index: number;
  serial_number: string;
  cage_code: string;
  part_number: string;
  nsn: string;
  alternate_support_part_no: string;
  ata_chapter?: string;
  ata_chapter_id?: number | "";
};

export type InventoryFormValues = {
  store: StockType;
  store_id: number | "";
  asset_id: number | "";
  expense_category_id: number | "";
  unit_id: number | "";
  description: string;
  // Master part identification
  serial_number: string;
  part_number: string;
  cage_code: string;
  nsn: string;
  alternate_support_part_no: string;
  batch_number: string;
  lot_number: string;
  calibration_due_date: string;
  calibration_interval_days: string;
  ata_chapter: string;
  ata_chapter_id: number | "";
  // Quantitative & Commercial
  current_stock: string;
  re_order_level: string;
  unit_cost: string;
  currency_id: number | "";
  unit_of_issue: string;
  lead_time_days: string;
  lead_time_unit: "days" | "weeks" | "months";
  manufacturer: string;
  supplier_id: number | "";
  special_storage: string;
  // Shelf Life (multi-select + conditional calendar interval)
  shelf_life_types: string[];
  shelf_life_hours: string;
  shelf_life_cycles: string;
  shelf_life_calendar_interval: "daily" | "monthly" | "yearly";
  shelf_life_calendar_value: string;
  // Life Limit (multi-select + conditional calendar interval)
  life_limit_types: string[];
  life_limit_hours: string;
  life_limit_cycles: string;
  life_limit_calendar_interval: "daily" | "monthly" | "yearly";
  life_limit_calendar_value: string;
  // Dynamic per-unit serialization array (Aircraft Spares)
  units: FormSerializedUnit[];
  measurement_unit: string;
  expiry_date: string;
  date_received: string;
  remark: string;
};

const emptyFormValues: InventoryFormValues = {
  store: "others",
  store_id: "",
  asset_id: "",
  expense_category_id: 1, // Default to Aircraft Spares or first category
  unit_id: "",
  description: "",
  serial_number: "",
  part_number: "",
  cage_code: "",
  nsn: "",
  alternate_support_part_no: "",
  batch_number: "",
  lot_number: "",
  calibration_due_date: "",
  calibration_interval_days: "",
  ata_chapter: "",
  ata_chapter_id: "",
  current_stock: "1",
  re_order_level: "1",
  unit_cost: "",
  currency_id: "",
  unit_of_issue: "EA",
  lead_time_days: "",
  lead_time_unit: "days",
  manufacturer: "",
  supplier_id: "",
  special_storage: "standard",
  shelf_life_types: [],
  shelf_life_hours: "",
  shelf_life_cycles: "",
  shelf_life_calendar_interval: "monthly",
  shelf_life_calendar_value: "",
  life_limit_types: [],
  life_limit_hours: "",
  life_limit_cycles: "",
  life_limit_calendar_interval: "monthly",
  life_limit_calendar_value: "",
  units: [
    {
      unit_index: 1,
      serial_number: "",
      cage_code: "",
      part_number: "",
      nsn: "",
      alternate_support_part_no: "",
      ata_chapter: "",
      ata_chapter_id: "",
    },
  ],
  measurement_unit: "EA",
  expiry_date: "",
  date_received: "",
  remark: "",
};

const mapItemToFormValues = (item: InventoryItem): InventoryFormValues => {
  const itemAtaCode = extractAtaCode(item.ata_chapter || item.ata_chapter_rel);
  const itemAtaId =
    item.ata_chapter_id ??
    (typeof item.ata_chapter === "object" && item.ata_chapter !== null
      ? (item.ata_chapter as { id?: number }).id ?? ""
      : "");

  const parsedUnits: FormSerializedUnit[] =
    item.units && item.units.length > 0
      ? item.units.map((u, idx) => ({
          id: u.id,
          unit_index: u.unit_index || idx + 1,
          serial_number: u.serial_number || "",
          cage_code: u.cage_code || item.cage_code || "",
          part_number: u.part_number || item.part_number || "",
          nsn: u.nsn || item.nsn || "",
          alternate_support_part_no:
            u.alternate_support_part_no ||
            item.alternate_support_part_no ||
            "",
          ata_chapter: extractAtaCode((u as { ata_chapter?: unknown }).ata_chapter) || itemAtaCode,
          ata_chapter_id: (u as { ata_chapter_id?: number | "" }).ata_chapter_id ?? itemAtaId,
        }))
      : [
          {
            unit_index: 1,
            serial_number: item.serial_number || "",
            cage_code: item.cage_code || "",
            part_number: item.part_number || "",
            nsn: item.nsn || item.nsn_number || "",
            alternate_support_part_no: item.alternate_support_part_no || "",
            ata_chapter: itemAtaCode,
            ata_chapter_id: itemAtaId,
          },
        ];

  return {
    store:
      item.store === "bonded" ||
      item.store === "quarantine" ||
      item.store === "flammable" ||
      item.store === "rubber" ||
      item.store === "others"
        ? item.store
        : "others",
    store_id: item.store_id ?? "",
    asset_id: item.asset_id ?? "",
    expense_category_id: item.expense_category_id ?? 1,
    unit_id: item.unit_id ?? "",
    description: item.description ?? "",
    serial_number: item.serial_number ?? "",
    part_number: item.part_number ?? "",
    cage_code: item.cage_code ?? "",
    nsn: item.nsn ?? item.nsn_number ?? "",
    alternate_support_part_no: item.alternate_support_part_no ?? "",
    batch_number: item.batch_number ?? "",
    lot_number: item.lot_number ?? "",
    calibration_due_date: item.calibration_due_date ?? "",
    calibration_interval_days: item.calibration_interval_days
      ? String(item.calibration_interval_days)
      : "",
    ata_chapter: itemAtaCode,
    ata_chapter_id: itemAtaId,
    current_stock: String(item.current_stock ?? parsedUnits.length ?? "1"),
    re_order_level: String(item.re_order_level ?? "1"),
    unit_cost: String(item.unit_cost ?? ""),
    currency_id: item.currency_id ?? "",
    unit_of_issue: item.unit_of_issue || "EA",
    lead_time_days: item.lead_time_days ? String(item.lead_time_days) : "",
    lead_time_unit: (item.lead_time_unit as "days" | "weeks" | "months") || "days",
    manufacturer: item.manufacturer ?? "",
    supplier_id: item.supplier_id ?? "",
    special_storage: item.special_storage || "standard",
    shelf_life_types: Array.isArray(item.shelf_life_types)
      ? item.shelf_life_types
      : [],
    shelf_life_hours: item.shelf_life_hours ? String(item.shelf_life_hours) : "",
    shelf_life_cycles: item.shelf_life_cycles
      ? String(item.shelf_life_cycles)
      : "",
    shelf_life_calendar_interval:
      (item.shelf_life_calendar_interval as "daily" | "monthly" | "yearly") ||
      "monthly",
    shelf_life_calendar_value: item.shelf_life_calendar_value
      ? String(item.shelf_life_calendar_value)
      : "",
    life_limit_types: Array.isArray(item.life_limit_types)
      ? item.life_limit_types
      : [],
    life_limit_hours: item.life_limit_hours ? String(item.life_limit_hours) : "",
    life_limit_cycles: item.life_limit_cycles
      ? String(item.life_limit_cycles)
      : "",
    life_limit_calendar_interval:
      (item.life_limit_calendar_interval as "daily" | "monthly" | "yearly") ||
      "monthly",
    life_limit_calendar_value: item.life_limit_calendar_value
      ? String(item.life_limit_calendar_value)
      : "",
    units: parsedUnits,
    measurement_unit: item.measurement_unit || "EA",
    expiry_date: item.expiry_date ?? "",
    date_received: item.date_received ?? "",
    remark: item.remark ?? "",
  };
};

type InventoryFormContentProps = {
  mode: FormMode;
  inventory: InventoryItem | null;
  units: Unit[] | undefined;
  categories:
    | Array<{ id: number; name: string; description: string | null }>
    | undefined;
  isUnitsLoading: boolean;
  isCategoriesLoading: boolean;
  onBack: () => void;
  createInventory: ReturnType<typeof useCreateInventoryMutation>[0];
  updateInventory: ReturnType<typeof useUpdateInventoryMutation>[0];
  id: string | undefined;
  isSubmitting: boolean;
};

const inputClasses =
  "w-full rounded-md px-3 py-2 text-xs sm:text-sm outline-none transition-colors " +
  "bg-white dark:bg-[#001825] text-slate-900 dark:text-white " +
  "border border-slate-300 dark:border-[#0A4D66]/40 " +
  "placeholder:text-slate-400 dark:placeholder:text-gray-500 " +
  "focus:border-[#0369A1] dark:focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#0369A1]/20 dark:focus:ring-[#7FD5FF]/30";

const selectClasses =
  "w-full rounded-md px-3 py-2 text-xs sm:text-sm outline-none appearance-none transition-colors " +
  "bg-white dark:bg-[#001825] text-slate-900 dark:text-white " +
  "border border-slate-300 dark:border-[#0A4D66]/40 " +
  "focus:border-[#0369A1] dark:focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#0369A1]/20 dark:focus:ring-[#7FD5FF]/30";

const labelClasses =
  "block text-[11px] uppercase font-semibold text-slate-600 dark:text-gray-300 mb-1 tracking-wide";

const InventoryFormContent = ({
  mode,
  inventory,
  units: orgUnits = [],
  categories,
  isUnitsLoading,
  isCategoriesLoading,
  onBack,
  createInventory,
  updateInventory,
  id,
  isSubmitting,
}: InventoryFormContentProps) => {
  const [searchParams] = useSearchParams();
  const urlStoreId = searchParams.get("store_id");

  const { data: stores = [], isLoading: isStoresLoading } = useGetStoresQuery();
  const { data: currencies = [], isLoading: isCurrenciesLoading } =
    useGetCurrenciesQuery();
  const { data: ataChapters = [], isLoading: isAtaLoading } =
    useGetAtaChaptersQuery();
  const { data: suppliers = [], isLoading: isSuppliersLoading } =
    useGetSuppliersQuery();
  const { data: assetTypes = [], isLoading: isAssetTypesLoading } =
    useGetAssetTypesQuery();

  const initialValues =
    mode === "edit" && inventory
      ? mapItemToFormValues(inventory)
      : emptyFormValues;

  const [values, setValues] = useState<InventoryFormValues>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof InventoryFormValues, string>>
  >({});
  const [unitErrors, setUnitErrors] = useState<Record<number, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkSerialsText, setBulkSerialsText] = useState("");
  const [requiresSerialTracking, setRequiresSerialTracking] = useState<boolean | null>(() => {
    if (mode === "edit" && inventory) {
      return Boolean(
        inventory.serial_number ||
        (inventory.units && inventory.units.length > 0 && inventory.units.some((u) => u.serial_number))
      );
    }
    return null;
  });

  // Dynamic Category Classification
  const allCategories = useMemo(
    () => (categories && categories.length > 0 ? categories : DEFAULT_EXPENSE_CATEGORIES),
    [categories],
  );

  const selectedCategory = useMemo(() => {
    return allCategories.find((c) => c.id === Number(values.expense_category_id));
  }, [allCategories, values.expense_category_id]);

  const categoryName = (selectedCategory?.name || "").toLowerCase();

  // Category profiles
  const isMinorSpare = categoryName.includes("minor");
  const isConsumable = categoryName.includes("consumable");
  const isGroundSupport = categoryName.includes("ground support");
  const isGeneralQM = categoryName.includes("general") || categoryName.includes("qm");
  const isAircraftSpare = !isMinorSpare && !isConsumable && !isGroundSupport && !isGeneralQM;

  const pageTitle = mode === "create" ? "Add Stock" : "Edit Stock";
  const primaryButtonLabel = mode === "create" ? "Save Stock" : "Save Changes";

  // Auto-default Store to "General Store"
  useEffect(() => {
    if (mode === "create" && values.store_id === "" && stores.length > 0) {
      if (urlStoreId) {
        const found = stores.find((s) => String(s.id) === urlStoreId);
        if (found) {
          setValues((prev) => ({ ...prev, store_id: found.id }));
          return;
        }
      }
      const generalStore = stores.find(
        (s) => s.code === "GEN-STR" || s.name.toLowerCase().includes("general"),
      );
      const defaultStore = generalStore || stores[0];
      if (defaultStore) {
        setValues((prev) => ({ ...prev, store_id: defaultStore.id }));
      }
    }
  }, [mode, stores, urlStoreId, values.store_id]);

  // Auto-default Unit to "HQ" (Headquarter)
  useEffect(() => {
    if (mode === "create" && values.unit_id === "" && orgUnits.length > 0) {
      const hqUnit = orgUnits.find(
        (u) =>
          u.name.toUpperCase().includes("HQ") ||
          u.name.toLowerCase().includes("headquarter"),
      );
      const defaultUnit = hqUnit || orgUnits[0];
      if (defaultUnit) {
        setValues((prev) => ({ ...prev, unit_id: defaultUnit.id }));
      }
    }
  }, [mode, orgUnits, values.unit_id]);

  // Auto-default Currency to NGN / default currency
  useEffect(() => {
    if (values.currency_id === "" && currencies.length > 0) {
      const defaultCurr =
        currencies.find((c) => (c as { is_default?: boolean }).is_default) ||
        currencies.find((c) => c.code === "NGN") ||
        currencies.find((c) => c.code === "USD") ||
        currencies[0];
      if (defaultCurr) {
        setValues((prev) => ({ ...prev, currency_id: defaultCurr.id }));
      }
    }
  }, [currencies, values.currency_id]);

  // Real-time intra-batch duplicate serial number detection (Aircraft Spares only)
  const duplicateSerialSet = useMemo(() => {
    if (!isAircraftSpare) return new Set<string>();
    const counts = new Map<string, number>();
    values.units.forEach((u) => {
      const s = u.serial_number.trim().toLowerCase();
      if (s) {
        counts.set(s, (counts.get(s) || 0) + 1);
      }
    });
    const duplicates = new Set<string>();
    counts.forEach((count, s) => {
      if (count > 1) duplicates.add(s);
    });
    return duplicates;
  }, [values.units, isAircraftSpare]);

  // Automatically ensure values.units count matches quantity when in Aircraft Spares mode
  useEffect(() => {
    if (!isAircraftSpare) return;
    const count = parseInt(values.current_stock, 10);
    if (isNaN(count) || count < 1) return;
    const clamped = Math.min(count, 500);

    setValues((prev) => {
      if (prev.units.length === clamped) return prev;
      if (prev.units.length < clamped) {
        const added: FormSerializedUnit[] = [];
        for (let i = prev.units.length; i < clamped; i++) {
          added.push({
            unit_index: i + 1,
            serial_number: "",
            cage_code: prev.cage_code || "",
            part_number: prev.part_number || "",
            nsn: prev.nsn || "",
            alternate_support_part_no: prev.alternate_support_part_no || "",
          });
        }
        return {
          ...prev,
          units: [...prev.units, ...added],
        };
      } else {
        return {
          ...prev,
          units: prev.units.slice(0, clamped).map((u, i) => ({
            ...u,
            unit_index: i + 1,
          })),
        };
      }
    });
  }, [isAircraftSpare, values.current_stock]);

  // Synchronize unit count whenever current_stock changes (Aircraft Spares only)
  const handleQuantityChange = (qtyStr: string) => {
    setValues((prev) => {
      const count = parseInt(qtyStr, 10);
      if (isNaN(count) || count < 1) {
        return {
          ...prev,
          current_stock: qtyStr,
        };
      }

      if (!isAircraftSpare) {
        // Non-serialized categories just update the scalar quantity
        return {
          ...prev,
          current_stock: qtyStr,
        };
      }

      const clamped = Math.min(count, 500); // Guard max batch size
      const currentUnits = [...prev.units];

      if (currentUnits.length < clamped) {
        // Expand
        const added: FormSerializedUnit[] = [];
        for (let i = currentUnits.length; i < clamped; i++) {
          added.push({
            unit_index: i + 1,
            serial_number: "",
            cage_code: prev.cage_code || "",
            part_number: prev.part_number || "",
            nsn: prev.nsn || "",
            alternate_support_part_no: prev.alternate_support_part_no || "",
          });
        }
        return {
          ...prev,
          current_stock: String(clamped),
          units: [...currentUnits, ...added],
        };
      } else if (currentUnits.length > clamped) {
        // Trim
        return {
          ...prev,
          current_stock: String(clamped),
          units: currentUnits.slice(0, clamped).map((u, i) => ({
            ...u,
            unit_index: i + 1,
          })),
        };
      }

      return {
        ...prev,
        current_stock: qtyStr,
      };
    });
    setErrors((prev) => ({ ...prev, current_stock: undefined }));
  };

  const handleChange =
    (field: keyof InventoryFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  // Update specific serialized unit in the matrix (Aircraft Spares)
  const handleUnitFieldChange = (
    index: number,
    field: keyof FormSerializedUnit,
    val: string,
  ) => {
    setValues((prev) => {
      const nextUnits = [...prev.units];
      if (nextUnits[index]) {
        nextUnits[index] = { ...nextUnits[index], [field]: val };
      }
      return { ...prev, units: nextUnits };
    });
    setUnitErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  // Auto-fill master specifications to all unit rows (Aircraft Spares)
  const handleAutoFillUnits = () => {
    setValues((prev) => ({
      ...prev,
      units: prev.units.map((u) => ({
        ...u,
        part_number: u.part_number || prev.part_number,
        cage_code: u.cage_code || prev.cage_code,
        nsn: u.nsn || prev.nsn,
        alternate_support_part_no:
          u.alternate_support_part_no || prev.alternate_support_part_no,
      })),
    }));
  };

  // Auto-generate sequential serial numbers (Aircraft Spares)
  const handleAutoSequenceSerials = () => {
    const basePrefix = values.serial_number.trim()
      ? values.serial_number.trim().replace(/[-_0-9]+$/, "")
      : values.part_number.trim()
        ? values.part_number.trim()
        : "SN";
    const prefix = basePrefix || "SN";
    setValues((prev) => ({
      ...prev,
      units: prev.units.map((u, idx) => ({
        ...u,
        serial_number: `${prefix}-${String(idx + 1).padStart(3, "0")}`,
      })),
    }));
  };

  // Add another unit row dynamically
  const handleAddUnit = () => {
    setValues((prev) => {
      const nextCount = prev.units.length + 1;
      const newUnit: FormSerializedUnit = {
        unit_index: nextCount,
        serial_number: "",
        cage_code: prev.cage_code || "",
        part_number: prev.part_number || "",
        nsn: prev.nsn || "",
        alternate_support_part_no: prev.alternate_support_part_no || "",
      };
      return {
        ...prev,
        current_stock: String(nextCount),
        units: [...prev.units, newUnit],
      };
    });
  };

  // Remove specific unit row
  const handleRemoveUnit = (indexToRemove: number) => {
    setValues((prev) => {
      if (prev.units.length <= 1) return prev;
      const nextUnits = prev.units
        .filter((_, idx) => idx !== indexToRemove)
        .map((u, i) => ({ ...u, unit_index: i + 1 }));
      return {
        ...prev,
        current_stock: String(nextUnits.length),
        units: nextUnits,
      };
    });
    setUnitErrors((prev) => {
      const next = { ...prev };
      delete next[indexToRemove];
      return next;
    });
  };

  // Apply bulk pasted serial numbers
  const handleApplyBulkSerials = () => {
    const lines = bulkSerialsText
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setIsBulkPasteOpen(false);
      return;
    }

    setValues((prev) => {
      const targetCount = Math.max(lines.length, prev.units.length);
      const nextUnits: FormSerializedUnit[] = [];
      for (let i = 0; i < targetCount; i++) {
        const existing = prev.units[i];
        nextUnits.push({
          unit_index: i + 1,
          serial_number: lines[i] || existing?.serial_number || "",
          cage_code: existing?.cage_code || prev.cage_code || "",
          part_number: existing?.part_number || prev.part_number || "",
          nsn: existing?.nsn || prev.nsn || "",
          alternate_support_part_no:
            existing?.alternate_support_part_no || prev.alternate_support_part_no || "",
        });
      }
      return {
        ...prev,
        current_stock: String(nextUnits.length),
        units: nextUnits,
      };
    });
    setIsBulkPasteOpen(false);
    setBulkSerialsText("");
  };

  const isFormDirty = useMemo(() => {
    if (mode === "create") {
      return Boolean(
        values.part_number.trim() ||
        values.serial_number.trim() ||
        values.cage_code.trim() ||
        values.nsn.trim() ||
        values.batch_number.trim() ||
        values.lot_number.trim() ||
        values.alternate_support_part_no.trim() ||
        values.description.trim() ||
        (isAircraftSpare && values.units.some((u) => u.serial_number.trim())) ||
        values.current_stock !== "1" ||
        requiresSerialTracking !== null,
      );
    }
    return true;
  }, [mode, values, isAircraftSpare, requiresSerialTracking]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof InventoryFormValues, string>> = {};
    const newUnitErrors: Record<number, string> = {};

    if (!values.part_number.trim()) {
      newErrors.part_number = "Part / Item Number is required";
    }

    if (!values.store_id) {
      newErrors.store_id = "Assigned store is required";
    }

    const qty = parseInt(values.current_stock, 10);
    if (isNaN(qty) || qty < 1) {
      newErrors.current_stock = "Quantity must be at least 1";
    }

    // Aircraft Spares Validation
    if (isAircraftSpare) {
      if (!values.description.trim()) {
        newErrors.description = "Part Name / Description is required";
      }

      if (requiresSerialTracking === null) {
        newErrors.serial_number =
          "Please specify whether this component requires serial-number tracking.";
      } else if (requiresSerialTracking === true) {
        values.units.forEach((u, idx) => {
          const s = u.serial_number.trim();
          if (!s) {
            newUnitErrors[idx] = `Serial No is required for Unit #${idx + 1}`;
          } else if (duplicateSerialSet.has(s.toLowerCase())) {
            newUnitErrors[idx] = `Duplicate Serial No "${s}"`;
          }
        });

        if (duplicateSerialSet.size > 0) {
          newErrors.serial_number = "Duplicate serial numbers found in batch.";
        }
      }
    }

    setErrors(newErrors);
    setUnitErrors(newUnitErrors);
    return Object.keys(newErrors).length === 0 && Object.keys(newUnitErrors).length === 0;
  };

  const handleSubmitInternal = async (exitAfter: boolean) => {
    setSubmitError(null);
    if (!validate()) {
      setSubmitError("Please correct the highlighted errors before saving.");
      return;
    }

    const currentStockNumeric = parseInt(values.current_stock, 10) || 1;
    const unitCostNumeric = values.unit_cost.trim().length > 0 ? Number(values.unit_cost) : 0;
    const reOrderNumeric = values.re_order_level.trim().length > 0 ? Number(values.re_order_level) : 1;

    const computedAssetId =
      values.asset_id === "" ? null : Number(values.asset_id);

    const selectedCurrency = currencies.find(
      (c) => c.id === Number(values.currency_id),
    );

    const selectedAta = ataChapters.find(
      (a) => a.id === Number(values.ata_chapter_id),
    );

    const isSerializedActive = isAircraftSpare ? requiresSerialTracking === true : false;

    const primarySerial = isSerializedActive
      ? values.units[0]?.serial_number?.trim() || values.serial_number.trim() || null
      : null;
    const primaryPart = values.part_number.trim();

    // Prepare units payload: only send serialized units if this is an aircraft spare AND serial tracking is enabled
    const unitsPayload = isSerializedActive
      ? values.units.map((u, idx) => ({
          id: u.id,
          unit_index: idx + 1,
          serial_number: u.serial_number.trim(),
          cage_code: u.cage_code?.trim() || values.cage_code.trim() || null,
          part_number: u.part_number?.trim() || primaryPart,
          nsn: u.nsn?.trim() || values.nsn.trim() || null,
          ata_chapter: u.ata_chapter?.trim() || selectedAta?.code || values.ata_chapter.trim() || null,
          ata_chapter_id: u.ata_chapter_id ? Number(u.ata_chapter_id) : (values.ata_chapter_id === "" ? null : Number(values.ata_chapter_id)),
          alternate_support_part_no:
            u.alternate_support_part_no?.trim() ||
            values.alternate_support_part_no.trim() ||
            null,
          status: "available",
          store_id: values.store_id === "" ? null : Number(values.store_id),
          unit_id: values.unit_id === "" ? null : Number(values.unit_id),
        }))
      : [];

    const basePayload = {
      store: values.store,
      store_id: values.store_id === "" ? null : Number(values.store_id),
      asset_id: computedAssetId,
      expense_category_id:
        values.expense_category_id === ""
          ? null
          : Number(values.expense_category_id),
      unit_id: values.unit_id === "" ? null : Number(values.unit_id),
      serial_number: primarySerial,
      part_number: primaryPart,
      cage_code: values.cage_code.trim() || null,
      nsn: values.nsn.trim() || null,
      alternate_support_part_no:
        values.alternate_support_part_no.trim() || null,
      batch_number: values.batch_number.trim() || null,
      lot_number: values.lot_number.trim() || null,
      calibration_due_date: values.calibration_due_date || null,
      calibration_interval_days: values.calibration_interval_days
        ? Number(values.calibration_interval_days)
        : null,
      ata_chapter: selectedAta?.code || values.ata_chapter.trim() || null,
      ata_chapter_id:
        values.ata_chapter_id === "" ? null : Number(values.ata_chapter_id),
      current_stock: currentStockNumeric,
      re_order_level: reOrderNumeric,
      unit_cost: unitCostNumeric,
      currency_id:
        values.currency_id === "" ? null : Number(values.currency_id),
      currency_code: selectedCurrency?.code || null,
      measurement_unit: values.unit_of_issue || "EA",
      unit_of_issue: values.unit_of_issue || null,
      lead_time_days: values.lead_time_days
        ? Number(values.lead_time_days)
        : null,
      lead_time_unit: values.lead_time_unit || "days",
      manufacturer: values.manufacturer.trim() || null,
      supplier_id:
        values.supplier_id === "" ? null : Number(values.supplier_id),
      special_storage: values.special_storage || null,
      is_serialized: isSerializedActive,
      shelf_life_types:
        values.shelf_life_types.length > 0 ? values.shelf_life_types : null,
      shelf_life_hours:
        isAircraftSpare && values.shelf_life_types.includes("hours") && values.shelf_life_hours
          ? Number(values.shelf_life_hours)
          : null,
      shelf_life_cycles:
        isAircraftSpare && values.shelf_life_types.includes("cycles") && values.shelf_life_cycles
          ? Number(values.shelf_life_cycles)
          : null,
      shelf_life_calendar_interval: values.shelf_life_types.includes("calendar")
        ? values.shelf_life_calendar_interval
        : null,
      shelf_life_calendar_value:
        values.shelf_life_types.includes("calendar") &&
        values.shelf_life_calendar_value
          ? Number(values.shelf_life_calendar_value)
          : null,
      shelf_life_start_date: values.shelf_life_types.length > 0 ? new Date().toISOString() : null,
      life_limit_types:
        isAircraftSpare && values.life_limit_types.length > 0 ? values.life_limit_types : null,
      life_limit_hours:
        isAircraftSpare && values.life_limit_types.includes("hours") && values.life_limit_hours
          ? Number(values.life_limit_hours)
          : null,
      life_limit_cycles:
        isAircraftSpare && values.life_limit_types.includes("cycles") && values.life_limit_cycles
          ? Number(values.life_limit_cycles)
          : null,
      life_limit_calendar_interval:
        isAircraftSpare && values.life_limit_types.includes("calendar")
          ? values.life_limit_calendar_interval
          : null,
      life_limit_calendar_value:
        isAircraftSpare &&
        values.life_limit_types.includes("calendar") &&
        values.life_limit_calendar_value
          ? Number(values.life_limit_calendar_value)
          : null,
      units: unitsPayload,
      expiry_date: values.expiry_date.trim() || null,
      date_received: values.date_received.trim() || null,
      remark: values.remark.trim(),
      description: values.description.trim(),
    };

    try {
      if (mode === "create") {
        await createInventory(basePayload).unwrap();
      } else if (id) {
        await updateInventory({ id, body: basePayload }).unwrap();
      }

      if (exitAfter) {
        onBack();
      } else if (mode === "create") {
        setValues(emptyFormValues);
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { data?: { message?: string } })?.data?.message ||
        "Failed to save inventory item. Please verify all fields.";
      setSubmitError(errorMsg);
    }
  };

  const selectedCurrencySymbol = useMemo(() => {
    const found = currencies.find((c) => c.id === Number(values.currency_id));
    if (!found) return "₦";
    if (found.code === "NGN") return "₦";
    if (found.code === "USD") return "$";
    if (found.code === "EUR") return "€";
    if (found.code === "GBP") return "£";
    return found.symbol || found.code || "₦";
  }, [currencies, values.currency_id]);

  if (isAircraftSpare) {
    return (
      <AircraftSparePartsForm
        mode={mode}
        values={values}
        setValues={setValues}
        errors={errors}
        setErrors={setErrors}
        unitErrors={unitErrors}
        setUnitErrors={setUnitErrors}
        stores={stores}
        isStoresLoading={isStoresLoading}
        units={orgUnits}
        isUnitsLoading={isUnitsLoading}
        categories={allCategories}
        isCategoriesLoading={isCategoriesLoading}
        ataChapters={ataChapters}
        isAtaLoading={isAtaLoading}
        currencies={currencies}
        isCurrenciesLoading={isCurrenciesLoading}
        suppliers={suppliers}
        isSuppliersLoading={isSuppliersLoading}
        assetTypes={assetTypes}
        isAssetTypesLoading={isAssetTypesLoading}
        onSubmit={handleSubmitInternal}
        isSubmitting={isSubmitting}
        submitError={submitError}
        setSubmitError={setSubmitError}
        onBack={onBack}
        isFormDirty={isFormDirty}
        requiresSerialTracking={requiresSerialTracking}
        setRequiresSerialTracking={setRequiresSerialTracking}
      />
    );
  }

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {pageTitle}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CancelButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} label="Cancel" size="md" />
          <button
            type="button"
            onClick={() => handleSubmitInternal(true)}
            disabled={isSubmitting}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0369A1] hover:bg-[#025682] text-white shadow-sm transition-colors",
              isSubmitting && "opacity-70 cursor-not-allowed",
            )}
          >
            <Icon icon="mdi:check-circle-outline" className="w-4 h-4" />
            <span>{isSubmitting ? "Saving..." : primaryButtonLabel}</span>
          </button>
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
          <Icon icon="mdi:alert-circle-outline" className="w-5 h-5 flex-shrink-0 text-red-500" />
          <div className="font-medium">{submitError}</div>
        </div>
      )}

      {/* SECTION 1: Category & Store Assignment */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
            <span>1. Category &amp; Location Assignment</span>
          </div>
          {/* Active Category Profile Badge */}
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
              isAircraftSpare && "bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800",
              isMinorSpare && "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800",
              isConsumable && "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800",
              isGroundSupport && "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
              isGeneralQM && "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700",
            )}
          >
            <span>Profile: {formatCategoryName(selectedCategory?.name)}</span>
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Category Selector */}
            <div className="space-y-1 sm:col-span-2">
              <label className={labelClasses}>
                Inventory Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={values.expense_category_id}
                  onChange={handleChange("expense_category_id")}
                  className={cn(selectClasses, "font-bold text-sky-600 dark:text-sky-300")}
                  disabled={isCategoriesLoading}
                >
                  {allCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {formatCategoryName(cat.name)} {cat.name.toLowerCase().includes("minor") ? "★ Non-Serialized Batch" : ""}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>

            {/* Store Repository Selector (Defaults to General Store) */}
            <div className="space-y-1">
              <label className={labelClasses}>
                Assigned Store <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={values.store_id}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      store_id: e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  className={cn(selectClasses, errors.store_id && "border-red-500")}
                  disabled={isStoresLoading}
                  required
                >
                  <option value="" disabled>
                    {isStoresLoading ? "Loading stores..." : "-- Select Store --"}
                  </option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
              {errors.store_id && (
                <p className="text-[11px] text-red-500">{errors.store_id}</p>
              )}
            </div>

            {/* Organizational Unit (Defaults to HQ) */}
            <div className="space-y-1">
              <label className={labelClasses}>
                Unit (Default: HQ) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={values.unit_id}
                  onChange={handleChange("unit_id")}
                  className={selectClasses}
                  disabled={isUnitsLoading}
                >
                  <option value="">
                    {isUnitsLoading ? "Loading units..." : "Select Unit"}
                  </option>
                  {orgUnits?.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Item Information (General, Aircraft Applicability, Commercial & Supply Data) */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
            <span>2. Item Information</span>
          </div>
          <span className="text-[11px] text-slate-400">
            General Item, Commercial &amp; Sizing Information
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className={labelClasses}>Item Name / Description</label>
              <input
                type="text"
                value={values.description}
                onChange={handleChange("description")}
                className={inputClasses}
                placeholder={
                  isMinorSpare
                    ? "e.g. STAINLESS STEEL HEX NUT 1/4-28, MS21042-4"
                    : isConsumable
                      ? "e.g. TURBINE ENGINE OIL SYNTHETIC 5cSt"
                      : "e.g. HYDRAULIC ACTUATOR CYLINDER ASSY"
                }
              />
            </div>

            {/* Aircraft Model Applicability (Aircraft Spares & Minor Spares) */}
            {(isAircraftSpare || isMinorSpare) && (
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClasses}>Aircraft Applicability</label>
                <div className="relative">
                  <select
                    value={values.asset_id}
                    onChange={handleChange("asset_id")}
                    className={selectClasses}
                    disabled={isAssetTypesLoading}
                  >
                    <option value="">
                      {isAssetTypesLoading ? "Loading Aircraft..." : "-- Select Aircraft / Fleet --"}
                    </option>
                    {assetTypes.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
              </div>
            )}

            {/* Quantity / Current Stock */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClasses}>
                  Quantity (Stock Count) <span className="text-red-500">*</span>
                </label>
                {isAircraftSpare && (
                  <span className="text-[10px] text-sky-400 font-semibold">
                    Generates {values.current_stock || 1} Units
                  </span>
                )}
                {isMinorSpare && (
                  <span className="text-[10px] text-indigo-400 font-semibold">
                    Batch of {values.current_stock || 1} items
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                max={isAircraftSpare ? "500" : "100000"}
                value={values.current_stock}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className={cn(
                  inputClasses,
                  "font-bold text-sky-600 dark:text-sky-300",
                  errors.current_stock && "border-red-500",
                )}
                placeholder="1"
              />
              {errors.current_stock && (
                <p className="text-[11px] text-red-500">{errors.current_stock}</p>
              )}
            </div>

            {/* Unit of Issue */}
            <div className="space-y-1">
              <label className={labelClasses}>Unit of Issue</label>
              <div className="relative">
                <select
                  value={values.unit_of_issue}
                  onChange={handleChange("unit_of_issue")}
                  className={selectClasses}
                >
                  {UNIT_OF_ISSUE_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>

            {/* Currency Dropdown */}
            <div className="space-y-1">
              <label className={labelClasses}>Currency</label>
              <div className="relative">
                <select
                  value={values.currency_id}
                  onChange={handleChange("currency_id")}
                  className={selectClasses}
                  disabled={isCurrenciesLoading}
                >
                  <option value="">
                    {isCurrenciesLoading ? "Loading Currencies..." : "Select Currency"}
                  </option>
                  {currencies.map((curr) => (
                    <option key={curr.id} value={curr.id}>
                      {curr.code} - {curr.name} {curr.symbol ? `(${curr.symbol})` : ""}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>

            {/* Unit Cost */}
            <div className="space-y-1">
              <label className={labelClasses}>Unit Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedCurrencySymbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.unit_cost}
                  onChange={handleChange("unit_cost")}
                  className={cn(inputClasses, "pl-8")}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Re-Order Level */}
            <div className="space-y-1">
              <label className={labelClasses}>Re-Order Level</label>
              <input
                type="number"
                min="0"
                value={values.re_order_level}
                onChange={handleChange("re_order_level")}
                className={inputClasses}
                placeholder="e.g. 1"
              />
            </div>

            {/* Manufacturer */}
            <div className="space-y-1">
              <label className={labelClasses}>Manufacturer (MFR)</label>
              <input
                type="text"
                value={values.manufacturer}
                onChange={handleChange("manufacturer")}
                className={inputClasses}
                placeholder="e.g. Boeing, Honeywell, Safran"
              />
            </div>

            {/* Supplier */}
            <div className="space-y-1">
              <label className={labelClasses}>Supplier</label>
              <div className="relative">
                <select
                  value={values.supplier_id}
                  onChange={handleChange("supplier_id")}
                  className={selectClasses}
                  disabled={isSuppliersLoading}
                >
                  <option value="">
                    {isSuppliersLoading ? "Loading Suppliers..." : "-- Select Supplier --"}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.contact ? `(${s.contact})` : ""}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>

            {/* Lead Time */}
            <div className="space-y-1">
              <label className={labelClasses}>Lead Time</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={values.lead_time_days}
                  onChange={handleChange("lead_time_days")}
                  className={inputClasses}
                  placeholder="e.g. 14"
                />
                <div className="relative w-32 shrink-0">
                  <select
                    value={values.lead_time_unit}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        lead_time_unit: e.target.value as "days" | "weeks" | "months",
                      }))
                    }
                    className={selectClasses}
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                  <Icon
                    icon="mdi:chevron-down"
                    className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Special Storage Environment */}
            <div className="space-y-1 sm:col-span-2">
              <label className={labelClasses}>
                Special Storage Environment {isConsumable && <span className="text-amber-500 font-bold">(Key for Consumables)</span>}
              </label>
              <div className="relative">
                <select
                  value={values.special_storage}
                  onChange={handleChange("special_storage")}
                  className={selectClasses}
                >
                  {SPECIAL_STORAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Icon
                  icon="mdi:chevron-down"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Item Identification (Merged Technical Specs & Serialized Matrix) */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
              <span>3. Item Identification</span>
              {isAircraftSpare && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  {values.units.length} {values.units.length === 1 ? "Unit" : "Units"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-400">
              {isAircraftSpare && "Aircraft spare parts require unique serialization per unit. Units are dynamically sized from Section 2 quantity."}
              {isMinorSpare && "Minor spares are batch tracked with common part specifications."}
              {isConsumable && "Consumable items tracked by specification standard and chemical batch."}
              {isGroundSupport && "Ground support equipment tracked by asset serial number and calibration cycle."}
              {isGeneralQM && "General QM supplies tracked by part number and NATO stock number."}
            </p>
          </div>

          {/* Quick Tools for Aircraft Spares */}
          {isAircraftSpare && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoFillUnits}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-slate-100 dark:bg-[#002233] hover:bg-slate-200 dark:hover:bg-[#002f47] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-[#0A4D66]/60 transition-colors"
                title="Copy Part No, CAGE Code, and NSN to any empty unit row"
              >
                <Icon icon="mdi:content-copy" className="w-3.5 h-3.5" />
                <span>Auto-Fill Specs</span>
              </button>
              <button
                type="button"
                onClick={handleAutoSequenceSerials}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/50 transition-colors"
                title="Auto-generate sequential serial numbers (e.g. SN-001, SN-002...)"
              >
                <Icon icon="mdi:numeric" className="w-3.5 h-3.5" />
                <span>Auto-Sequence Serials</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 transition-colors"
                title="Paste multiple serial numbers at once"
              >
                <Icon icon="mdi:clipboard-text-outline" className="w-3.5 h-3.5" />
                <span>Bulk Paste Serials</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* AIRCRAFT SPARES: Master Specification Bar + Dynamic Per-Unit Matrix */}
          {isAircraftSpare ? (
            <div className="space-y-5">
              {/* Common Specifications Row */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 p-3.5 rounded-lg bg-slate-50/80 dark:bg-[#001825]/50 border border-slate-200 dark:border-[#0A4D66]/30">
                {/* Master Part No */}
                <div className="space-y-1">
                  <label className={labelClasses}>
                    Common Part No. (P/N) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={values.part_number}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValues((prev) => ({
                        ...prev,
                        part_number: val,
                        // If only 1 unit or empty units, update them too
                        units: prev.units.map((u) => ({
                          ...u,
                          part_number: u.part_number && u.part_number !== prev.part_number ? u.part_number : val,
                        })),
                      }));
                      setErrors((prev) => ({ ...prev, part_number: undefined }));
                    }}
                    className={cn(inputClasses, errors.part_number && "border-red-500")}
                    placeholder="e.g. 10-60750-1"
                  />
                  {errors.part_number && (
                    <p className="text-[11px] text-red-500">{errors.part_number}</p>
                  )}
                </div>

                {/* ATA Chapter */}
                <div className="space-y-1">
                  <label className={labelClasses}>ATA Chapter</label>
                  <div className="relative">
                    <select
                      value={values.ata_chapter_id}
                      onChange={handleChange("ata_chapter_id")}
                      className={selectClasses}
                      disabled={isAtaLoading}
                    >
                      <option value="">
                        {isAtaLoading ? "Loading ATA Chapters..." : "-- Select ATA --"}
                      </option>
                      {ataChapters.map((ata) => (
                        <option key={ata.id} value={ata.id}>
                          {ata.code || `ATA ${ata.chapter_number || ata.id}`} {ata.name ? `- ${ata.name}` : ""}
                        </option>
                      ))}
                    </select>
                    <Icon
                      icon="mdi:chevron-down"
                      className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Common CAGE Code */}
                <div className="space-y-1">
                  <label className={labelClasses}>CAGE Code</label>
                  <input
                    type="text"
                    value={values.cage_code}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValues((prev) => ({
                        ...prev,
                        cage_code: val,
                        units: prev.units.map((u) => ({
                          ...u,
                          cage_code: u.cage_code && u.cage_code !== prev.cage_code ? u.cage_code : val,
                        })),
                      }));
                    }}
                    className={inputClasses}
                    placeholder="e.g. 77272"
                    maxLength={20}
                  />
                </div>

                {/* Common NSN */}
                <div className="space-y-1">
                  <label className={labelClasses}>NSN</label>
                  <input
                    type="text"
                    value={values.nsn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValues((prev) => ({
                        ...prev,
                        nsn: val,
                        units: prev.units.map((u) => ({
                          ...u,
                          nsn: u.nsn && u.nsn !== prev.nsn ? u.nsn : val,
                        })),
                      }));
                    }}
                    className={inputClasses}
                    placeholder="e.g. 2840-01-523-9988"
                  />
                </div>

                {/* Alternate Support Part No */}
                <div className="space-y-1">
                  <label className={labelClasses}>Alt Support P/N</label>
                  <input
                    type="text"
                    value={values.alternate_support_part_no}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValues((prev) => ({
                        ...prev,
                        alternate_support_part_no: val,
                        units: prev.units.map((u) => ({
                          ...u,
                          alternate_support_part_no:
                            u.alternate_support_part_no && u.alternate_support_part_no !== prev.alternate_support_part_no
                              ? u.alternate_support_part_no
                              : val,
                        })),
                      }));
                    }}
                    className={inputClasses}
                    placeholder="e.g. ALT-98214-B"
                  />
                </div>
              </div>

              {/* Duplicate Serial Alert Bar */}
              {duplicateSerialSet.size > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium">
                  Duplicate serial numbers detected ({duplicateSerialSet.size} duplicates)! Every item in this batch must have a distinct serial number.
                </div>
              )}

              {/* Dynamic Unit Rows Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-[#0A4D66]/40 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 text-[10px] uppercase font-bold text-slate-500 dark:text-gray-400 tracking-wider">
                      <th className="py-2.5 px-3 w-16">Unit #</th>
                      <th className="py-2.5 px-3 min-w-[180px]">
                        Serial No. <span className="text-red-500">*</span>
                      </th>
                      <th className="py-2.5 px-3 min-w-[150px]">Part No.</th>
                      <th className="py-2.5 px-3 min-w-[130px]">CAGE Code</th>
                      <th className="py-2.5 px-3 min-w-[140px]">NSN</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Alt Support P/N</th>
                      <th className="py-2.5 px-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#0A4D66]/20">
                    {values.units.map((unit, idx) => {
                      const isDup =
                        unit.serial_number.trim() &&
                        duplicateSerialSet.has(unit.serial_number.trim().toLowerCase());
                      const hasErr = Boolean(unitErrors[idx]);

                      return (
                        <tr
                          key={idx}
                          className={cn(
                            "transition-colors hover:bg-slate-50/60 dark:hover:bg-[#001825]/60",
                            isDup && "bg-red-500/5",
                          )}
                        >
                          {/* Unit Index */}
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-slate-200 dark:bg-[#0A4D66]/40 text-slate-800 dark:text-slate-200">
                              {idx + 1}
                            </span>
                          </td>

                          {/* Serial Number */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={unit.serial_number}
                                onChange={(e) =>
                                  handleUnitFieldChange(
                                    idx,
                                    "serial_number",
                                    e.target.value,
                                  )
                                }
                                className={cn(
                                  inputClasses,
                                  "font-mono font-medium",
                                  (isDup || hasErr) &&
                                    "border-red-500 focus:border-red-500 focus:ring-red-500/30",
                                )}
                                placeholder={`Serial for Unit #${idx + 1}`}
                                required
                              />
                              {unitErrors[idx] && (
                                <p className="text-[10px] text-red-500 font-medium">
                                  {unitErrors[idx]}
                                </p>
                              )}
                              {isDup && !unitErrors[idx] && (
                                <p className="text-[10px] text-red-500 font-medium">
                                  Duplicate serial number
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Part Number */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={unit.part_number}
                              onChange={(e) =>
                                handleUnitFieldChange(
                                  idx,
                                  "part_number",
                                  e.target.value,
                                )
                              }
                              className={inputClasses}
                              placeholder={values.part_number || "Part No"}
                            />
                          </td>

                          {/* CAGE Code */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={unit.cage_code}
                              onChange={(e) =>
                                handleUnitFieldChange(
                                  idx,
                                  "cage_code",
                                  e.target.value,
                                )
                              }
                              className={inputClasses}
                              placeholder={values.cage_code || "CAGE Code"}
                            />
                          </td>

                          {/* NSN */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={unit.nsn}
                              onChange={(e) =>
                                handleUnitFieldChange(idx, "nsn", e.target.value)
                              }
                              className={inputClasses}
                              placeholder={values.nsn || "NSN"}
                            />
                          </td>

                          {/* Alternate Support Part No */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={unit.alternate_support_part_no}
                              onChange={(e) =>
                                handleUnitFieldChange(
                                  idx,
                                  "alternate_support_part_no",
                                  e.target.value,
                                )
                              }
                              className={inputClasses}
                              placeholder={
                                values.alternate_support_part_no || "Alt Support P/N"
                              }
                            />
                          </td>

                          {/* Action - Delete Unit */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              disabled={values.units.length <= 1}
                              onClick={() => handleRemoveUnit(idx)}
                              title={
                                values.units.length <= 1
                                  ? "At least 1 unit is required"
                                  : `Remove Unit #${idx + 1}`
                              }
                              className={cn(
                                "p-1.5 rounded transition-colors text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40",
                                values.units.length <= 1 &&
                                  "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-400",
                              )}
                            >
                              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Unit footer row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAddUnit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors shadow-xs"
                >
                  <Icon icon="mdi:plus" className="w-4 h-4" />
                  <span>Add Item Identification (#{values.units.length + 1})</span>
                </button>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Configured <strong className="text-slate-800 dark:text-white">{values.units.length}</strong> of{" "}
                  <strong className="text-slate-800 dark:text-white">{values.current_stock || values.units.length}</strong> Item Identifications
                </div>
              </div>
            </div>
          ) : (
            /* NON-SERIALIZED / BATCH CATEGORIES */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Part No */}
                <div className="space-y-1">
                  <label className={labelClasses}>
                    {isConsumable ? "Specification / Part No." : "Part Number (P/N)"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={values.part_number}
                    onChange={handleChange("part_number")}
                    className={cn(inputClasses, errors.part_number && "border-red-500")}
                    placeholder={isConsumable ? "e.g. MIL-PRF-23699, Skydrol" : "e.g. 10-60750-1, MS20470"}
                  />
                  {errors.part_number && (
                    <p className="text-[11px] text-red-500">{errors.part_number}</p>
                  )}
                </div>

                {/* Batch / Lot Number (Minor Spares and Consumables) */}
                {(isMinorSpare || isConsumable) && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      Batch / Lot Number <span className="text-sky-500 font-semibold">(Batch Tracked)</span>
                    </label>
                    <input
                      type="text"
                      value={values.batch_number}
                      onChange={handleChange("batch_number")}
                      className={inputClasses}
                      placeholder="e.g. LOT-2026-B91 or BATCH-449"
                    />
                  </div>
                )}

                {/* CAGE Code */}
                {!isGeneralQM && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      CAGE Code <span className="text-[10px] text-slate-400 font-normal">(5-Char MFR)</span>
                    </label>
                    <input
                      type="text"
                      value={values.cage_code}
                      onChange={handleChange("cage_code")}
                      className={inputClasses}
                      placeholder="e.g. 77272, 88044"
                      maxLength={20}
                    />
                  </div>
                )}

                {/* NSN (NATO Stock Number) */}
                {!isGeneralQM && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      NSN (National Stock Number)
                    </label>
                    <input
                      type="text"
                      value={values.nsn}
                      onChange={handleChange("nsn")}
                      className={inputClasses}
                      placeholder="e.g. 2840-01-523-9988"
                    />
                  </div>
                )}

                {/* Alternate Support Part No */}
                {isMinorSpare && (
                  <div className="space-y-1">
                    <label className={labelClasses}>Alternate Support Part No.</label>
                    <input
                      type="text"
                      value={values.alternate_support_part_no}
                      onChange={handleChange("alternate_support_part_no")}
                      className={inputClasses}
                      placeholder="e.g. ALT-98214-B"
                    />
                  </div>
                )}

                {/* ATA Chapter (Minor Spares) */}
                {isMinorSpare && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      ATA Chapter <span className="text-[10px] text-slate-400 font-normal">(System Table)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={values.ata_chapter_id}
                        onChange={handleChange("ata_chapter_id")}
                        className={selectClasses}
                        disabled={isAtaLoading}
                      >
                        <option value="">
                          {isAtaLoading ? "Loading ATA Chapters..." : "-- Select ATA Chapter --"}
                        </option>
                        {ataChapters.map((ata) => (
                          <option key={ata.id} value={ata.id}>
                            {ata.code || `ATA ${ata.chapter_number || ata.id}`} {ata.name ? `- ${ata.name}` : ""}
                          </option>
                        ))}
                      </select>
                      <Icon
                        icon="mdi:chevron-down"
                        className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                    </div>
                  </div>
                )}

                {/* Single Equipment Serial Number (Ground Support) */}
                {isGroundSupport && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      GSE Asset Serial No.
                    </label>
                    <input
                      type="text"
                      value={values.serial_number}
                      onChange={handleChange("serial_number")}
                      className={inputClasses}
                      placeholder="e.g. GSE-SN-8820"
                    />
                  </div>
                )}

                {/* Calibration Due Date (Ground Support) */}
                {isGroundSupport && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      Calibration / Test Due Date
                    </label>
                    <input
                      type="date"
                      value={values.calibration_due_date}
                      onChange={handleChange("calibration_due_date")}
                      className={inputClasses}
                    />
                  </div>
                )}

                {/* Calibration Interval Days (Ground Support) */}
                {isGroundSupport && (
                  <div className="space-y-1">
                    <label className={labelClasses}>
                      Calibration Interval (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={values.calibration_interval_days}
                      onChange={handleChange("calibration_interval_days")}
                      className={inputClasses}
                      placeholder="e.g. 180"
                    />
                  </div>
                )}
              </div>

              {/* Informational batch note */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#001825]/60 border border-slate-200 dark:border-[#0A4D66]/30 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide">
                    {isMinorSpare && "Minor Spare Batch Tracking"}
                    {isConsumable && "Consumable Fluid & Chemical Batch"}
                    {isGroundSupport && "Ground Support Equipment Management"}
                    {isGeneralQM && "General QM Supplies"}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    {isMinorSpare && "Stocked in bulk quantity without requiring unique individual serial numbers per unit."}
                    {isConsumable && "Tracked by chemical batch, expiration, and container unit of issue."}
                    {isGroundSupport && "Tracked by asset calibration cycle and inspection validity."}
                    {isGeneralQM && "Tracked by total inventory quantity and reorder thresholds."}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Total Quantity</span>
                  <span className="text-sm font-bold text-sky-600 dark:text-sky-300">
                    {values.current_stock || 1} {values.unit_of_issue}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: Shelf Life & Life Limits (Adaptive per category) */}
      {(isAircraftSpare || isMinorSpare || isConsumable) && (
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl shadow-sm relative z-30">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between rounded-t-xl">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
              <span>
                4. {isAircraftSpare ? "Shelf Life & Life Limit Tracking" : "Shelf Life / Pot-Life Expiration"}
              </span>
            </div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              Shelf life starts counting upon addition
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Shelf Life Tracking Banner */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 sm:p-4 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <div className="font-semibold text-xs sm:text-sm">
                Shelf Life Tracking Begins Today
              </div>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                Shelf life begins accumulating automatically upon item addition (Start Date: {new Date().toLocaleDateString()}).
                {isAircraftSpare && " Configure applicable operational dimensions (Hours, Cycles, and/or Calendar duration)."}
                {isMinorSpare && " Track elastomeric or seal degradation durations (e.g. O-rings, packings, gaskets)."}
                {isConsumable && " Track chemical pot-life, sealant expiration, or fluid shelf validity."}
              </p>
            </div>

            <div className={cn("grid gap-6", isAircraftSpare ? "lg:grid-cols-2" : "grid-cols-1")}>
              {/* SHELF LIFE CARD */}
              <div className="rounded-lg border border-slate-200 dark:border-[#0A4D66]/30 bg-slate-50/50 dark:bg-[#001825]/40 p-4 space-y-4 relative z-20">
                <div className="pb-2 border-b border-slate-200 dark:border-[#0A4D66]/30">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-gray-200">
                    Shelf Life Specifications
                  </h3>
                </div>

                <div>
                  <MultiSelect
                    label="Select Shelf Life Dimensions"
                    placeholder="Select Hours, Cycles, Calendar..."
                    options={isAircraftSpare ? METRIC_OPTIONS : METRIC_OPTIONS.filter((m) => m.value === "calendar")}
                    selectedValues={values.shelf_life_types}
                    onChange={(selected) =>
                      setValues((prev) => ({
                        ...prev,
                        shelf_life_types: selected.map(String),
                      }))
                    }
                  />
                </div>

                {/* Conditional Inputs */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {isAircraftSpare && values.shelf_life_types.includes("hours") && (
                    <div className="space-y-1">
                      <label className={labelClasses}>Shelf Life (Hours)</label>
                      <input
                        type="number"
                        min="0"
                        value={values.shelf_life_hours}
                        onChange={handleChange("shelf_life_hours")}
                        className={inputClasses}
                        placeholder="e.g. 500"
                      />
                    </div>
                  )}

                  {isAircraftSpare && values.shelf_life_types.includes("cycles") && (
                    <div className="space-y-1">
                      <label className={labelClasses}>Shelf Life (Cycles)</label>
                      <input
                        type="number"
                        min="0"
                        value={values.shelf_life_cycles}
                        onChange={handleChange("shelf_life_cycles")}
                        className={inputClasses}
                        placeholder="e.g. 200"
                      />
                    </div>
                  )}

                  {values.shelf_life_types.includes("calendar") && (
                    <>
                      <div className="space-y-1">
                        <label className={labelClasses}>Calendar Interval</label>
                        <div className="relative">
                          <select
                            value={values.shelf_life_calendar_interval}
                            onChange={(e) =>
                              setValues((prev) => ({
                                ...prev,
                                shelf_life_calendar_interval: e.target.value as "daily" | "monthly" | "yearly",
                              }))
                            }
                            className={selectClasses}
                          >
                            <option value="daily">Daily (Days)</option>
                            <option value="monthly">Monthly (Months)</option>
                            <option value="yearly">Yearly (Years)</option>
                          </select>
                          <Icon
                            icon="mdi:chevron-down"
                            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className={labelClasses}>Calendar Duration Count</label>
                        <input
                          type="number"
                          min="1"
                          value={values.shelf_life_calendar_value}
                          onChange={handleChange("shelf_life_calendar_value")}
                          className={inputClasses}
                          placeholder="e.g. 12"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* LIFE LIMITED TYPE CARD (Only for Aircraft Spares) */}
              {isAircraftSpare && (
                <div className="rounded-lg border border-slate-200 dark:border-[#0A4D66]/30 bg-slate-50/50 dark:bg-[#001825]/40 p-4 space-y-4 relative z-10">
                  <div className="pb-2 border-b border-slate-200 dark:border-[#0A4D66]/30">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-gray-200">
                      Life Limited Type (LLP Thresholds)
                    </h3>
                  </div>

                  <div>
                    <MultiSelect
                      label="Select Life Limit Dimensions"
                      placeholder="Select Hours, Cycles, Calendar..."
                      options={METRIC_OPTIONS}
                      selectedValues={values.life_limit_types}
                      onChange={(selected) =>
                        setValues((prev) => ({
                          ...prev,
                          life_limit_types: selected.map(String),
                        }))
                      }
                    />
                  </div>

                  {/* Conditional Inputs */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    {values.life_limit_types.includes("hours") && (
                      <div className="space-y-1">
                        <label className={labelClasses}>Life Limit (Hours)</label>
                        <input
                          type="number"
                          min="0"
                          value={values.life_limit_hours}
                          onChange={handleChange("life_limit_hours")}
                          className={inputClasses}
                          placeholder="e.g. 20000"
                        />
                      </div>
                    )}

                    {values.life_limit_types.includes("cycles") && (
                      <div className="space-y-1">
                        <label className={labelClasses}>Life Limit (Cycles)</label>
                        <input
                          type="number"
                          min="0"
                          value={values.life_limit_cycles}
                          onChange={handleChange("life_limit_cycles")}
                          className={inputClasses}
                          placeholder="e.g. 15000"
                        />
                      </div>
                    )}

                    {values.life_limit_types.includes("calendar") && (
                      <>
                        <div className="space-y-1">
                          <label className={labelClasses}>Calendar Interval</label>
                          <div className="relative">
                            <select
                              value={values.life_limit_calendar_interval}
                              onChange={(e) =>
                                setValues((prev) => ({
                                  ...prev,
                                  life_limit_calendar_interval: e.target.value as "daily" | "monthly" | "yearly",
                                }))
                              }
                              className={selectClasses}
                            >
                              <option value="daily">Daily (Days)</option>
                              <option value="monthly">Monthly (Months)</option>
                              <option value="yearly">Yearly (Years)</option>
                            </select>
                            <Icon
                              icon="mdi:chevron-down"
                              className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className={labelClasses}>Threshold Limit Count</label>
                          <input
                            type="number"
                            min="1"
                            value={values.life_limit_calendar_value}
                            onChange={handleChange("life_limit_calendar_value")}
                            className={inputClasses}
                            placeholder="e.g. 10"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 5: Remarks & Additional Details */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm relative z-10">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
            <span>5. Logistics Dates &amp; Remarks</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className={labelClasses}>Date Received</label>
              <input
                type="date"
                value={values.date_received}
                onChange={handleChange("date_received")}
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>Manual Expiry Date (If Applicable)</label>
              <input
                type="date"
                value={values.expiry_date}
                onChange={handleChange("expiry_date")}
                className={inputClasses}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClasses}>Logistics Remark</label>
              <input
                type="text"
                value={values.remark}
                onChange={handleChange("remark")}
                className={inputClasses}
                placeholder="e.g. Batch inspected, CoC attached"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl shadow-sm">
        <div className="text-xs text-slate-500 dark:text-gray-400">
          Tracking Mode:{" "}
          <strong className="text-slate-900 dark:text-white uppercase">
            {isAircraftSpare ? `Serialized (${values.units.length} Units)` : `Batch Tracked (${values.current_stock} ${values.unit_of_issue})`}
          </strong>
        </div>
        <div className="flex items-center gap-3">
          <CancelButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} label="Cancel" size="md" />
          <button
            type="button"
            onClick={() => handleSubmitInternal(true)}
            disabled={isSubmitting}
            className={cn(
              "inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-[#0369A1] hover:bg-[#025682] text-white text-xs sm:text-sm font-bold transition-colors shadow-md",
              isSubmitting && "opacity-70 cursor-not-allowed",
            )}
          >
            {isSubmitting ? "Saving Stock..." : primaryButtonLabel}
          </button>
        </div>
      </div>

      {/* Bulk Paste Serials Modal */}
      {isBulkPasteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/60 rounded-xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#0A4D66]/40 pb-3">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:barcode-scan" className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                  Bulk Paste Item Identifications / Serials
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkPasteOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <Icon icon="mdi:close" className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
              Paste serial numbers / item IDs below (one per line or separated by commas). The system will automatically populate each unit in sequence and match the stock quantity.
            </p>
            <textarea
              rows={6}
              value={bulkSerialsText}
              onChange={(e) => setBulkSerialsText(e.target.value)}
              placeholder={"SN-1001-01\nSN-1001-02\nSN-1001-03\n..."}
              className={cn(inputClasses, "font-mono text-xs p-3 leading-relaxed")}
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 dark:text-gray-400">
                {bulkSerialsText.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean).length} serials detected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkPasteOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkSerials}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  Apply to Units
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const InventoryFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const isNewOrAdd = !id || id === "new" || id === "add" || id === "create";
  const mode: FormMode = isNewOrAdd ? "create" : "edit";
  const effectiveId = isNewOrAdd ? undefined : id;

  const {
    data: inventory,
    isLoading: isInventoryLoading,
    isError: isInventoryError,
  } = useGetInventoryByIdQuery(effectiveId ?? "", {
    skip: !effectiveId,
  });

  const { data: units, isLoading: isUnitsLoading } = useGetUnitsQuery();
  const { data: categories, isLoading: isCategoriesLoading } =
    useGetExpenseCategoriesQuery();

  const [createInventory, { isLoading: isCreating }] =
    useCreateInventoryMutation();
  const [updateInventory, { isLoading: isUpdating }] =
    useUpdateInventoryMutation();

  const handleBack = () => {
    navigate("/dashboard/inventory");
  };

  if (mode === "edit" && !isInventoryLoading && isInventoryError) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            Edit Stock
          </h1>
        </div>
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden p-6 text-center text-slate-500 dark:text-gray-400 shadow-sm">
          Failed to load inventory item.
        </section>
      </div>
    );
  }

  if (mode === "edit" && isInventoryLoading) {
    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <BackButton fallbackUrl="/dashboard/inventory" />
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
            Edit Stock
          </h1>
        </div>
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden p-6 text-center text-slate-500 dark:text-gray-400 shadow-sm">
          Loading inventory...
        </section>
      </div>
    );
  }

  const isSubmitting = isCreating || isUpdating;

  return (
    <InventoryFormContent
      key={mode === "edit" ? (id ?? "edit") : "create"}
      mode={mode}
      inventory={inventory ?? null}
      units={units}
      categories={categories}
      isUnitsLoading={isUnitsLoading}
      isCategoriesLoading={isCategoriesLoading}
      onBack={handleBack}
      createInventory={createInventory}
      updateInventory={updateInventory}
      id={id}
      isSubmitting={isSubmitting}
    />
  );
};
