import { useState, useMemo, type ChangeEvent } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { BackButton, CancelButton } from "@/shared/ui/button";
import Modal from "@/shared/ui/modal/Modal";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import type {
  InventoryFormValues,
  FormSerializedUnit,
} from "../pages/InventoryFormPage";
import type { Unit } from "@/shared/api/units";
import type { Store, AtaChapter, ProcurementCurrency, InventorySupplier } from "@/features/inventory/api";
import type { AssetType } from "@/features/assets/api";
import { formatCategoryName } from "@/features/inventory/inventoryUtils";

interface AircraftSparePartsFormProps {
  mode: "create" | "edit";
  values: InventoryFormValues;
  setValues: React.Dispatch<React.SetStateAction<InventoryFormValues>>;
  errors: Partial<Record<keyof InventoryFormValues, string>>;
  setErrors: React.Dispatch<
    React.SetStateAction<Partial<Record<keyof InventoryFormValues, string>>>
  >;
  unitErrors: Record<number, string>;
  setUnitErrors: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  stores: Store[];
  isStoresLoading: boolean;
  units: Unit[];
  isUnitsLoading: boolean;
  categories: Array<{ id: number; name: string; description: string | null }>;
  isCategoriesLoading: boolean;
  ataChapters: AtaChapter[];
  isAtaLoading: boolean;
  currencies: ProcurementCurrency[];
  isCurrenciesLoading: boolean;
  suppliers: InventorySupplier[];
  isSuppliersLoading: boolean;
  assetTypes: AssetType[];
  isAssetTypesLoading: boolean;
  onSubmit: (exitAfter: boolean) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
  setSubmitError: (err: string | null) => void;
  onBack: () => void;
  isFormDirty: boolean;
  requiresSerialTracking: boolean | null;
  setRequiresSerialTracking: (val: boolean | null) => void;
}

export type IdentifierVariationsState = {
  differentPartNumbers: boolean;
  differentNsns: boolean;
  differentCageCodes: boolean;
  differentAtaChapters: boolean;
};

