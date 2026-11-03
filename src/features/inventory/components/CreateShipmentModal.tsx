import React, { useState, useEffect } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  type ShipmentStatus,
  type ShipmentPurpose,
  type ShipmentCargoItem,
  useCreateShipmentMutation,
  useGetPurchaseOrdersQuery,
  useGetSuppliersQuery,
} from "../api";
import { useGetUnitsQuery } from "@/shared/api/units";
import { useGetAssetsQuery } from "@/features/assets/api";

interface CreateShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId?: number;
  poName?: string;
  defaultExpectedDate?: string | null;
  initialStandalone?: boolean;
  onSuccess?: () => void;
}

export const SHIPMENT_PURPOSES: {
  key: ShipmentPurpose;
  label: string;
  desc: string;
  icon: string;
  badgeClass: string;
}[] = [
  {
    key: "direct_consignment",
    label: "Direct / Ministry Consignment",
    desc: "Government defense transfer or direct delivery",
    icon: "mdi:package-variant",
    badgeClass: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  },
  {
    key: "procurement",
    label: "Procurement / Purchase Order",
    desc: "Parts & consumables ordered from suppliers",
    icon: "mdi:cart-outline",
    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
  {
    key: "repair_overhaul",
    label: "Repair & Overhaul (R&O / MRO)",
    desc: "Rotables/engines sent to or returning from MRO",
    icon: "mdi:wrench-clock",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  {
    key: "inter_base_transfer",
    label: "Inter-Base / Unit Transfer",
    desc: "Internal logistics between air wings & forward bases",
    icon: "mdi:swap-horizontal",
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  },
  {
    key: "aog_emergency",
    label: "AOG Critical / Emergency Parts",
    desc: "Expedited delivery for Aircraft On Ground recovery",
    icon: "mdi:alert-octagon",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  {
    key: "exchange_loan",
    label: "Borrow / Loan / Exchange",
    desc: "Component pool swap or loan with partner fleets",
    icon: "mdi:handshake-outline",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  },
  {
    key: "return_to_vendor",
    label: "Return to Vendor (RTV / Warranty)",
    desc: "Warranty return or defective core repatriation",
    icon: "mdi:arrow-u-left-top",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
];

const CARRIERS = [
  { code: "auto-detect", name: "Auto-Detect Carrier (TrackingMore)" },
  { code: "dhl", name: "DHL Aviation / Express" },
  { code: "fedex", name: "FedEx Cargo" },
  { code: "ups", name: "UPS Air Freight" },
  { code: "naf-cargo", name: "Tactical Air Transport (Military Transport)" },
  { code: "panalpina", name: "Panalpina / DSV Air & Sea" },
  { code: "bollore", name: "Bolloré Africa Logistics" },
  { code: "allied-air", name: "Allied Air Cargo" },
  { code: "astral-aviation", name: "Astral Aviation" },
  { code: "other", name: "Other Commercial Forwarder" },
];

export const CreateShipmentModal: React.FC<CreateShipmentModalProps> = ({
  isOpen,
  onClose,
  purchaseOrderId: initialPoId,
  poName: initialPoName,
  defaultExpectedDate,
  initialStandalone = false,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const dispatch = useAppDispatch();

  // Queries for dropdown selectors
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery(undefined, { skip: !isOpen });
  const { data: suppliers = [] } = useGetSuppliersQuery(undefined, { skip: !isOpen });
  const { data: units = [] } = useGetUnitsQuery(undefined, { skip: !isOpen });
  const { data: aircraftAssets = [] } = useGetAssetsQuery({ type: "aircraft" }, { skip: !isOpen });

  // Mode: Standalone tracking (no PO needed) vs Linked to PO
  const [trackingMode, setTrackingMode] = useState<"standalone" | "po">(
    initialPoId ? "po" : initialStandalone ? "standalone" : "standalone"
  );

  // Form State
  const [purpose, setPurpose] = useState<ShipmentPurpose>(
    initialPoId ? "procurement" : "direct_consignment",
  );
  const [title, setTitle] = useState("");
  const [selectedPoId, setSelectedPoId] = useState<string>(initialPoId ? String(initialPoId) : "");
  const [referenceNumbers, setReferenceNumbers] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [vendorName, setVendorName] = useState("");
  const [assetId, setAssetId] = useState<string>("");
  const [originUnitId, setOriginUnitId] = useState<string>("");
  const [destinationUnitId, setDestinationUnitId] = useState<string>("");

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierCode, setCarrierCode] = useState("auto-detect");
  const [origin, setOrigin] = useState("Supplier Hub / OEM Facility");
  const [destination, setDestination] = useState("NAA Central Aviation Wing, Hangar 1");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(defaultExpectedDate || "");
  const [initialStatus, setInitialStatus] = useState<ShipmentStatus>("picked_up");
  const [customsReference, setCustomsReference] = useState("");
  const [notes, setNotes] = useState("");
  const [cargoItems, setCargoItems] = useState<ShipmentCargoItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [createShipment, { isLoading }] = useCreateShipmentMutation();

  // Keep state synced if props change
  useEffect(() => {
    if (initialPoId) {
      setTrackingMode("po");
      setSelectedPoId(String(initialPoId));
      setPurpose("procurement");
      setTitle(`PO #${initialPoId} Supply Consignment`);
    } else if (initialStandalone) {
      setTrackingMode("standalone");
      setSelectedPoId("");
      setPurpose("direct_consignment");
    }
  }, [initialPoId, initialStandalone]);

  // Auto-populate supplier if PO selected
  const handlePoChange = (poIdStr: string) => {
    setSelectedPoId(poIdStr);
    if (!poIdStr) return;
    const po = purchaseOrders.find((p) => String(p.id) === poIdStr);
    if (po) {
      if (!title) setTitle(`PO #${po.id} Supply Consignment`);
      if (po.supplier_id) setSupplierId(String(po.supplier_id));
      if (po.expected_date_of_delivery && !estimatedDeliveryDate) {
        setEstimatedDeliveryDate(po.expected_date_of_delivery);
      }
      if (po.items && po.items.length > 0) {
        const mapped: ShipmentCargoItem[] = po.items.map((it, idx) => ({
          id: it.id || `po-item-${idx}`,
          part_name: it.inventory?.description || it.inventory?.part_name || "Aircraft Spare Part",
          part_number: it.inventory?.part_number || it.part_number || "P/N-N/A",
          alternate_part_number: it.inventory?.alternate_support_part_no || null,
          serial_number: it.inventory?.serial_number || null,
          nsn: it.inventory?.nsn || null,
          quantity: Number(it.quantity_ordered) || 1,
          uom: it.inventory?.unit_of_issue || it.inventory?.measurement_unit || "EA",
          condition: "Serviceable",
          remarks: null,
        }));
        setCargoItems(mapped);
      }
    }
  };

  // Auto-populate destination text if unit selected
  const handleDestinationUnitChange = (unitIdStr: string) => {
    setDestinationUnitId(unitIdStr);
    if (!unitIdStr) return;
    const unit = units.find((u) => String(u.id) === unitIdStr);
    if (unit) setDestination(unit.name);
  };

  // Auto-populate origin text if unit selected
  const handleOriginUnitChange = (unitIdStr: string) => {
    setOriginUnitId(unitIdStr);
    if (!unitIdStr) return;
    const unit = units.find((u) => String(u.id) === unitIdStr);
    if (unit) setOrigin(unit.name);
  };

  const handleAddCargoItem = () => {
    setCargoItems((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        part_name: "",
        part_number: "",
        serial_number: "",
        quantity: 1,
        condition: "Serviceable",
      },
    ]);
  };

  const handleRemoveCargoItem = (index: number) => {
    setCargoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCargoItem = <K extends keyof ShipmentCargoItem>(index: number, field: K, value: ShipmentCargoItem[K]) => {
    setCargoItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!trackingNumber.trim()) {
      setError("Please provide a Tracking ID or Air Waybill (AWB) number.");
      return;
    }

    try {
      const selectedCarrier = CARRIERS.find((c) => c.code === carrierCode);

      await createShipment({
        purchase_order_id: trackingMode === "po" && selectedPoId ? Number(selectedPoId) : undefined,
        purpose: trackingMode === "standalone" && purpose === "procurement" ? "direct_consignment" : purpose,
        title: title.trim() || undefined,
        supplier_id: supplierId ? Number(supplierId) : undefined,
        vendor_name: vendorName.trim() || undefined,
        origin_unit_id: originUnitId ? Number(originUnitId) : undefined,
        destination_unit_id: destinationUnitId ? Number(destinationUnitId) : undefined,
        asset_id: assetId ? Number(assetId) : undefined,
        reference_numbers: referenceNumbers.trim() || undefined,
        tracking_number: trackingNumber.trim(),
        carrier_code: carrierCode === "other" ? "auto-detect" : carrierCode,
        carrier_name: selectedCarrier ? selectedCarrier.name : "Carrier Freight",
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        estimated_delivery_date: estimatedDeliveryDate || undefined,
        status: initialStatus,
        customs_reference: customsReference.trim() || undefined,
        notes: notes.trim() || undefined,
        cargo_manifest: cargoItems.filter(i => i.part_name.trim() || i.part_number.trim()),
      }).unwrap();

      dispatch(
        showToast({
          message: trackingMode === "standalone"
            ? "Standalone consignment tracking registered successfully."
            : "Shipment tracking registered and tied to Purchase Order.",
          type: "success",
        }),
      );
      onSuccess?.();
      onClose();
    } catch {
      setError("Failed to register shipment. Please verify details.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl border p-6 shadow-2xl transition-all my-8 max-h-[90vh] overflow-y-auto",
          isDark
            ? "bg-[#001219] border-[#0A4D66]/60 text-white"
            : "bg-white border-slate-200 text-slate-900 shadow-xl",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#0A4D66]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Icon icon="mdi:truck-fast-outline" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF]">
                Register Consignment / Shipment Tracking
              </h3>
              <p className={cn("text-xs", isDark ? "text-gray-400" : "text-slate-500")}>
                {trackingMode === "standalone"
                  ? "Standalone tracking mode · Direct consignment, MRO repairs, base transfers, and AOG parts"
                  : `Tied to PO #${selectedPoId || initialPoId || ""} ${initialPoName ? `• ${initialPoName}` : ""}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector: Standalone Tracking vs Link to Purchase Order */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                Tracking Mode
              </label>
              <span className="text-[11px] text-gray-400">
                {trackingMode === "standalone" ? "No Purchase Order required" : "Linked to procurement PO"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#001825] border border-[#0A4D66]/50">
              <button
                type="button"
                onClick={() => {
                  setTrackingMode("standalone");
                  setSelectedPoId("");
                  if (purpose === "procurement") setPurpose("direct_consignment");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                  trackingMode === "standalone"
                    ? "bg-[#0284C7] text-white shadow-md font-bold"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon icon="mdi:package-variant" className="w-4 h-4 text-emerald-400" />
                <span>Standalone Tracking (No PO)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackingMode("po");
                  setPurpose("procurement");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all",
                  trackingMode === "po"
                    ? "bg-[#0284C7] text-white shadow-md font-bold"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon icon="mdi:cart-outline" className="w-4 h-4 text-sky-400" />
                <span>Link to Purchase Order (PO)</span>
              </button>
            </div>
          </div>

          {/* Standalone Notification Banner */}
          {trackingMode === "standalone" && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5">
              <Icon icon="mdi:check-circle-outline" className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div className="text-[11px] leading-relaxed">
                <strong className="block text-emerald-300 font-semibold mb-0.5">
                  Standalone Tracking Active
                </strong>
                Tracking this consignment independently without tying to a purchase order.
                Ideal for OEM repairs &amp; overhauls, vendor warranty returns, direct defense deliveries, or inter-base aircraft spares transfers.
              </div>
            </div>
          )}

          {/* Shipment Purpose Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-gray-300 mb-1.5">
              Shipment Purpose / Consignment Type <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SHIPMENT_PURPOSES.map((p) => {
                const isSelected = purpose === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPurpose(p.key);
                      if (!title) setTitle(p.label);
                    }}
                    className={cn(
                      "flex flex-col text-left p-2.5 rounded-xl border text-xs transition-all",
                      isSelected
                        ? "border-[#0284C7] bg-[#0284C7]/15 ring-1 ring-[#0284C7] shadow-sm font-semibold"
                        : isDark
                        ? "border-[#0A4D66]/40 bg-[#001825] hover:border-sky-400/50 text-gray-300"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700",
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon icon={p.icon} className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate font-semibold">{p.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 line-clamp-1">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Consignment Title & Reference Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Consignment Title / Cargo Summary
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Main Rotor Actuators Overhaul Batch"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Reference Numbers (POs, WOs, RMA, Waybill)
              </label>
              <input
                type="text"
                value={referenceNumbers}
                onChange={(e) => setReferenceNumbers(e.target.value)}
                placeholder="e.g. PO #12, WO-410, RMA-8819"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                )}
              />
            </div>
          </div>

          {/* Linked PO / Sender, Supplier & Target Aircraft */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {trackingMode === "po" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Linked Purchase Order <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedPoId}
                  onChange={(e) => handlePoChange(e.target.value)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                      : "bg-white border-slate-300 text-slate-800",
                  )}
                >
                  <option value="">Select Purchase Order...</option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      PO #{po.id} {po.supplier?.name ? `(${po.supplier.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                  Sender / Dispatcher Agency
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. OEM, Logistics Command, Repair Base"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                      : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                  )}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Supplier / Repair Facility
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-white border-slate-300 text-slate-800",
                )}
              >
                <option value="">Select or leave blank</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Target Aircraft / Tail (if AOG/R&O)
              </label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-white border-slate-300 text-slate-800",
                )}
              >
                <option value="">Fleet-wide / General Stock</option>
                {aircraftAssets.map((ac) => (
                  <option key={ac.id} value={ac.id}>
                    {ac.tail_number || ac.name} ({ac.model || "Airframe"})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tracking ID & Carrier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Tracking Number / Air Waybill (AWB) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1234567890 or 020-8849201"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-sky-500 dark:text-sky-400",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 placeholder:text-gray-500"
                    : "bg-white border-slate-300 placeholder:text-slate-400",
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Logistics Carrier
              </label>
              <select
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-white border-slate-300 text-slate-800",
                )}
              >
                {CARRIERS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Origin & Destination with Unit helpers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Origin Location / Base
                </label>
                {units.length > 0 && (
                  <select
                    value={originUnitId}
                    onChange={(e) => handleOriginUnitChange(e.target.value)}
                    className="text-[10px] bg-transparent text-sky-500 hover:underline border-none cursor-pointer p-0"
                  >
                    <option value="">Pick base...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Origin depot / facility"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                )}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                  Destination Air Wing / Depot
                </label>
                {units.length > 0 && (
                  <select
                    value={destinationUnitId}
                    onChange={(e) => handleDestinationUnitChange(e.target.value)}
                    className="text-[10px] bg-transparent text-sky-500 hover:underline border-none cursor-pointer p-0"
                  >
                    <option value="">Pick base...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Destination hangar / QM store"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                )}
              />
            </div>
          </div>

          {/* Status & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Initial Status Stage
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as ShipmentStatus)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-white border-slate-300 text-slate-800",
                )}
              >
                <option value="picked_up">1. Picked Up</option>
                <option value="customs_clearance">2. Customs Clearance</option>
                <option value="in_transit">3. In Transit</option>
                <option value="delivered">4. Delivered</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Est. Delivery Date
              </label>
              <input
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white"
                    : "bg-white border-slate-300 text-slate-800",
                )}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
                Customs Ref / Form M #
              </label>
              <input
                type="text"
                value={customsReference}
                onChange={(e) => setCustomsReference(e.target.value)}
                placeholder="e.g. CUST-NAA-901"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                  isDark
                    ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                    : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
                )}
              />
            </div>
          </div>

          {/* Tracked Cargo Manifest Section */}
          <div className={cn("p-4 rounded-xl border space-y-3", isDark ? "bg-[#001825] border-[#0A4D66]/50" : "bg-slate-50 border-slate-200")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Icon icon="mdi:package-variant-closed" className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-gray-200">
                    Tracked Cargo Manifest & Aircraft Spares
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                    {cargoItems.length} {cargoItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Specify the individual parts, rotables, or supplies assigned to this Air Waybill
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCargoItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0A4D66] hover:bg-[#083c50] text-white shadow-sm transition-all"
              >
                <Icon icon="mdi:plus" className="w-3.5 h-3.5 text-sky-300" />
                <span>Add Part</span>
              </button>
            </div>

            {cargoItems.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[#0A4D66]/40 rounded-lg text-xs text-gray-400 space-y-1">
                <Icon icon="mdi:cube-outline" className="w-6 h-6 mx-auto opacity-40 text-sky-400" />
                <p className="font-medium text-gray-300">No items attached to this air waybill yet</p>
                <p className="text-[11px] text-gray-500">Click &ldquo;Add Part&rdquo; or link a Purchase Order above to auto-populate items.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                  <thead>
                    <tr className="border-b border-[#0A4D66]/30 text-gray-400 text-[10px] uppercase font-bold tracking-wider">
                      <th className="pb-1.5 pr-2">Part Description *</th>
                      <th className="pb-1.5 px-2">Part # (P/N)</th>
                      <th className="pb-1.5 px-2">Serial / NSN</th>
                      <th className="pb-1.5 px-2 w-16 text-center">Qty</th>
                      <th className="pb-1.5 px-2">Condition</th>
                      <th className="pb-1.5 pl-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A4D66]/20">
                    {cargoItems.map((item, idx) => (
                      <tr key={item.id ?? idx} className="py-1">
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={item.part_name}
                            onChange={(e) => handleUpdateCargoItem(idx, "part_name", e.target.value)}
                            placeholder="e.g. Hydraulic Actuator"
                            className="w-full rounded border border-[#0A4D66]/40 bg-[#001219] px-2 py-1 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.part_number}
                            onChange={(e) => handleUpdateCargoItem(idx, "part_number", e.target.value)}
                            placeholder="e.g. HYD-882-01"
                            className="w-full rounded border border-[#0A4D66]/40 bg-[#001219] px-2 py-1 text-xs font-mono text-sky-400 placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.serial_number || ""}
                            onChange={(e) => handleUpdateCargoItem(idx, "serial_number", e.target.value || null)}
                            placeholder="Optional S/N"
                            className="w-full rounded border border-[#0A4D66]/40 bg-[#001219] px-2 py-1 text-xs font-mono text-gray-300 placeholder:text-gray-500 focus:outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="py-1.5 px-2 w-16 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateCargoItem(idx, "quantity", Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-16 rounded border border-[#0A4D66]/40 bg-[#001219] px-1.5 py-1 text-xs text-center font-bold text-emerald-400 focus:outline-none focus:border-sky-500"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <select
                            value={item.condition || "Serviceable"}
                            onChange={(e) => handleUpdateCargoItem(idx, "condition", e.target.value)}
                            className="rounded border border-[#0A4D66]/40 bg-[#001219] px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-sky-500"
                          >
                            <option value="Serviceable">Serviceable</option>
                            <option value="Factory New">Factory New</option>
                            <option value="Awaiting Overhaul">Awaiting Overhaul</option>
                            <option value="Repairable">Repairable</option>
                            <option value="Defective / RTV">Defective / RTV</option>
                          </select>
                        </td>
                        <td className="py-1.5 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCargoItem(idx)}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            title="Remove part"
                          >
                            <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-gray-300 mb-1">
              Logistics Notes / Special Handling Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dangerous goods (lithium batteries), aircraft rotable, temperature controlled"
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500",
                isDark
                  ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder:text-gray-500"
                  : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400",
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#0A4D66]/20">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-semibold border transition-colors",
                isDark
                  ? "border-gray-700 text-gray-300 hover:bg-gray-800"
                  : "border-slate-300 text-slate-700 hover:bg-slate-100",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors shadow-md disabled:opacity-50"
            >
              <Icon
                icon={isLoading ? "mdi:loading" : "mdi:check"}
                className={cn("w-4 h-4", isLoading && "animate-spin")}
              />
              <span>{isLoading ? "Registering..." : "Register Consignment Tracking"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