export const AircraftSparePartsForm = ({
  mode,
  values,
  setValues,
  errors,
  setErrors,
  unitErrors,
  setUnitErrors,
  stores,
  isStoresLoading,
  units: orgUnits,
  isUnitsLoading,
  categories,
  isCategoriesLoading,
  ataChapters,
  isAtaLoading,
  currencies,
  isCurrenciesLoading,
  suppliers,
  isSuppliersLoading,
  assetTypes,
  isAssetTypesLoading,
  onSubmit,
  isSubmitting,
  submitError,
  setSubmitError,
  onBack,
  isFormDirty,
  requiresSerialTracking,
  setRequiresSerialTracking,
}: AircraftSparePartsFormProps) => {
  // Review Mode State
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Variations Checkbox State
  const [identifierVariations, setIdentifierVariations] =
    useState<IdentifierVariationsState>({
      differentPartNumbers: false,
      differentNsns: false,
      differentCageCodes: false,
      differentAtaChapters: false,
    });

  // Quantity Reduction Warning Modal State
  const [showQuantityWarningModal, setShowQuantityWarningModal] = useState(false);
  const [pendingQuantity, setPendingQuantity] = useState<number | null>(null);

  // Bulk Paste Modal State
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkSerialsText, setBulkSerialsText] = useState("");

  // Collapsible Technical Specs State
  const [showTechnicalSpecs, setShowTechnicalSpecs] = useState(false);

  // Quick Batch Overrides bar state
  const [batchOverrideField, setBatchOverrideField] = useState<
    "part_number" | "nsn" | "cage_code" | "ata_chapter" | ""
  >("");
  const [batchOverrideValue, setBatchOverrideValue] = useState("");
  const [batchOverrideAtaId, setBatchOverrideAtaId] = useState<number | "">("");

  // Styling helpers
  const inputClasses =
    "w-full rounded-lg border border-slate-300 dark:border-[#0A4D66]/50 bg-white dark:bg-[#001825] px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-[#7FD5FF] focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40 disabled:opacity-50 transition-colors";
  const selectClasses =
    "w-full rounded-lg border border-slate-300 dark:border-[#0A4D66]/50 bg-white dark:bg-[#001825] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-[#7FD5FF] focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40 disabled:opacity-50 transition-colors appearance-none";
  const labelClasses =
    "block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1";

  // ATA Chapter options for SearchableSelect
  const ataOptions: SearchableSelectOption[] = useMemo(() => {
    return ataChapters.map((ata) => ({
      value: ata.id,
      label: `${ata.code || `ATA ${ata.chapter_number || ata.id}`} - ${ata.name || ""}`.trim(),
      description: ata.name || undefined,
    }));
  }, [ataChapters]);

  const selectedAta = useMemo(() => {
    return ataChapters.find((a) => a.id === Number(values.ata_chapter_id));
  }, [ataChapters, values.ata_chapter_id]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === Number(values.supplier_id));
  }, [suppliers, values.supplier_id]);

  const selectedStore = useMemo(() => {
    return stores.find((s) => s.id === Number(values.store_id));
  }, [stores, values.store_id]);

  const selectedUnit = useMemo(() => {
    return orgUnits.find((u) => u.id === Number(values.unit_id));
  }, [orgUnits, values.unit_id]);

  const selectedAsset = useMemo(() => {
    return assetTypes.find((a) => a.id === Number(values.asset_id));
  }, [assetTypes, values.asset_id]);

  const selectedCurrency = useMemo(() => {
    return currencies.find((c) => c.id === Number(values.currency_id));
  }, [currencies, values.currency_id]);

  const selectedCurrencySymbol = useMemo(() => {
    if (!selectedCurrency) return "₦";
    if (selectedCurrency.code === "NGN") return "₦";
    if (selectedCurrency.code === "USD") return "$";
    if (selectedCurrency.code === "EUR") return "€";
    if (selectedCurrency.code === "GBP") return "£";
    return selectedCurrency.symbol || selectedCurrency.code || "₦";
  }, [selectedCurrency]);

  // Real-time intra-batch duplicate serial detection
  const duplicateSerialSet = useMemo(() => {
    if (requiresSerialTracking !== true) return new Set<string>();
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
  }, [values.units, requiresSerialTracking]);

  // Handle generic field changes
  const handleChange =
    (field: keyof InventoryFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  // Safe Quantity Change Handler with Truncation Warning
  const handleQuantityChange = (qtyStr: string) => {
    const nextCount = parseInt(qtyStr, 10);
    if (isNaN(nextCount) || nextCount < 1) {
      setValues((prev) => ({ ...prev, current_stock: qtyStr }));
      return;
    }

    const clamped = Math.min(nextCount, 500);

    // If serialized tracking is active and reducing quantity would discard entered serial numbers
    if (requiresSerialTracking === true && values.units.length > clamped) {
      const unitsToDiscard = values.units.slice(clamped);
      const hasEnteredSerials = unitsToDiscard.some((u) => u.serial_number.trim() !== "");

      if (hasEnteredSerials) {
        setPendingQuantity(clamped);
        setShowQuantityWarningModal(true);
        return;
      }
    }

    // Otherwise apply directly
    applyQuantityUpdate(clamped);
  };

  const applyQuantityUpdate = (count: number) => {
    setValues((prev) => {
      const currentUnits = [...prev.units];
      if (currentUnits.length < count) {
        const added: FormSerializedUnit[] = [];
        for (let i = currentUnits.length; i < count; i++) {
          added.push({
            unit_index: i + 1,
            serial_number: "",
            cage_code: prev.cage_code || "",
            part_number: prev.part_number || "",
            nsn: prev.nsn || "",
            ata_chapter: prev.ata_chapter || "",
            ata_chapter_id: prev.ata_chapter_id || "",
            alternate_support_part_no: prev.alternate_support_part_no || "",
          });
        }
        return {
          ...prev,
          current_stock: String(count),
          units: [...currentUnits, ...added],
        };
      } else if (currentUnits.length > count) {
        return {
          ...prev,
          current_stock: String(count),
          units: currentUnits.slice(0, count).map((u, i) => ({
            ...u,
            unit_index: i + 1,
          })),
        };
      }
      return {
        ...prev,
        current_stock: String(count),
      };
    });
    setErrors((prev) => ({ ...prev, current_stock: undefined }));
  };

  // Confirm truncation in modal
  const handleConfirmQuantityReduction = () => {
    if (pendingQuantity !== null) {
      applyQuantityUpdate(pendingQuantity);
    }
    setShowQuantityWarningModal(false);
    setPendingQuantity(null);
  };

  // Unit Field Changes
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

  // Unit ATA Chapter Change
  const handleUnitAtaChange = (index: number, ataId: number | null) => {
    const foundAta = ataChapters.find((a) => a.id === ataId);
    setValues((prev) => {
      const nextUnits = [...prev.units];
      if (nextUnits[index]) {
        nextUnits[index] = {
          ...nextUnits[index],
          ata_chapter_id: ataId ?? "",
          ata_chapter: foundAta?.code || "",
        };
      }
      return { ...prev, units: nextUnits };
    });
  };

  // Auto-Sequence Serial Numbers
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
    setUnitErrors({});
  };

  // Clear all serial numbers
  const handleClearAllSerials = () => {
    setValues((prev) => ({
      ...prev,
      units: prev.units.map((u) => ({
        ...u,
        serial_number: "",
      })),
    }));
    setUnitErrors({});
  };

  // Bulk Paste Serial Numbers
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
          ata_chapter: existing?.ata_chapter || prev.ata_chapter || "",
          ata_chapter_id: existing?.ata_chapter_id || prev.ata_chapter_id || "",
          alternate_support_part_no:
            existing?.alternate_support_part_no ||
            prev.alternate_support_part_no ||
            "",
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
    setUnitErrors({});
  };

  // Batch Override Application
  const handleApplyBatchOverride = () => {
    if (!batchOverrideField) return;
    setValues((prev) => ({
      ...prev,
      units: prev.units.map((u) => {
        if (batchOverrideField === "ata_chapter") {
          const foundAta = ataChapters.find((a) => a.id === Number(batchOverrideAtaId));
          return {
            ...u,
            ata_chapter_id: batchOverrideAtaId,
            ata_chapter: foundAta?.code || "",
          };
        }
        return {
          ...u,
          [batchOverrideField]: batchOverrideValue.trim(),
        };
      }),
    }));
    setBatchOverrideValue("");
    setBatchOverrideAtaId("");
    setBatchOverrideField("");
  };

  // Validation Routine
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof InventoryFormValues, string>> = {};
    const newUnitErrors: Record<number, string> = {};

    if (!values.description.trim()) {
      newErrors.description = "Part Name / Description is required";
    }

    if (!values.part_number.trim()) {
      newErrors.part_number = "Part Number (P/N) is required";
    }

    if (!values.store_id) {
      newErrors.store_id = "Assigned store location is required";
    }

    const qty = parseInt(values.current_stock, 10);
    if (isNaN(qty) || qty < 1) {
      newErrors.current_stock = "Quantity received must be a positive whole number (at least 1)";
    }

    if (requiresSerialTracking === null) {
      newErrors.serial_number =
        "Please select whether this component requires individual serial-number tracking";
    }

    // If serialized tracking is YES, all units must have non-empty unique serial numbers
    if (requiresSerialTracking === true) {
      values.units.forEach((u, idx) => {
        const s = u.serial_number.trim();
        if (!s) {
          newUnitErrors[idx] = `Serial number is required for Unit #${idx + 1}`;
        } else if (duplicateSerialSet.has(s.toLowerCase())) {
          newUnitErrors[idx] = `Duplicate serial number "${s}" in batch`;
        }
      });

      if (duplicateSerialSet.size > 0) {
        newErrors.serial_number =
          "Duplicate serial numbers detected. Each unit must possess a distinct serial number.";
      }
    }

    setErrors(newErrors);
    setUnitErrors(newUnitErrors);
    return Object.keys(newErrors).length === 0 && Object.keys(newUnitErrors).length === 0;
  };

  // Click Review Button
  const handleProceedToReview = () => {
    setSubmitError(null);
    if (validateForm()) {
      setIsReviewing(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setSubmitError("Please correct the highlighted validation errors before proceeding to review.");
      // Scroll to the first error
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  // Final Save from Review screen
  const handleFinalSave = async () => {
    if (!validateForm()) {
      setIsReviewing(false);
      setSubmitError("Validation checks failed. Please review your entries.");
      return;
    }
    await onSubmit(true);
  };

  // =========================================================================
  // VIEW 1: REVIEW BEFORE SAVING
  // =========================================================================
  if (isReviewing) {
    const qty = parseInt(values.current_stock, 10) || 1;
    const formattedCost = values.unit_cost
      ? `${selectedCurrencySymbol} ${Number(values.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "Not specified";

    const activeVariationLabels = [
      identifierVariations.differentPartNumbers && "Different Part Numbers",
      identifierVariations.differentNsns && "Different NSNs",
      identifierVariations.differentCageCodes && "Different CAGE Codes",
      identifierVariations.differentAtaChapters && "Different ATA Chapters",
    ].filter(Boolean) as string[];

    return (
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 max-w-5xl mx-auto space-y-6">
        {/* Review Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-[#0A4D66]/40 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-[#002233] hover:bg-slate-200 dark:hover:bg-[#002f47] text-slate-700 dark:text-gray-200 border border-slate-300 dark:border-[#0A4D66]/60 transition-colors"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back to Edit</span>
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>Review Stock Registration</span>
                <span className="rounded bg-sky-100 dark:bg-sky-950/80 px-2.5 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  Aircraft Spare Part
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Confirm all shared part specifications, unit serial numbers, and variations before committing to the inventory ledger.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReviewing(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-gray-300 transition-colors"
            >
              Back to Edit
            </button>
            <button
              type="button"
              onClick={handleFinalSave}
              disabled={isSubmitting}
              className={cn(
                "inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#025682] text-white shadow-md transition-colors",
                isSubmitting && "opacity-70 cursor-not-allowed",
              )}
            >
              {isSubmitting ? (
                <>
                  <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                  <span>Saving Stock...</span>
                </>
              ) : (
                <>
                  <Icon icon="mdi:content-save-check" className="w-4 h-4" />
                  <span>Confirm &amp; Save Stock</span>
                </>
              )}
            </button>
          </div>
        </div>

        {submitError && (
          <div className="rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
            <Icon icon="mdi:alert-circle-outline" className="w-5 h-5 flex-shrink-0 text-red-500" />
            <div className="font-medium">{submitError}</div>
          </div>
        )}

        {/* 1. COMMON PART INFORMATION Panel */}
        <div className="rounded-xl border border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#0A4D66]/30 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:information-outline" className="w-4 h-4 text-sky-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                1. Common Part Information
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Inherited by all units</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Part Name / Description</span>
              <span className="text-slate-900 dark:text-white font-bold text-sm">{values.description || "-"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Part Number (P/N)</span>
              <span className="text-sky-600 dark:text-sky-400 font-mono font-bold text-sm">{values.part_number || "-"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">ATA Chapter</span>
              <span className="text-slate-800 dark:text-gray-200 font-medium">
                {selectedAta ? `${selectedAta.code} - ${selectedAta.name}` : values.ata_chapter || "Not Assigned"}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">NATO Stock Number (NSN)</span>
              <span className="text-slate-800 dark:text-gray-200 font-mono">{values.nsn || "Not Assigned"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">CAGE Code</span>
              <span className="text-slate-800 dark:text-gray-200 font-mono">{values.cage_code || "Not Assigned"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Aircraft Fleet Applicability</span>
              <span className="text-slate-800 dark:text-gray-200 font-medium">{selectedAsset?.name || "General Fleet Applicability"}</span>
            </div>
          </div>
        </div>

        {/* 2. RECEIPT & COMMERCIAL INFORMATION Panel */}
        <div className="rounded-xl border border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#0A4D66]/30 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:receipt-text-outline" className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                2. Receipt &amp; Commercial Information
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Inventory Ledger Parameters</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Quantity Received</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-base">{qty} {values.unit_of_issue || "EA"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Unit Cost</span>
              <span className="text-slate-900 dark:text-white font-mono font-semibold">{formattedCost}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Supplier</span>
              <span className="text-slate-800 dark:text-gray-200 font-medium">{selectedSupplier?.name || "Direct Supply / Unspecified"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date Received</span>
              <span className="text-slate-800 dark:text-gray-200 font-mono font-medium">{values.date_received || new Date().toISOString().split("T")[0]}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Store</span>
              <span className="text-slate-800 dark:text-gray-200 font-medium">{selectedStore?.name || "General Store"}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#001825] border border-slate-200/60 dark:border-[#0A4D66]/20">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Unit</span>
              <span className="text-slate-800 dark:text-gray-200 font-medium">{selectedUnit?.name || "Headquarters (HQ)"}</span>
            </div>
          </div>
        </div>

        {/* 3. ITEM IDENTIFICATION & VARIATIONS Panel */}
        <div className="rounded-xl border border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-[#0A4D66]/30 pb-3">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:barcode-scan" className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                3. Item Identification &amp; Unit Traceability
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                  requiresSerialTracking
                    ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700",
                )}
              >
                {requiresSerialTracking ? "Serialized Unit Tracking (Yes)" : "Non-Serialized Stock (No)"}
              </span>
            </div>
          </div>

          <div className="text-xs space-y-3">
            <div>
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Identifier Variations Status:</span>{" "}
              {activeVariationLabels.length > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Active Variations ({activeVariationLabels.join(", ")})
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  None — All units share identical common specifications.
                </span>
              )}
            </div>

            {/* Serialized Units Breakdown Table */}
            {requiresSerialTracking ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#0A4D66]/30 bg-slate-50/50 dark:bg-[#001825]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-100 dark:bg-[#001219] text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-400">
                    <tr>
                      <th className="p-2.5 w-16">Unit</th>
                      <th className="p-2.5">Serial Number</th>
                      <th className="p-2.5">Part Number</th>
                      <th className="p-2.5">NSN</th>
                      <th className="p-2.5">CAGE Code</th>
                      <th className="p-2.5">ATA Chapter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#0A4D66]/20 font-mono">
                    {values.units.map((u, idx) => {
                      const isPnDiff = u.part_number && u.part_number !== values.part_number;
                      const isNsnDiff = u.nsn && u.nsn !== values.nsn;
                      const isCageDiff = u.cage_code && u.cage_code !== values.cage_code;
                      const isAtaDiff = u.ata_chapter && u.ata_chapter !== values.ata_chapter;

                      return (
                        <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-2.5 font-bold font-sans text-sky-600 dark:text-sky-400">
                            UNIT {idx + 1}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                            {u.serial_number || <span className="text-red-500 italic">Missing</span>}
                          </td>
                          <td className="p-2.5">
                            <span className={cn(isPnDiff ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-gray-400")}>
                              {u.part_number || values.part_number}
                              {isPnDiff && " (Custom)"}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className={cn(isNsnDiff ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-gray-400")}>
                              {u.nsn || values.nsn || "-"}
                              {isNsnDiff && " (Custom)"}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className={cn(isCageDiff ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-gray-400")}>
                              {u.cage_code || values.cage_code || "-"}
                              {isCageDiff && " (Custom)"}
                            </span>
                          </td>
                          <td className="p-2.5 font-sans">
                            <span className={cn(isAtaDiff ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-gray-400")}>
                              {u.ata_chapter || values.ata_chapter || "-"}
                              {isAtaDiff && " (Custom)"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs">
                ✓ Non-serialized inventory. Quantity of {qty} units will be recorded under part number <strong>{values.part_number}</strong> without individual unit records.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-[#0A4D66]/30">
          <button
            type="button"
            onClick={() => setIsReviewing(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-gray-200 transition-colors"
          >
            <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
            <span>Back to Edit</span>
          </button>

          <button
            type="button"
            onClick={handleFinalSave}
            disabled={isSubmitting}
            className={cn(
              "inline-flex items-center gap-2 px-8 py-2.5 rounded-lg text-sm font-bold bg-[#0369A1] hover:bg-[#025682] text-white shadow-md transition-colors",
              isSubmitting && "opacity-70 cursor-not-allowed",
            )}
          >
            {isSubmitting ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Saving Stock...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:content-save-check" className="w-4 h-4" />
                <span>Save Stock</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: EDIT FORM FOR AIRCRAFT SPARE PARTS
  // =========================================================================
  const qtyNumeric = parseInt(values.current_stock, 10) || 1;

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} />
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>{mode === "create" ? "Add Stock — Aircraft Spare Parts" : "Edit Stock — Aircraft Spare Parts"}</span>
              <span className="rounded bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                Aviation Spares Workflow
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Register component batches with shared specifications and traceability.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CancelButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} label="Cancel" size="md" onCancel={onBack} />
          <button
            type="button"
            onClick={handleProceedToReview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0369A1] hover:bg-[#025682] text-white shadow-sm transition-colors"
          >
            <Icon icon="mdi:clipboard-check-outline" className="w-4 h-4" />
            <span>Review &amp; Save Stock</span>
          </button>
        </div>
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
          <Icon icon="mdi:alert-circle-outline" className="w-5 h-5 flex-shrink-0 text-red-500" />
          <div className="font-medium">{submitError}</div>
        </div>
      )}

      {/* TOP BAR: Category & Storage Repository */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-[#0A4D66]/40 bg-white dark:bg-[#001219] shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Inventory Category Selector */}
          <div className="space-y-1">
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
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {formatCategoryName(cat.name)}
                  </option>
                ))}
              </select>
              <Icon
                icon="mdi:chevron-down"
                className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>
          </div>

          {/* Assigned Store */}
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
            {errors.store_id && <p className="text-[11px] text-red-500">{errors.store_id}</p>}
          </div>

          {/* Organizational Unit */}
          <div className="space-y-1">
            <label className={labelClasses}>Unit (Default: HQ)</label>
            <div className="relative">
              <select
                value={values.unit_id}
                onChange={handleChange("unit_id")}
                className={selectClasses}
                disabled={isUnitsLoading}
              >
                <option value="">{isUnitsLoading ? "Loading units..." : "Select Unit"}</option>
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

          {/* Aircraft Model Applicability */}
          <div className="space-y-1">
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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. COMMON PART INFORMATION SECTION */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
            <span>COMMON PART INFORMATION</span>
            <span className="rounded bg-[#0A4D66]/30 px-2 py-0.5 text-[10px] font-semibold text-[#7FD5FF]">
              Shared Specifications
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Entered once and inherited by individual units
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Part Name / Description */}
            <div className="space-y-1 sm:col-span-2">
              <label className={labelClasses}>
                Part Name / Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={values.description}
                onChange={handleChange("description")}
                className={cn(inputClasses, errors.description && "border-red-500")}
                placeholder="e.g. HYDRAULIC ACTUATOR CYLINDER ASSY"
                required
              />
              {errors.description && (
                <p className="text-[11px] text-red-500">{errors.description}</p>
              )}
            </div>

            {/* 2. Part Number (P/N) */}
            <div className="space-y-1">
              <label className={labelClasses}>
                Part Number (P/N) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={values.part_number}
                onChange={(e) => {
                  const val = e.target.value;
                  setValues((prev) => ({
                    ...prev,
                    part_number: val,
                    units: prev.units.map((u) => ({
                      ...u,
                      part_number: u.part_number && u.part_number !== prev.part_number ? u.part_number : val,
                    })),
                  }));
                  setErrors((prev) => ({ ...prev, part_number: undefined }));
                }}
                className={cn(inputClasses, "font-mono font-medium", errors.part_number && "border-red-500")}
                placeholder="e.g. HP-60750"
                required
              />
              {errors.part_number && (
                <p className="text-[11px] text-red-500">{errors.part_number}</p>
              )}
            </div>

            {/* 3. ATA Chapter (Searchable dropdown) */}
            <div className="space-y-1">
              <label className={labelClasses}>ATA Chapter</label>
              <SearchableSelect
                placeholder={isAtaLoading ? "Loading chapters..." : "-- Select ATA Chapter --"}
                searchPlaceholder="Search ATA code or chapter name..."
                options={ataOptions}
                value={values.ata_chapter_id === "" ? null : values.ata_chapter_id}
                onChange={(val) => {
                  const numVal = val !== null ? Number(val) : "";
                  const found = ataChapters.find((a) => a.id === numVal);
                  setValues((prev) => ({
                    ...prev,
                    ata_chapter_id: numVal,
                    ata_chapter: found?.code || "",
                    units: prev.units.map((u) => ({
                      ...u,
                      ata_chapter_id: u.ata_chapter_id && u.ata_chapter_id !== prev.ata_chapter_id ? u.ata_chapter_id : numVal,
                      ata_chapter: u.ata_chapter && u.ata_chapter !== prev.ata_chapter ? u.ata_chapter : (found?.code || ""),
                    })),
                  }));
                }}
                size="sm"
                clearable
              />
            </div>

            {/* 4. NSN */}
            <div className="space-y-1">
              <label className={labelClasses}>
                NATO Stock Number (NSN) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
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
                className={cn(inputClasses, "font-mono")}
                placeholder="e.g. 2840-01-523-9988"
              />
            </div>

            {/* 5. CAGE Code */}
            <div className="space-y-1">
              <label className={labelClasses}>
                CAGE Code <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
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
                className={cn(inputClasses, "font-mono")}
                placeholder="e.g. 77272"
                maxLength={20}
              />
            </div>

            {/* 6. Quantity Received */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClasses}>
                  Quantity Received <span className="text-red-500">*</span>
                </label>
                {requiresSerialTracking && (
                  <span className="text-[10px] text-sky-400 font-semibold">
                    Generates {qtyNumeric} Unit Records
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={values.current_stock}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className={cn(
                  inputClasses,
                  "font-bold text-sky-600 dark:text-sky-300 text-sm",
                  errors.current_stock && "border-red-500",
                )}
                placeholder="e.g. 3"
                required
              />
              {errors.current_stock && (
                <p className="text-[11px] text-red-500">{errors.current_stock}</p>
              )}
            </div>

            {/* 7. Unit Cost */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className={labelClasses}>Unit Cost</label>
                <div className="flex items-center gap-1">
                  <select
                    value={values.currency_id}
                    onChange={handleChange("currency_id")}
                    disabled={isCurrenciesLoading}
                    className="text-[10px] bg-transparent text-slate-500 dark:text-slate-400 focus:outline-none"
                    title="Change Currency"
                  >
                    {currencies.map((curr) => (
                      <option key={curr.id} value={curr.id}>
                        {curr.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
                  className={cn(inputClasses, "pl-8 font-mono")}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* 8. Supplier */}
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

            {/* 9. Date Received */}
            <div className="space-y-1">
              <label className={labelClasses}>Date Received</label>
              <input
                type="date"
                value={values.date_received || new Date().toISOString().split("T")[0]}
                onChange={handleChange("date_received")}
                className={inputClasses}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. ITEM IDENTIFICATION SECTION */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
            <span>ITEM IDENTIFICATION</span>
            {requiresSerialTracking === true && (
              <span className="rounded bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                {qtyNumeric} Serialized Units Required
              </span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Question & Radio Options */}
          <div className="space-y-2 rounded-lg p-4 bg-slate-50 dark:bg-[#001825]/60 border border-slate-200 dark:border-[#0A4D66]/30">
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
              Does this component require individual serial-number tracking?
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-medium text-slate-800 dark:text-gray-200">
                <input
                  type="radio"
                  name="serial_number_tracking"
                  value="yes"
                  checked={requiresSerialTracking === true}
                  onChange={() => {
                    setRequiresSerialTracking(true);
                    setErrors((prev) => ({ ...prev, serial_number: undefined }));
                  }}
                  className="w-4 h-4 text-[#0369A1] focus:ring-[#0369A1]"
                />
                <span>Yes — Each unit has an individual serial number</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-medium text-slate-800 dark:text-gray-200">
                <input
                  type="radio"
                  name="serial_number_tracking"
                  value="no"
                  checked={requiresSerialTracking === false}
                  onChange={() => {
                    setRequiresSerialTracking(false);
                    setErrors((prev) => ({ ...prev, serial_number: undefined }));
                    setUnitErrors({});
                  }}
                  className="w-4 h-4 text-[#0369A1] focus:ring-[#0369A1]"
                />
                <span>No — Non-serialized batch stock</span>
              </label>
            </div>

            {errors.serial_number && (
              <p className="text-xs text-red-500 font-medium pt-1">{errors.serial_number}</p>
            )}
          </div>

          {/* WHEN USER SELECTS YES: Individual Unit Identification Rows */}
          {requiresSerialTracking === true && (
            <div className="space-y-4 pt-1">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-[#0A4D66]/30 pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:format-list-numbered" className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                    Unit Identification Table ({qtyNumeric} Units)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoSequenceSerials}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                    title="Generate sequential serial numbers (e.g. SN-001, SN-002...)"
                  >
                    <Icon icon="mdi:numeric" className="w-3.5 h-3.5" />
                    <span>Auto-Sequence Serials</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBulkPasteOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
                    title="Paste serial numbers list at once"
                  >
                    <Icon icon="mdi:clipboard-text-outline" className="w-3.5 h-3.5" />
                    <span>Bulk Paste Serials</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllSerials}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                    title="Clear all entered serials"
                  >
                    <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Duplicate Serial Alert */}
              {duplicateSerialSet.size > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                  <Icon icon="mdi:alert" className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Duplicate serial numbers detected in this batch ({duplicateSerialSet.size} duplicates)! Every physical unit must possess a unique serial number.
                  </span>
                </div>
              )}

              {/* Unit Rows List */}
              <div className="space-y-3">
                {values.units.map((unit, idx) => {
                  const s = unit.serial_number.trim();
                  const isDup = s && duplicateSerialSet.has(s.toLowerCase());
                  const errMessage = unitErrors[idx];

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-3.5 rounded-xl border bg-slate-50/60 dark:bg-[#001825] transition-colors space-y-3",
                        (isDup || errMessage)
                          ? "border-red-500/70 bg-red-50/20 dark:bg-red-950/10"
                          : "border-slate-200 dark:border-[#0A4D66]/30",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 dark:border-[#0A4D66]/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-[#0A4D66] text-white">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                            UNIT {idx + 1}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 font-mono">
                          Part: <span className="text-sky-500 font-medium">{unit.part_number || values.part_number || "P/N not set"}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Serial Number (Always visible and mandatory) */}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                            Serial Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={unit.serial_number}
                            onChange={(e) =>
                              handleUnitFieldChange(idx, "serial_number", e.target.value)
                            }
                            className={cn(
                              inputClasses,
                              "font-mono font-medium",
                              (isDup || errMessage) && "border-red-500 focus:border-red-500 focus:ring-red-500/30",
                            )}
                            placeholder={`Enter serial number for Unit ${idx + 1}`}
                            required
                          />
                          {errMessage && (
                            <p className="text-[10px] text-red-500 font-medium">{errMessage}</p>
                          )}
                          {isDup && !errMessage && (
                            <p className="text-[10px] text-red-500 font-medium">
                              Duplicate serial number in batch
                            </p>
                          )}
                        </div>

                        {/* CONDITIONAL VARIATION 1: Different Part Number */}
                        {identifierVariations.differentPartNumbers && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                Unit Part No. (P/N)
                              </label>
                              <span className="text-[10px] text-slate-400 font-mono">Override</span>
                            </div>
                            <input
                              type="text"
                              value={unit.part_number}
                              onChange={(e) =>
                                handleUnitFieldChange(idx, "part_number", e.target.value)
                              }
                              className={cn(inputClasses, "font-mono border-amber-500/50")}
                              placeholder={values.part_number || "Custom P/N"}
                            />
                          </div>
                        )}

                        {/* CONDITIONAL VARIATION 2: Different NSN */}
                        {identifierVariations.differentNsns && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                Unit NSN
                              </label>
                              <span className="text-[10px] text-slate-400 font-mono">Override</span>
                            </div>
                            <input
                              type="text"
                              value={unit.nsn}
                              onChange={(e) =>
                                handleUnitFieldChange(idx, "nsn", e.target.value)
                              }
                              className={cn(inputClasses, "font-mono border-amber-500/50")}
                              placeholder={values.nsn || "Custom NSN"}
                            />
                          </div>
                        )}

                        {/* CONDITIONAL VARIATION 3: Different CAGE Code */}
                        {identifierVariations.differentCageCodes && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                Unit CAGE Code
                              </label>
                              <span className="text-[10px] text-slate-400 font-mono">Override</span>
                            </div>
                            <input
                              type="text"
                              value={unit.cage_code}
                              onChange={(e) =>
                                handleUnitFieldChange(idx, "cage_code", e.target.value)
                              }
                              className={cn(inputClasses, "font-mono border-amber-500/50")}
                              placeholder={values.cage_code || "Custom CAGE"}
                            />
                          </div>
                        )}

                        {/* CONDITIONAL VARIATION 4: Different ATA Chapter */}
                        {identifierVariations.differentAtaChapters && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                Unit ATA Chapter
                              </label>
                              <span className="text-[10px] text-slate-400 font-mono">Override</span>
                            </div>
                            <select
                              value={unit.ata_chapter_id || ""}
                              onChange={(e) =>
                                handleUnitAtaChange(
                                  idx,
                                  e.target.value ? Number(e.target.value) : null,
                                )
                              }
                              className={cn(selectClasses, "border-amber-500/50")}
                            >
                              <option value="">
                                Inherit Common ({selectedAta?.code || values.ata_chapter || "Common ATA"})
                              </option>
                              {ataChapters.map((ata) => (
                                <option key={ata.id} value={ata.id}>
                                  {ata.code || `ATA ${ata.chapter_number || ata.id}`} {ata.name ? `- ${ata.name}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WHEN USER SELECTS NO: Non-Serialized Notice */}
          {requiresSerialTracking === false && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#001825]/80 border border-slate-200 dark:border-[#0A4D66]/30 flex items-start gap-3">
              <Icon icon="mdi:layers-outline" className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-800 dark:text-white">
                  Non-Serialized Component Registration
                </p>
                <p className="text-slate-500 dark:text-gray-400">
                  This stock will be recorded as a single batch quantity of <strong>{qtyNumeric} units</strong> under Part Number <strong>{values.part_number || "[Pending]"}</strong>. Individual serial numbers will not be tracked in the inventory unit registry.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. IDENTIFIER VARIATIONS SECTION */}
      {/* ========================================================================= */}
      {requiresSerialTracking === true && (
        <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white flex items-center gap-2">
              <span>IDENTIFIER VARIATIONS</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Only select if specific units differ from the common part specifications
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                Do any units have different identification details?
              </p>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Checking an option reveals its corresponding override field on each unit row above. Units with blank overrides automatically inherit the common part details.
              </p>
            </div>

            {/* Checkbox Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Checkbox A: Different Part Numbers */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-xs font-medium",
                  identifierVariations.differentPartNumbers
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500/60 text-amber-800 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-[#001825] border-slate-200 dark:border-[#0A4D66]/30 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#002233]",
                )}
              >
                <input
                  type="checkbox"
                  checked={identifierVariations.differentPartNumbers}
                  onChange={(e) =>
                    setIdentifierVariations((prev) => ({
                      ...prev,
                      differentPartNumbers: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Different Part Numbers</span>
              </label>

              {/* Checkbox B: Different NSNs */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-xs font-medium",
                  identifierVariations.differentNsns
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500/60 text-amber-800 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-[#001825] border-slate-200 dark:border-[#0A4D66]/30 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#002233]",
                )}
              >
                <input
                  type="checkbox"
                  checked={identifierVariations.differentNsns}
                  onChange={(e) =>
                    setIdentifierVariations((prev) => ({
                      ...prev,
                      differentNsns: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Different NSNs</span>
              </label>

              {/* Checkbox C: Different CAGE Codes */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-xs font-medium",
                  identifierVariations.differentCageCodes
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500/60 text-amber-800 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-[#001825] border-slate-200 dark:border-[#0A4D66]/30 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#002233]",
                )}
              >
                <input
                  type="checkbox"
                  checked={identifierVariations.differentCageCodes}
                  onChange={(e) =>
                    setIdentifierVariations((prev) => ({
                      ...prev,
                      differentCageCodes: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Different CAGE Codes</span>
              </label>

              {/* Checkbox D: Different ATA Chapters */}
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-xs font-medium",
                  identifierVariations.differentAtaChapters
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500/60 text-amber-800 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-[#001825] border-slate-200 dark:border-[#0A4D66]/30 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#002233]",
                )}
              >
                <input
                  type="checkbox"
                  checked={identifierVariations.differentAtaChapters}
                  onChange={(e) =>
                    setIdentifierVariations((prev) => ({
                      ...prev,
                      differentAtaChapters: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Different ATA Chapters</span>
              </label>
            </div>

            {/* Quick Batch Assign Bar (if any variation is active) */}
            {(identifierVariations.differentPartNumbers ||
              identifierVariations.differentNsns ||
              identifierVariations.differentCageCodes ||
              identifierVariations.differentAtaChapters) && (
              <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-500/30 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Icon icon="mdi:flash-outline" className="w-4 h-4" />
                  Quick Batch Override:
                </span>

                <select
                  value={batchOverrideField}
                  onChange={(e) => setBatchOverrideField(e.target.value as any)}
                  className="rounded border border-amber-400 dark:border-amber-600/50 bg-white dark:bg-[#001219] px-2 py-1 text-xs text-slate-800 dark:text-white"
                >
                  <option value="">-- Choose Field to Apply --</option>
                  {identifierVariations.differentPartNumbers && (
                    <option value="part_number">Part Number</option>
                  )}
                  {identifierVariations.differentNsns && (
                    <option value="nsn">NSN</option>
                  )}
                  {identifierVariations.differentCageCodes && (
                    <option value="cage_code">CAGE Code</option>
                  )}
                  {identifierVariations.differentAtaChapters && (
                    <option value="ata_chapter">ATA Chapter</option>
                  )}
                </select>

                {batchOverrideField === "ata_chapter" ? (
                  <select
                    value={batchOverrideAtaId}
                    onChange={(e) => setBatchOverrideAtaId(e.target.value ? Number(e.target.value) : "")}
                    className="rounded border border-amber-400 dark:border-amber-600/50 bg-white dark:bg-[#001219] px-2 py-1 text-xs text-slate-800 dark:text-white"
                  >
                    <option value="">-- Select ATA Chapter --</option>
                    {ataChapters.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                ) : batchOverrideField ? (
                  <input
                    type="text"
                    value={batchOverrideValue}
                    onChange={(e) => setBatchOverrideValue(e.target.value)}
                    placeholder={`Enter value for all units...`}
                    className="rounded border border-amber-400 dark:border-amber-600/50 bg-white dark:bg-[#001219] px-2.5 py-1 text-xs text-slate-800 dark:text-white font-mono"
                  />
                ) : null}

                {batchOverrideField && (
                  <button
                    type="button"
                    onClick={handleApplyBatchOverride}
                    className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                  >
                    Apply to All Units
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. OPTIONAL TECHNICAL SPECIFICATIONS & LIFE LIMITS (Collapsible) */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-[#001219] border border-slate-200 dark:border-[#0A4D66]/40 rounded-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowTechnicalSpecs((prev) => !prev)}
          className="w-full px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-[#0A4D66]/40 bg-slate-50 dark:bg-[#001825]/80 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-[#002233] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon icon="mdi:cog-outline" className="w-4 h-4 text-sky-500" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-white">
              Optional Technical Specifications &amp; Life Limits
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{showTechnicalSpecs ? "Hide" : "Expand"}</span>
            <Icon
              icon={showTechnicalSpecs ? "mdi:chevron-up" : "mdi:chevron-down"}
              className="w-4 h-4"
            />
          </div>
        </button>

        {showTechnicalSpecs && (
          <div className="p-4 sm:p-6 space-y-4 text-xs">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Manufacturer */}
              <div className="space-y-1">
                <label className={labelClasses}>Manufacturer (MFR)</label>
                <input
                  type="text"
                  value={values.manufacturer}
                  onChange={handleChange("manufacturer")}
                  className={inputClasses}
                  placeholder="e.g. Leonardo, Honeywell, Safran"
                />
              </div>

              {/* Alt Support P/N */}
              <div className="space-y-1">
                <label className={labelClasses}>Alt Support P/N</label>
                <input
                  type="text"
                  value={values.alternate_support_part_no}
                  onChange={handleChange("alternate_support_part_no")}
                  className={cn(inputClasses, "font-mono")}
                  placeholder="e.g. ALT-109-88"
                />
              </div>

              {/* Special Storage */}
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClasses}>Storage Environment</label>
                <select
                  value={values.special_storage}
                  onChange={handleChange("special_storage")}
                  className={selectClasses}
                >
                  <option value="standard">Standard Warehouse Storage</option>
                  <option value="bonded">Bonded Store (Customs Controlled)</option>
                  <option value="quarantine">Quarantine / Inspection Hold</option>
                  <option value="flammable">Flammable Liquid / Combustible Locker</option>
                  <option value="cold_storage">Cold Storage / Refrigerated</option>
                  <option value="esd_sensitive">ESD Sensitive (Electrostatic)</option>
                  <option value="hazmat">Hazardous Materials (HAZMAT)</option>
                  <option value="rubber">Rubber &amp; Elastomer Controlled Environment</option>
                  <option value="others">Other Specialized Storage</option>
                </select>
              </div>

              {/* Re-Order Level */}
              <div className="space-y-1">
                <label className={labelClasses}>Re-Order Threshold Level</label>
                <input
                  type="number"
                  min="0"
                  value={values.re_order_level}
                  onChange={handleChange("re_order_level")}
                  className={inputClasses}
                  placeholder="1"
                />
              </div>

              {/* Lead Time */}
              <div className="space-y-1">
                <label className={labelClasses}>Procurement Lead Time</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={values.lead_time_days}
                    onChange={handleChange("lead_time_days")}
                    className={inputClasses}
                    placeholder="14"
                  />
                  <select
                    value={values.lead_time_unit}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        lead_time_unit: e.target.value as any,
                      }))
                    }
                    className={cn(selectClasses, "w-28")}
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClasses}>Internal Remarks / Traceability Notes</label>
                <input
                  type="text"
                  value={values.remark}
                  onChange={handleChange("remark")}
                  className={inputClasses}
                  placeholder="e.g. Received under Certificate of Conformance (CoC) 2026-X"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Persistent Form Footer with Review & Save */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#0A4D66]/30">
        <CancelButton fallbackUrl="/dashboard/inventory" isDirty={isFormDirty} label="Cancel" size="md" />
        <button
          type="button"
          onClick={handleProceedToReview}
          className="h-11 px-8 min-w-[200px] bg-[#0369A1] hover:bg-[#025682] text-white text-sm font-bold rounded-lg transition-colors shadow-md inline-flex items-center justify-center gap-2"
        >
          <Icon icon="mdi:clipboard-check-outline" className="w-4 h-4" />
          <span>Review &amp; Save Stock</span>
        </button>
      </div>

      {/* Modal: Quantity Reduction Warning */}
      <Modal
        open={showQuantityWarningModal}
        onClose={() => {
          setShowQuantityWarningModal(false);
          setPendingQuantity(null);
        }}
        title="Confirm Quantity Reduction"
      >
        <div className="space-y-4 p-2 text-xs sm:text-sm">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
            <Icon icon="mdi:alert" className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Entered Serial Numbers Will Be Truncated</p>
              <p className="text-xs pt-1">
                Reducing quantity from <strong>{values.units.length}</strong> to <strong>{pendingQuantity}</strong> will discard the entered serial numbers for units {pendingQuantity !== null ? pendingQuantity + 1 : ""}{" "}
                through {values.units.length}.
              </p>
            </div>
          </div>

          <p className="text-slate-600 dark:text-gray-300">
            Are you sure you want to reduce the batch size and discard these unit serial numbers?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowQuantityWarningModal(false);
                setPendingQuantity(null);
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-gray-200 transition-colors"
            >
              Cancel (Keep Current Quantity)
            </button>
            <button
              type="button"
              onClick={handleConfirmQuantityReduction}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
            >
              Proceed &amp; Discard Excess Units
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Bulk Paste Serial Numbers */}
      <Modal
        open={isBulkPasteOpen}
        onClose={() => {
          setIsBulkPasteOpen(false);
          setBulkSerialsText("");
        }}
        title="Bulk Paste Serial Numbers"
      >
        <div className="space-y-4 p-2 text-xs sm:text-sm">
          <p className="text-slate-600 dark:text-gray-300">
            Paste serial numbers separated by newlines, commas, or tabs. Each serial number will be sequentially assigned to Unit #1, Unit #2, etc.
          </p>
          <textarea
            rows={6}
            value={bulkSerialsText}
            onChange={(e) => setBulkSerialsText(e.target.value)}
            className={cn(inputClasses, "font-mono text-xs")}
            placeholder={`SN-001\nSN-002\nSN-003`}
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsBulkPasteOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyBulkSerials}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0369A1] hover:bg-[#025682] text-white"
            >
              Apply Serials
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
