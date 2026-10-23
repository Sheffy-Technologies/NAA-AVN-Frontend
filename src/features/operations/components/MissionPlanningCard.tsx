import { useState, useMemo, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import {
  generateTacticalNavLog,
  calculateWindTriangle,
  calculateTacticalCriticalPoints,
  calculateIcaoFuelHierarchy,
  NIGERIA_AERONAUTICAL_DATABASE,
  type RouteFix,
  type NavLogSummary,
  type TacticalCriticalPoints,
  type IcaoFuelHierarchy,
} from "../utils/navigationEngine";
import { calculateBearing } from "../utils/coordinates";

export type MissionEquipmentConfig =
  | "slick_transport"
  | "armed_escort"
  | "cas_rockets"
  | "csar_hoist"
  | "extended_range"
  | "isr_recon";

export const MISSION_EQUIPMENT_OPTIONS: Array<{
  id: MissionEquipmentConfig;
  label: string;
  weightKg: number;
  description: string;
}> = [
  {
    id: "slick_transport",
    label: "Standard Utility / Troop Transport",
    weightKg: 0,
    description: "Standard cabin seating with no external tactical pods mounted.",
  },
  {
    id: "armed_escort",
    label: "Armed Escort (FLIR + 20mm Cannon / Gun Pod)",
    weightKg: 240,
    description: "Forward EO/IR sensor ball + twin external 7.62mm/20mm gun pods.",
  },
  {
    id: "cas_rockets",
    label: "Close Air Support (CAS) (70mm Rockets + Gun Pods)",
    weightKg: 380,
    description: "7-tube/19-tube 70mm rocket launchers with heavy armament pylon.",
  },
  {
    id: "csar_hoist",
    label: "Combat Search & Rescue (CSAR Hoist + Litter Kits)",
    weightKg: 120,
    description: "Electric rescue hoist (300kg capacity) + trauma stretchers.",
  },
  {
    id: "extended_range",
    label: "Extended Range Ferry (Auxiliary Cabin Fuel Tank)",
    weightKg: 95,
    description: "Auxiliary bladder/tank plumbing mounted in aft cabin.",
  },
  {
    id: "isr_recon",
    label: "Tactical ISR (EO/IR Sensor + High-Gain Datalink)",
    weightKg: 180,
    description: "Long-range thermal surveillance turret + encrypted military video datalink.",
  },
];

export type MissionPlanningData = {
  totalDistanceNm: number;
  totalDistanceKm: number;
  estimatedFlightHours: number;
  cruiseSpeedKts: number;
  burnRateLph: number;
  tripFuelLiters: number;
  taxiFuelLiters: number;
  reserveFuelLiters: number;
  totalFuelLiters: number;
  fleetTotalFuelLiters?: number;
  aircraftCount?: number;
  equipmentConfig: MissionEquipmentConfig;
  payloadKg: number;
  takeoffWeightKg: number;
  maxTakeoffWeightKg: number;
  isOverweight: boolean;
  // Advanced Navigation additions
  windDirectionDeg?: number;
  windSpeedKts?: number;
  averageGroundSpeedKts?: number;
  etpDistanceNm?: number;
  pnrDistanceNm?: number;
  contingencyFuelLiters?: number;
  alternateFuelLiters?: number;
  minimumBlockFuelLiters?: number;
};

type MissionPlanningCardProps = {
  departureLat?: number | string | null;
  departureLng?: number | string | null;
  arrivalLat?: number | string | null;
  arrivalLng?: number | string | null;
  waypoints?: Array<{
    name?: string | null;
    latitude: number | string;
    longitude: number | string;
  }>;
  unitId?: number | string | null;
  unitName?: string | null;
  operationName?: string | null;
  operationCode?: string | null;
  operationDate?: string | null;
  aircraftCount?: number;
  variant?: "all" | "legs-only" | "fuel-only" | "navlog" | "critical-points";
  isEditable?: boolean;
  onPlanningChange?: (data: MissionPlanningData) => void;
  className?: string;
};

export const MissionPlanningCard = ({
  departureLat,
  departureLng,
  arrivalLat,
  arrivalLng,
  waypoints = [],
  unitId,
  unitName,
  operationName,
  operationCode,
  operationDate,
  aircraftCount = 1,
  variant = "all",
  isEditable = true,
  onPlanningChange,
  className = "",
}: MissionPlanningCardProps) => {
  // Navigation & Flight Performance Parameters
  const [cruiseSpeedKts, setCruiseSpeedKts] = useState<number>(120); // True Airspeed (TAS)
  const [burnRateLph, setBurnRateLph] = useState<number>(240); // 240 L/hr light twin turbine
  const [windDirectionDeg, setWindDirectionDeg] = useState<number>(60); // 060° Harmattan/NE Trade wind typical
  const [windSpeedKts, setWindSpeedKts] = useState<number>(15); // 15 kts
  const [magneticVarDeg] = useState<number>(-2.0); // Nigeria -2° West declination
  const [selectedAlternateId, setSelectedAlternateId] = useState<string>("DNKA"); // Default Kaduna
  const [isIfrReserve, setIsIfrReserve] = useState<boolean>(false); // 30m VFR vs 45m IFR
  const [extraDiscretionaryFuelL, setExtraDiscretionaryFuelL] = useState<number>(50); // 50L tactical buffer

  // Weight & Balance State
  const [equipmentConfig, setEquipmentConfig] = useState<MissionEquipmentConfig>("slick_transport");
  const [payloadKg, setPayloadKg] = useState<number>(300);
  const [emptyWeightKg] = useState<number>(2100);
  const [maxTakeoffWeightKg] = useState<number>(3175);

  // Active View Tab in "all" variant
  const [activeTab, setActiveTab] = useState<
    "navlog" | "critical-points" | "fuel-hierarchy" | "weight-balance" | "full-dossier"
  >("navlog");

  // PDF Export Ref & State
  const dossierRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const effectiveAircraftCount = Math.max(1, Number(aircraftCount) || 1);

  // Fetch unit inventory to check Jet A-1 fuel stock
  const { data: inventories = [], isLoading: isLoadingInventory } =
    useGetInventoriesQuery(unitId ? { unit_id: Number(unitId) } : undefined, {
      skip: !unitId,
    });

  // Calculate Available Jet A-1 Fuel Stock in Unit
  const availableFuelStock = useMemo(() => {
    if (!inventories || inventories.length === 0) return 0;

    const fuelItems = inventories.filter((item) => {
      const desc = (item.description || "").toLowerCase();
      const part = (item.part_number || "").toLowerCase();
      const serial = (item.serial_number || "").toLowerCase();
      const isFlammable = item.store === "flammable";
      const isFuelName =
        desc.includes("fuel") ||
        desc.includes("jet a") ||
        desc.includes("jet-a") ||
        desc.includes("avtur") ||
        desc.includes("kerosene") ||
        part.includes("jet") ||
        part.includes("fuel") ||
        serial.includes("fuel");

      return isFlammable || isFuelName;
    });

    return fuelItems.reduce((sum, item) => sum + (Number(item.current_stock) || 0), 0);
  }, [inventories]);

  // Construct Structured Route Fixes
  const routeFixes = useMemo<RouteFix[]>(() => {
    const depLatNum = Number(departureLat);
    const depLngNum = Number(departureLng);
    const arrLatNum = Number(arrivalLat);
    const arrLngNum = Number(arrivalLng);

    if (
      !departureLat ||
      !departureLng ||
      Number.isNaN(depLatNum) ||
      Number.isNaN(depLngNum)
    ) {
      return [];
    }

    const fixes: RouteFix[] = [
      { name: "DEP: Departure Fix", latitude: depLatNum, longitude: depLngNum, ident: "DEP" },
    ];

    waypoints.forEach((wp, idx) => {
      const wLat = Number(wp.latitude);
      const wLng = Number(wp.longitude);
      if (!Number.isNaN(wLat) && !Number.isNaN(wLng)) {
        fixes.push({
          name: wp.name?.trim() ? wp.name.trim() : `CP-${idx + 1}`,
          latitude: wLat,
          longitude: wLng,
          ident: `CP${idx + 1}`,
        });
      }
    });

    if (
      arrivalLat &&
      arrivalLng &&
      !Number.isNaN(arrLatNum) &&
      !Number.isNaN(arrLngNum)
    ) {
      fixes.push({
        name: "ARR: Destination Fix",
        latitude: arrLatNum,
        longitude: arrLngNum,
        ident: "ARR",
      });
    }

    return fixes;
  }, [departureLat, departureLng, arrivalLat, arrivalLng, waypoints]);

  const hasRouteCoordinates = routeFixes.length >= 2;

  // Baseline Initial Fuel on Board estimation for NavLog decrement (1,000L or 4.5h endurance)
  const estimatedInitialFobL = Math.round(burnRateLph * 4.0);

  // Compute Full Tactical NavLog (Dead-Reckoning with Wind Vectors)
  const navLogSummary: NavLogSummary = useMemo(() => {
    return generateTacticalNavLog(
      routeFixes,
      cruiseSpeedKts,
      windDirectionDeg,
      windSpeedKts,
      burnRateLph,
      estimatedInitialFobL,
      magneticVarDeg
    );
  }, [
    routeFixes,
    cruiseSpeedKts,
    windDirectionDeg,
    windSpeedKts,
    burnRateLph,
    estimatedInitialFobL,
    magneticVarDeg,
  ]);

  // Overall Direct Corridor Wind Triangle Analysis
  const corridorWindAnalysis = useMemo(() => {
    if (routeFixes.length < 2) return null;
    const dep = routeFixes[0];
    const arr = routeFixes[routeFixes.length - 1];
    const directCourseDeg = calculateBearing(dep.latitude, dep.longitude, arr.latitude, arr.longitude);
    return calculateWindTriangle(cruiseSpeedKts, windDirectionDeg, windSpeedKts, directCourseDeg, magneticVarDeg);
  }, [routeFixes, cruiseSpeedKts, windDirectionDeg, windSpeedKts, magneticVarDeg]);

  // Destination coordinates for Alternate calculations
  const destinationCoords = useMemo(() => {
    if (routeFixes.length >= 2) {
      const last = routeFixes[routeFixes.length - 1];
      return { lat: last.latitude, lng: last.longitude };
    }
    return null;
  }, [routeFixes]);

  // Compute ICAO 6-Tier Fuel Hierarchy
  const icaoFuel: IcaoFuelHierarchy = useMemo(() => {
    return calculateIcaoFuelHierarchy(
      navLogSummary.totalEnrouteFuelLiters,
      burnRateLph,
      destinationCoords,
      selectedAlternateId,
      extraDiscretionaryFuelL,
      isIfrReserve
    );
  }, [
    navLogSummary.totalEnrouteFuelLiters,
    burnRateLph,
    destinationCoords,
    selectedAlternateId,
    extraDiscretionaryFuelL,
    isIfrReserve,
  ]);

  // Compute Tactical Critical Points (ETP & PNR)
  const criticalPoints: TacticalCriticalPoints = useMemo(() => {
    return calculateTacticalCriticalPoints(
      routeFixes,
      cruiseSpeedKts,
      windDirectionDeg,
      windSpeedKts,
      icaoFuel.totalRampFuelL,
      burnRateLph,
      icaoFuel.finalReserveFuelL
    );
  }, [
    routeFixes,
    cruiseSpeedKts,
    windDirectionDeg,
    windSpeedKts,
    icaoFuel.totalRampFuelL,
    burnRateLph,
    icaoFuel.finalReserveFuelL,
  ]);

  // Fleet Totals
  const fleetTotalFuelLiters = icaoFuel.totalRampFuelL * effectiveAircraftCount;
  const fleetFuelWeightKg = Math.round(fleetTotalFuelLiters * 0.804);
  const fleetTripFuelLiters = icaoFuel.tripFuelL * effectiveAircraftCount;
  const fleetTaxiFuelLiters = icaoFuel.taxiFuelL * effectiveAircraftCount;
  const fleetReserveFuelLiters = icaoFuel.finalReserveFuelL * effectiveAircraftCount;

  // Weight & Balance
  const selectedConfig =
    MISSION_EQUIPMENT_OPTIONS.find((opt) => opt.id === equipmentConfig) ||
    MISSION_EQUIPMENT_OPTIONS[0];

  const fuelWeightKg = Math.round(icaoFuel.totalRampFuelL * 0.804);
  const crewWeightKg = 170; // 2 pilots @ 85 kg
  const takeoffWeightKg =
    emptyWeightKg +
    selectedConfig.weightKg +
    fuelWeightKg +
    crewWeightKg +
    Number(payloadKg || 0);

  const isOverweight = takeoffWeightKg > maxTakeoffWeightKg;

  // Synchronize to Parent Callback
  useEffect(() => {
    if (onPlanningChange) {
      onPlanningChange({
        totalDistanceNm: navLogSummary.totalDistanceNm,
        totalDistanceKm: navLogSummary.totalDistanceKm,
        estimatedFlightHours: navLogSummary.totalFlightHours,
        cruiseSpeedKts,
        burnRateLph,
        tripFuelLiters: icaoFuel.tripFuelL,
        taxiFuelLiters: icaoFuel.taxiFuelL,
        reserveFuelLiters: icaoFuel.finalReserveFuelL,
        totalFuelLiters: icaoFuel.totalRampFuelL,
        fleetTotalFuelLiters,
        aircraftCount: effectiveAircraftCount,
        equipmentConfig,
        payloadKg,
        takeoffWeightKg,
        maxTakeoffWeightKg,
        isOverweight,
        windDirectionDeg,
        windSpeedKts,
        averageGroundSpeedKts: navLogSummary.averageGroundSpeedKts,
        etpDistanceNm: criticalPoints.etpDistanceNm,
        pnrDistanceNm: criticalPoints.pnrDistanceNm,
        contingencyFuelLiters: icaoFuel.contingencyFuelL,
        alternateFuelLiters: icaoFuel.alternateFuelL,
        minimumBlockFuelLiters: icaoFuel.minimumBlockFuelL,
      });
    }
  }, [
    navLogSummary.totalDistanceNm,
    navLogSummary.totalDistanceKm,
    navLogSummary.totalFlightHours,
    navLogSummary.averageGroundSpeedKts,
    cruiseSpeedKts,
    burnRateLph,
    icaoFuel,
    fleetTotalFuelLiters,
    effectiveAircraftCount,
    equipmentConfig,
    payloadKg,
    takeoffWeightKg,
    maxTakeoffWeightKg,
    isOverweight,
    windDirectionDeg,
    windSpeedKts,
    criticalPoints.etpDistanceNm,
    criticalPoints.pnrDistanceNm,
    onPlanningChange,
  ]);

  // Print Cockpit Kneeboard NavLog
  const handlePrintNavLog = () => {
    window.print();
  };

  // Download Comprehensive Route Analysis & Flight Plan PDF
  const handleDownloadPdf = async () => {
    if (!dossierRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const sanitizedName = (operationName || operationCode || "flight-plan")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-");

      await downloadElementAsPdf({
        element: dossierRef.current,
        fileName: `${sanitizedName}-route-analysis-flight-plan`,
        backgroundColor: "#001219",
      });
    } catch (err) {
      console.error("Failed to export Flight Plan PDF:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Sub-render: Flight Controls (Winds Aloft & Performance)
  const renderFlightControls = () => (
    <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825]/90 p-4 space-y-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/20 pb-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:weather-windy" className="w-4 h-4 text-[#7FD5FF]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Winds Aloft &amp; Airframe Cruise Performance (Tactical Vector Engine)
          </h4>
        </div>
        <span className="text-[11px] font-mono text-[#7FD5FF]">
          Avg GS: <strong className="text-white">{navLogSummary.averageGroundSpeedKts} kts</strong> (TAS {cruiseSpeedKts} kts)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Wind Direction Input */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Wind Direction (From)</span>
            <span className="text-[10px] text-gray-500 font-mono">0° - 360°</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              min={0}
              max={360}
              step="any"
              value={windDirectionDeg}
              disabled={!isEditable}
              onChange={(e) => {
                const val = e.target.value;
                const num = Number(val);
                setWindDirectionDeg(Number.isNaN(num) ? 0 : Math.max(0, Math.min(360, num)));
              }}
              placeholder="060"
              className="w-full bg-[#001825] border border-[#0A4D66]/60 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/50 pr-16 disabled:opacity-50"
            />
            <span className="absolute right-3 text-xs font-mono font-semibold text-[#7FD5FF] pointer-events-none select-none">
              ° True
            </span>
          </div>
        </div>

        {/* Wind Velocity Input */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Wind Velocity</span>
            <span className="text-[10px] text-gray-500 font-mono">Speed</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              min={0}
              max={150}
              step="any"
              value={windSpeedKts}
              disabled={!isEditable}
              onChange={(e) => {
                const val = e.target.value;
                const num = Number(val);
                setWindSpeedKts(Number.isNaN(num) ? 0 : Math.max(0, num));
              }}
              placeholder="15"
              className="w-full bg-[#001825] border border-[#0A4D66]/60 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/50 pr-12 disabled:opacity-50"
            />
            <span className="absolute right-3 text-xs font-mono font-semibold text-[#7FD5FF] pointer-events-none select-none">
              kts
            </span>
          </div>
        </div>

        {/* Planned TAS Input */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>True Airspeed (TAS)</span>
            <span className="text-[10px] text-gray-500 font-mono">Cruise</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              min={1}
              max={600}
              step="any"
              value={cruiseSpeedKts}
              disabled={!isEditable}
              onChange={(e) => {
                const val = e.target.value;
                const num = Number(val);
                setCruiseSpeedKts(Number.isNaN(num) ? 1 : Math.max(1, num));
              }}
              placeholder="120"
              className="w-full bg-[#001825] border border-[#0A4D66]/60 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/50 pr-12 disabled:opacity-50"
            />
            <span className="absolute right-3 text-xs font-mono font-semibold text-[#7FD5FF] pointer-events-none select-none">
              kts
            </span>
          </div>
        </div>

        {/* Burn Rate Input */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Jet A-1 Burn Rate</span>
            <span className="text-[10px] text-gray-500 font-mono">Rate</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              min={1}
              max={5000}
              step="any"
              value={burnRateLph}
              disabled={!isEditable}
              onChange={(e) => {
                const val = e.target.value;
                const num = Number(val);
                setBurnRateLph(Number.isNaN(num) ? 1 : Math.max(1, num));
              }}
              placeholder="240"
              className="w-full bg-[#001825] border border-[#0A4D66]/60 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/50 pr-12 disabled:opacity-50"
            />
            <span className="absolute right-3 text-xs font-mono font-semibold text-[#7FD5FF] pointer-events-none select-none">
              L/h
            </span>
          </div>
        </div>
      </div>

      {/* Live Tactical Vector Triangle Resolution (E6B Computer Display) */}
      {corridorWindAnalysis && (
        <div className="rounded-lg bg-[#001219]/90 border border-[#0A4D66]/50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A4D66]/30 border border-[#7FD5FF]/40 flex items-center justify-center text-[#7FD5FF]">
              <Icon icon="mdi:compass-rose" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase text-gray-400 font-bold block tracking-wider">
                Direct Corridor Track &amp; Heading Solution
              </span>
              <span className="font-mono text-white text-xs">
                Track: <strong className="text-[#7FD5FF]">{String(corridorWindAnalysis.trueCourseDeg).padStart(3, "0")}°T</strong> ({String(corridorWindAnalysis.magneticHeadingDeg).padStart(3, "0")}°M) &bull; Steering:{" "}
                <strong className="text-emerald-400">{corridorWindAnalysis.driftDescription}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
            <div className="flex items-center gap-1.5">
              <Icon
                icon={corridorWindAnalysis.isHeadwind ? "mdi:arrow-down-bold" : "mdi:arrow-up-bold"}
                className={`w-3.5 h-3.5 ${corridorWindAnalysis.isHeadwind ? "text-amber-400" : "text-emerald-400"}`}
              />
              <span className="text-gray-300">
                {corridorWindAnalysis.isHeadwind ? "Headwind" : "Tailwind"}:{" "}
                <strong className={corridorWindAnalysis.isHeadwind ? "text-amber-400" : "text-emerald-400"}>
                  {Math.abs(corridorWindAnalysis.headwindKts)} kts
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Icon icon="mdi:swap-horizontal" className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-gray-300">
                Crosswind:{" "}
                <strong className="text-sky-300">
                  {Math.abs(corridorWindAnalysis.crosswindKts)} kts
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Icon icon="mdi:speedometer" className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-gray-300">
                Resultant GS:{" "}
                <strong className="text-white text-xs font-bold">
                  {corridorWindAnalysis.groundSpeedKts} kts
                </strong>
                <span className="text-gray-500 ml-1">
                  ({corridorWindAnalysis.groundSpeedKts - cruiseSpeedKts >= 0 ? `+${corridorWindAnalysis.groundSpeedKts - cruiseSpeedKts}` : corridorWindAnalysis.groundSpeedKts - cruiseSpeedKts} kts)
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Sub-render: Tab 1 - Tactical NavLog Table
  const renderNavLogTable = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:table-clock" className="w-4 h-4 text-[#7FD5FF]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Tactical Dead-Reckoning Navigation Log ({navLogSummary.legs.length} Sortie Legs)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-300 font-mono">
            Total Corridor: <strong className="text-white">{navLogSummary.totalDistanceNm} NM</strong> ({navLogSummary.totalDistanceKm} km) • Total ETE:{" "}
            <strong className="text-emerald-400">
              {Math.floor(navLogSummary.totalFlightHours)}h {Math.round((navLogSummary.totalFlightHours % 1) * 60)}m
            </strong>
          </span>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || !hasRouteCoordinates}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#0284c7] disabled:opacity-50 rounded-lg transition-colors print:hidden shadow-sm"
          >
            <Icon
              icon={isExportingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
              className={`w-4 h-4 ${isExportingPdf ? "animate-spin" : "text-amber-300"}`}
            />
            <span>{isExportingPdf ? "Generating PDF..." : "Download PDF"}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintNavLog}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#0A4D66] hover:bg-[#083c50] rounded-lg transition-colors print:hidden"
          >
            <Icon icon="mdi:printer" className="w-3.5 h-3.5" />
            <span>Print Kneeboard</span>
          </button>
        </div>
      </div>

      {!hasRouteCoordinates ? (
        <div className="rounded-xl border border-dashed border-[#0A4D66]/50 p-6 text-center text-xs text-gray-400">
          Enter Departure and Arrival coordinates to generate the dead-reckoning navigation log.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-[#0A4D66]/50 bg-[#001219] text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              <tr>
                <th className="p-2.5">Fix / Leg</th>
                <th className="p-2.5">To Checkpoint</th>
                <th className="p-2.5 text-center">Track (TC / WCA)</th>
                <th className="p-2.5 text-center">HDG (TH / MH)</th>
                <th className="p-2.5 text-center">Groundspeed / Wind</th>
                <th className="p-2.5 text-right">Dist (NM / km)</th>
                <th className="p-2.5 text-right">Leg ETE</th>
                <th className="p-2.5 text-right">Cumulative</th>
                <th className="p-2.5 text-right">Fuel Burn</th>
                <th className="p-2.5 text-right">Rem. FOB</th>
                <th className="p-2.5 text-center">MSA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 font-mono text-xs">
              {navLogSummary.legs.map((leg) => (
                <tr key={leg.legIndex} className="hover:bg-white/5 transition-colors">
                  <td className="p-2.5 font-sans font-bold text-[#F59E0B]">
                    #{leg.legIndex} <span className="font-normal text-gray-400">{leg.fromName}</span>
                  </td>
                  <td className="p-2.5 font-sans font-medium text-white">{leg.toName}</td>
                  <td className="p-2.5 text-center">
                    <span className="text-[#7FD5FF]">{String(leg.trueCourseDeg).padStart(3, "0")}°</span>
                    <span className="text-gray-400 text-[10px] ml-1">
                      ({leg.windCorrectionAngleDeg >= 0 ? `+${leg.windCorrectionAngleDeg}` : leg.windCorrectionAngleDeg}°)
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="text-emerald-400 font-bold">{String(leg.magneticHeadingDeg).padStart(3, "0")}°M</span>
                    <span className="text-gray-400 text-[10px] ml-1">({String(leg.trueHeadingDeg).padStart(3, "0")}°T)</span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="text-white font-bold">{leg.groundSpeedKts} kts</span>
                    <span className="text-[10px] text-gray-400 block font-normal font-sans">
                      {leg.windSummary}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">
                    <span className="text-gray-200">{leg.distanceNm} NM</span>
                    <span className="text-gray-500 text-[10px] block font-sans">({leg.distanceKm} km)</span>
                  </td>
                  <td className="p-2.5 text-right text-emerald-400">+{leg.legEteMinutes}m</td>
                  <td className="p-2.5 text-right text-white font-bold">
                    {Math.floor(leg.cumulativeTimeMinutes / 60)}h {leg.cumulativeTimeMinutes % 60}m
                  </td>
                  <td className="p-2.5 text-right text-amber-300">{leg.legFuelLiters} L</td>
                  <td className="p-2.5 text-right text-sky-300 font-bold">{leg.fuelOnBoardRemainingLiters} L</td>
                  <td className="p-2.5 text-center text-gray-400 font-semibold">{leg.minimumSafeAltitudeFt} ft</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Sub-render: Tab 2 - Tactical Critical Points (ETP & PNR)
  const renderCriticalPointsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:target-account" className="w-4 h-4 text-[#EF4444]" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Tactical Equal Time Point (ETP) &amp; Point of Safe Return (PNR)
          </span>
        </div>
        <span className="text-xs text-gray-400 font-mono">
          Outbound GS: <strong className="text-white">{criticalPoints.groundSpeedOutboundKts} kts</strong> • Homebound GS:{" "}
          <strong className="text-white">{criticalPoints.groundSpeedHomeboundKts} kts</strong>
        </span>
      </div>

      {!hasRouteCoordinates ? (
        <div className="rounded-xl border border-dashed border-[#0A4D66]/50 p-6 text-center text-xs text-gray-400">
          Plot route coordinates to calculate tactical Equal Time Point and Point of Safe Return.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Visual Corridor Bar */}
          <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-5 space-y-4">
            <div className="flex justify-between text-xs text-gray-300">
              <span className="font-bold text-emerald-400">DEP: {routeFixes[0]?.name || "Departure"}</span>
              <span className="font-bold text-red-400">ARR: {routeFixes[routeFixes.length - 1]?.name || "Destination"}</span>
            </div>

            {/* Interactive Progress Bar */}
            <div className="relative h-6 w-full rounded-full bg-[#001219] border border-[#0A4D66]/50 overflow-hidden flex items-center">
              {/* Departure to ETP (Safe Turn-back window) */}
              <div
                className="h-full bg-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-300"
                style={{ width: `${Math.min(100, criticalPoints.etpFractionOfRoute * 100)}%` }}
              >
                Abort to Departure Window
              </div>

              {/* ETP to ARR (Continue to Dest window) */}
              <div
                className="h-full bg-sky-500/30 flex items-center justify-center text-[10px] font-bold text-sky-300"
                style={{ width: `${Math.max(0, 100 - criticalPoints.etpFractionOfRoute * 100)}%` }}
              >
                Continue to Destination
              </div>

              {/* ETP Indicator Pin */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_#F59E0B]"
                style={{ left: `${Math.min(99, Math.max(1, criticalPoints.etpFractionOfRoute * 100))}%` }}
                title={`ETP: ${criticalPoints.etpDistanceNm} NM`}
              />

              {/* PNR Indicator Pin */}
              {criticalPoints.pnrFractionOfRoute <= 1.0 && (
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-red-500 shadow-[0_0_8px_#EF4444]"
                  style={{ left: `${Math.min(99, Math.max(1, criticalPoints.pnrFractionOfRoute * 100))}%` }}
                  title={`PNR: ${criticalPoints.pnrDistanceNm} NM`}
                />
              )}
            </div>

            {/* Pin Legends */}
            <div className="flex flex-wrap items-center justify-between text-xs font-mono pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="text-gray-300">
                  <strong>ETP (Equal Time Point):</strong> {criticalPoints.etpDistanceNm} NM ({criticalPoints.etpTimeMinutes} min)
                </span>
                {criticalPoints.etpLat && (
                  <span className="text-[10px] text-gray-500">
                    [{criticalPoints.etpLat.toFixed(3)}°, {criticalPoints.etpLng?.toFixed(3)}°]
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <span className="text-gray-300">
                  <strong>PNR (Point of No Return):</strong>{" "}
                  {criticalPoints.canReturnSafelyFromAnyPoint ? (
                    <span className="text-emerald-400 font-bold">Sortie Exceeds Corridor (Full RT Safety)</span>
                  ) : (
                    <span className="text-red-400 font-bold">
                      {criticalPoints.pnrDistanceNm} NM ({criticalPoints.pnrTimeMinutes} min)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ETP Analysis Card */}
            <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#F59E0B] font-bold text-xs uppercase">
                <Icon icon="mdi:scale-balance" className="w-4 h-4" />
                <span>Equal Time Point (ETP / Critical Point)</span>
              </div>
              <p className="text-xs text-gray-400">
                The geographical fix where flight time back to departure equals flight time forward to destination under prevailing winds.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono">
                <div className="bg-[#001219] p-2.5 rounded-lg border border-[#0A4D66]/30">
                  <span className="text-[10px] uppercase text-gray-400 block">Distance from DEP</span>
                  <strong className="text-white text-sm">{criticalPoints.etpDistanceNm} NM</strong>
                </div>
                <div className="bg-[#001219] p-2.5 rounded-lg border border-[#0A4D66]/30">
                  <span className="text-[10px] uppercase text-gray-400 block">Time to Reach ETP</span>
                  <strong className="text-emerald-400 text-sm">~{criticalPoints.etpTimeMinutes} min</strong>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 pt-1">
                {criticalPoints.isEtpPastHalfway ? (
                  <span className="text-amber-400">
                    &bull; Headwind outbound pushes ETP past geometric midpoint ({Math.round(criticalPoints.totalDistanceNm / 2)} NM). Abort zone extended.
                  </span>
                ) : (
                  <span className="text-sky-400">
                    &bull; Tailwind outbound pulls ETP closer to departure. Continuing to destination is quicker earlier in flight.
                  </span>
                )}
              </div>
            </div>

            {/* PNR Analysis Card */}
            <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#EF4444] font-bold text-xs uppercase">
                <Icon icon="mdi:shield-alert" className="w-4 h-4" />
                <span>Point of Safe Return (PNR / PSR)</span>
              </div>
              <p className="text-xs text-gray-400">
                The furthest point along track where the aircraft can turn back to departure and land with mandatory ICAO reserves intact.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono">
                <div className="bg-[#001219] p-2.5 rounded-lg border border-[#0A4D66]/30">
                  <span className="text-[10px] uppercase text-gray-400 block">Safe Return Range</span>
                  <strong className="text-white text-sm">
                    {criticalPoints.canReturnSafelyFromAnyPoint ? "Full Corridor" : `${criticalPoints.pnrDistanceNm} NM`}
                  </strong>
                </div>
                <div className="bg-[#001219] p-2.5 rounded-lg border border-[#0A4D66]/30">
                  <span className="text-[10px] uppercase text-gray-400 block">Round-Trip Fuel Margin</span>
                  <strong
                    className={`text-sm ${
                      criticalPoints.fuelMarginLiters >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {criticalPoints.fuelMarginLiters >= 0
                      ? `+${criticalPoints.fuelMarginLiters} L Reserve`
                      : `${criticalPoints.fuelMarginLiters} L Deficit`}
                  </strong>
                </div>
              </div>
              <div className="text-[11px] pt-1">
                {criticalPoints.canReturnSafelyFromAnyPoint ? (
                  <span className="text-emerald-400 font-semibold">
                    &bull; Airframe carries sufficient ramp fuel to reverse course at any point and return to departure.
                  </span>
                ) : (
                  <span className="text-red-400 font-semibold">
                    &bull; Beyond {criticalPoints.pnrDistanceNm} NM, airframe is COMMITTED to destination or alternate aerodrome.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Sub-render: Tab 3 - ICAO 6-Tier Fuel Hierarchy
  const renderFuelHierarchyTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/20 pb-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:gas-station" className="w-4 h-4 text-[#F59E0B]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            ICAO Annex 6 &amp; Tactical Aviation Fuel Hierarchy
          </h4>
          <span className="rounded bg-[#0A4D66]/40 px-2 py-0.5 text-[10px] font-semibold text-[#7FD5FF]">
            {effectiveAircraftCount} {effectiveAircraftCount === 1 ? "Airframe" : "Airframes Fleet"}
          </span>
        </div>

        {/* Live Depot Stock Status */}
        {unitId ? (
          isLoadingInventory ? (
            <span className="text-[11px] text-gray-400">Validating unit depot stock...</span>
          ) : availableFuelStock >= fleetTotalFuelLiters ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[11px] font-semibold text-emerald-400">
              <Icon icon="mdi:check-circle" className="w-3.5 h-3.5" />
              <span>
                Unit Stock Sufficient: {availableFuelStock.toLocaleString()} L in Depot (Req:{" "}
                {fleetTotalFuelLiters.toLocaleString()} L)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-[11px] font-semibold text-amber-300">
              <Icon icon="mdi:alert" className="w-3.5 h-3.5" />
              <span>
                Fuel Stock Alert: Depot has {availableFuelStock.toLocaleString()} L (Req:{" "}
                {fleetTotalFuelLiters.toLocaleString()} L)
              </span>
            </span>
          )
        ) : (
          <span className="text-[11px] text-gray-500 italic">Select Unit in Step 1 to verify depot stock</span>
        )}
      </div>

      {!hasRouteCoordinates ? (
        <div className="rounded-xl border border-dashed border-[#0A4D66]/50 p-6 text-center text-xs text-gray-400">
          Plot route coordinates to calculate ICAO fuel requirements and verify against depot inventory.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Alternate Aerodrome & IFR Toggle */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-[#001825] border border-[#0A4D66]/40">
            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">
                Designated Alternate Aerodrome
              </label>
              <select
                value={selectedAlternateId}
                onChange={(e) => setSelectedAlternateId(e.target.value)}
                disabled={!isEditable}
                className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
              >
                {NIGERIA_AERONAUTICAL_DATABASE.filter(
                  (p) => p.type === "airport" || p.type === "military_base"
                ).map((ap) => (
                  <option key={ap.id} value={ap.id}>
                    {ap.ident} - {ap.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">
                Reserve Standard (ICAO Annex 6)
              </label>
              <button
                type="button"
                onClick={() => setIsIfrReserve(!isIfrReserve)}
                disabled={!isEditable}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-colors ${
                  isIfrReserve
                    ? "bg-[#0369A1] text-white border-[#7FD5FF]"
                    : "bg-[#001219] text-gray-300 border-[#0A4D66]/40"
                }`}
              >
                <span>{isIfrReserve ? "IFR Reserve (45 Minutes)" : "VFR Reserve (30 Minutes)"}</span>
                <Icon icon={isIfrReserve ? "mdi:weather-partly-cloudy" : "mdi:weather-sunny"} className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 font-medium block mb-1">
                Extra / Tactical Discretionary Fuel (L)
              </label>
              <input
                type="number"
                min={0}
                max={500}
                step={25}
                value={extraDiscretionaryFuelL}
                disabled={!isEditable}
                onChange={(e) => setExtraDiscretionaryFuelL(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-[#7FD5FF]"
              />
            </div>
          </div>

          {/* 6-Tier Fuel Table */}
          <div className="overflow-x-auto rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-[#0A4D66]/50 bg-[#001219] text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                <tr>
                  <th className="p-3">Fuel Component</th>
                  <th className="p-3">Calculation Basis</th>
                  <th className="p-3 text-right">Per Airframe</th>
                  <th className="p-3 text-right">Fleet Total ({effectiveAircraftCount} Sorties)</th>
                  <th className="p-3 text-right">Weight (Jet A-1)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A4D66]/20 font-mono text-xs">
                <tr>
                  <td className="p-3 font-sans font-bold text-gray-200">1. Taxi &amp; APU Fuel</td>
                  <td className="p-3 font-sans text-gray-400">Engine start, systems warm-up &amp; hover taxi check</td>
                  <td className="p-3 text-right text-gray-200">{icaoFuel.taxiFuelL} L</td>
                  <td className="p-3 text-right text-gray-200 font-bold">{fleetTaxiFuelLiters} L</td>
                  <td className="p-3 text-right text-gray-500">~{Math.round(fleetTaxiFuelLiters * 0.804)} kg</td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-bold text-white">2. Enroute Trip Fuel</td>
                  <td className="p-3 font-sans text-gray-400">
                    NavLog corridor burn ({navLogSummary.totalDistanceNm} NM @ {cruiseSpeedKts} kts TAS with winds)
                  </td>
                  <td className="p-3 text-right text-white font-bold">{icaoFuel.tripFuelL.toLocaleString()} L</td>
                  <td className="p-3 text-right text-white font-bold">{fleetTripFuelLiters.toLocaleString()} L</td>
                  <td className="p-3 text-right text-gray-400">~{Math.round(fleetTripFuelLiters * 0.804)} kg</td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-bold text-sky-400">3. Contingency Fuel</td>
                  <td className="p-3 font-sans text-gray-400">Higher of 5% trip fuel or 5-min cruise burn (ICAO Annex 6)</td>
                  <td className="p-3 text-right text-sky-400">{icaoFuel.contingencyFuelL} L</td>
                  <td className="p-3 text-right text-sky-400 font-bold">
                    {(icaoFuel.contingencyFuelL * effectiveAircraftCount).toLocaleString()} L
                  </td>
                  <td className="p-3 text-right text-gray-500">
                    ~{Math.round(icaoFuel.contingencyFuelL * effectiveAircraftCount * 0.804)} kg
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-bold text-purple-400">4. Alternate Aerodrome Fuel</td>
                  <td className="p-3 font-sans text-gray-400">
                    Diversion to {icaoFuel.alternateAerodromeName} ({icaoFuel.alternateDistanceNm} NM)
                  </td>
                  <td className="p-3 text-right text-purple-400">{icaoFuel.alternateFuelL} L</td>
                  <td className="p-3 text-right text-purple-400 font-bold">
                    {(icaoFuel.alternateFuelL * effectiveAircraftCount).toLocaleString()} L
                  </td>
                  <td className="p-3 text-right text-gray-500">
                    ~{Math.round(icaoFuel.alternateFuelL * effectiveAircraftCount * 0.804)} kg
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-bold text-[#F59E0B]">5. Final Reserve Fuel</td>
                  <td className="p-3 font-sans text-gray-400">
                    Mandatory {isIfrReserve ? "45-min IFR" : "30-min VFR"} reserve at holding speed
                  </td>
                  <td className="p-3 text-right text-[#F59E0B] font-bold">{icaoFuel.finalReserveFuelL} L</td>
                  <td className="p-3 text-right text-[#F59E0B] font-bold">{fleetReserveFuelLiters.toLocaleString()} L</td>
                  <td className="p-3 text-right text-gray-500">~{Math.round(fleetReserveFuelLiters * 0.804)} kg</td>
                </tr>
                <tr className="bg-sky-500/10 font-bold">
                  <td className="p-3 font-sans text-[#7FD5FF]">ICAO Minimum Block Fuel</td>
                  <td className="p-3 font-sans text-gray-300">Sum of Tiers 1 through 5 (Regulatory Minimum)</td>
                  <td className="p-3 text-right text-[#7FD5FF]">{icaoFuel.minimumBlockFuelL.toLocaleString()} L</td>
                  <td className="p-3 text-right text-[#7FD5FF]">
                    {(icaoFuel.minimumBlockFuelL * effectiveAircraftCount).toLocaleString()} L
                  </td>
                  <td className="p-3 text-right text-gray-300">
                    ~{Math.round(icaoFuel.minimumBlockFuelL * effectiveAircraftCount * 0.804)} kg
                  </td>
                </tr>
                {extraDiscretionaryFuelL > 0 && (
                  <tr>
                    <td className="p-3 font-sans font-bold text-emerald-400">6. Tactical Extra Fuel</td>
                    <td className="p-3 font-sans text-gray-400">Commander&apos;s discretionary loiter buffer</td>
                    <td className="p-3 text-right text-emerald-400">{icaoFuel.extraFuelL} L</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">
                      {(icaoFuel.extraFuelL * effectiveAircraftCount).toLocaleString()} L
                    </td>
                    <td className="p-3 text-right text-gray-500">
                      ~{Math.round(icaoFuel.extraFuelL * effectiveAircraftCount * 0.804)} kg
                    </td>
                  </tr>
                )}
                <tr className="bg-[#001219] font-black text-sm">
                  <td className="p-3 font-sans uppercase text-white">Total Planned Ramp Fuel</td>
                  <td className="p-3 font-sans text-gray-400 text-xs">Total Fuel Loaded into Airframe Tanks</td>
                  <td className="p-3 text-right text-emerald-400">{icaoFuel.totalRampFuelL.toLocaleString()} L</td>
                  <td className="p-3 text-right text-emerald-400 text-base">{fleetTotalFuelLiters.toLocaleString()} L</td>
                  <td className="p-3 text-right text-white">~{fleetFuelWeightKg.toLocaleString()} kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // Sub-render: Tab 4 - Weight & Balance
  const renderWeightAndBalanceTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/20 pb-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:weight-kilogram" className="w-4 h-4 text-[#7FD5FF]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Airframe Weight &amp; Balance (Max Takeoff Weight Envelope)
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {isOverweight ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-1 text-xs font-bold text-red-400">
              <Icon icon="mdi:alert-octagon" className="w-4 h-4" />
              <span>OVER MTOW BY {(takeoffWeightKg - maxTakeoffWeightKg).toLocaleString()} KG</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-400">
              <Icon icon="mdi:check-circle" className="w-4 h-4" />
              <span>Safe Takeoff Weight (Margin: {(maxTakeoffWeightKg - takeoffWeightKg).toLocaleString()} kg)</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Configuration Selector */}
        <div className="space-y-3">
          <label className="text-xs text-gray-300 font-semibold block">Tactical Equipment Configuration</label>
          <div className="space-y-2">
            {MISSION_EQUIPMENT_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                onClick={() => isEditable && setEquipmentConfig(opt.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  equipmentConfig === opt.id
                    ? "bg-[#0A4D66]/40 border-[#7FD5FF] text-white"
                    : "bg-[#001825] border-[#0A4D66]/30 text-gray-400 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{opt.label}</span>
                  <span className="font-mono text-[#7FD5FF]">+{opt.weightKg} kg</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{opt.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Weight Breakdown Card */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs text-gray-400 font-medium">
              <span>Mission Cargo &amp; Troop Payload</span>
              <span className="text-[10px] text-gray-500 font-mono">
                Max allowable: {(maxTakeoffWeightKg - emptyWeightKg).toLocaleString()} kg
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                min={0}
                max={5000}
                step="any"
                value={payloadKg}
                disabled={!isEditable}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = Number(val);
                  setPayloadKg(Number.isNaN(num) ? 0 : Math.max(0, num));
                }}
                placeholder="300"
                className="w-full bg-[#001825] border border-[#0A4D66]/60 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/50 pr-12 disabled:opacity-50"
              />
              <span className="absolute right-3 text-xs font-mono font-semibold text-[#7FD5FF] pointer-events-none select-none">
                kg
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-4 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-gray-400">
              <span>Basic Empty Weight:</span>
              <span className="text-white">{emptyWeightKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Equipment Pods:</span>
              <span className="text-[#7FD5FF]">+{selectedConfig.weightKg} kg</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Flight Crew (2 Pilots):</span>
              <span className="text-white">+{crewWeightKg} kg</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Mission Fuel ({icaoFuel.totalRampFuelL} L @ 0.804 kg/L):</span>
              <span className="text-amber-400 font-bold">+{fuelWeightKg.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Troop &amp; Tactical Payload:</span>
              <span className="text-white font-bold">+{payloadKg} kg</span>
            </div>
            <div className="border-t border-[#0A4D66]/40 pt-2 flex justify-between font-bold text-sm">
              <span className="text-gray-200">Total Takeoff Weight (TOW):</span>
              <span className={isOverweight ? "text-red-400" : "text-emerald-400"}>
                {takeoffWeightKg.toLocaleString()} kg / {maxTakeoffWeightKg.toLocaleString()} kg MTOW
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Sub-render: Tab 5 - Full Operational Flight Plan Dossier (Complete Combined PDF/Print Briefing)
  const renderFullDossier = () => (
    <div
      ref={dossierRef}
      id="operational-flight-plan-dossier"
      className="space-y-6 bg-[#001219] text-gray-200 p-6 rounded-2xl border border-[#0A4D66]/50 shadow-2xl"
    >
      {/* Official Military Flight Plan Header */}
      <div className="border-b-2 border-[#0A4D66] pb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#0A4D66]/40 text-[#7FD5FF]">
              <Icon icon="mdi:shield-airplane" className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-widest text-[#7FD5FF] uppercase block">
                Nigerian Army Aviation Wing &bull; Flight Operations Command
              </span>
              <h2 className="text-lg font-black tracking-wide text-white uppercase">
                Tactical Route Analysis &amp; Operational Flight Plan (OFP)
              </h2>
            </div>
          </div>
        </div>

        <div className="text-right text-xs font-mono space-y-0.5">
          <div className="text-white font-bold">
            MISSION: <span className="text-[#F59E0B]">{operationName || operationCode || "TACTICAL SORTIE"}</span>
          </div>
          {operationCode && <div className="text-gray-400">OFP REF: {operationCode}</div>}
          {unitName && <div className="text-[#7FD5FF]">UNIT: {unitName}</div>}
          <div className="text-gray-400">DATE: {operationDate || new Date().toISOString().slice(0, 10)}</div>
          <div className="text-emerald-400 font-bold">AIRFRAMES: {effectiveAircraftCount} Sortie(s)</div>
        </div>
      </div>

      {/* Corridor Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-3">
          <span className="text-[10px] uppercase text-gray-400 block font-sans">Total Distance</span>
          <span className="text-base font-bold text-white font-mono">{navLogSummary.totalDistanceNm} NM</span>
          <span className="text-[10px] text-gray-500 block font-sans">({navLogSummary.totalDistanceKm} km corridor)</span>
        </div>
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-3">
          <span className="text-[10px] uppercase text-gray-400 block font-sans">Estimated Time Enroute</span>
          <span className="text-base font-bold text-emerald-400 font-mono">
            {Math.floor(navLogSummary.totalFlightHours)}h {Math.round((navLogSummary.totalFlightHours % 1) * 60)}m
          </span>
          <span className="text-[10px] text-gray-500 block font-sans">Avg GS: {navLogSummary.averageGroundSpeedKts} kts</span>
        </div>
        <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-3">
          <span className="text-[10px] uppercase text-gray-400 block font-sans">Prevailing Winds Aloft</span>
          <span className="text-base font-bold text-[#7FD5FF] font-mono">
            {String(windDirectionDeg).padStart(3, "0")}° / {windSpeedKts} kts
          </span>
          <span className="text-[10px] text-gray-500 block font-sans">TAS: {cruiseSpeedKts} kts (Mag Var: -2°W)</span>
        </div>
        <div className="rounded-xl border border-[#7FD5FF]/40 bg-[#001825] p-3 ring-1 ring-[#7FD5FF]/30">
          <span className="text-[10px] uppercase text-[#7FD5FF] block font-bold font-sans">Total Ramp Fuel</span>
          <span className="text-base font-black text-amber-300 font-mono">
            {fleetTotalFuelLiters.toLocaleString()} L
          </span>
          <span className="text-[10px] text-gray-400 block font-sans">~{fleetFuelWeightKg.toLocaleString()} kg Jet A-1</span>
        </div>
      </div>

      {/* Section 1: Navigation Log */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-[#0A4D66]/30 pb-1.5">
          <Icon icon="mdi:table-clock" className="w-4 h-4 text-[#7FD5FF]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            1. Tactical Dead-Reckoning Navigation Log ({navLogSummary.legs.length} Sortie Legs)
          </h4>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-[#0A4D66]/50 bg-[#001219] text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              <tr>
                <th className="p-2.5">Fix / Leg</th>
                <th className="p-2.5">To Checkpoint</th>
                <th className="p-2.5 text-center">Track (TC / WCA)</th>
                <th className="p-2.5 text-center">HDG (TH / MH)</th>
                <th className="p-2.5 text-center">Groundspeed / Wind</th>
                <th className="p-2.5 text-right">Dist (NM / km)</th>
                <th className="p-2.5 text-right">Leg ETE / ATO</th>
                <th className="p-2.5 text-right">Cumulative</th>
                <th className="p-2.5 text-right">Fuel Burn</th>
                <th className="p-2.5 text-right">Rem. FOB / AFOB</th>
                <th className="p-2.5 text-center">MSA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 font-mono text-xs">
              {navLogSummary.legs.map((leg) => (
                <tr key={leg.legIndex} className="hover:bg-white/5 transition-colors">
                  <td className="p-2.5 font-sans font-bold text-[#F59E0B]">
                    #{leg.legIndex} <span className="font-normal text-gray-400">{leg.fromName}</span>
                  </td>
                  <td className="p-2.5 font-sans font-medium text-white">{leg.toName}</td>
                  <td className="p-2.5 text-center">
                    <span className="text-[#7FD5FF]">{String(leg.trueCourseDeg).padStart(3, "0")}°</span>
                    <span className="text-gray-400 text-[10px] ml-1">
                      ({leg.windCorrectionAngleDeg >= 0 ? `+${leg.windCorrectionAngleDeg}` : leg.windCorrectionAngleDeg}°)
                    </span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="text-emerald-400 font-bold">{String(leg.magneticHeadingDeg).padStart(3, "0")}°M</span>
                    <span className="text-gray-400 text-[10px] ml-1">({String(leg.trueHeadingDeg).padStart(3, "0")}°T)</span>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className="text-white font-bold">{leg.groundSpeedKts} kts</span>
                    <span className="text-[10px] text-gray-400 block font-normal font-sans">
                      {leg.windSummary}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">
                    <span className="text-gray-200">{leg.distanceNm} NM</span>
                    <span className="text-gray-500 text-[10px] block font-sans">({leg.distanceKm} km)</span>
                  </td>
                  <td className="p-2.5 text-right text-emerald-400">
                    <div>+{leg.legEteMinutes}m</div>
                    <div className="text-[9px] text-gray-500 font-sans border-t border-gray-700/50 mt-0.5 pt-0.5">
                      ATO: [____]
                    </div>
                  </td>
                  <td className="p-2.5 text-right text-white font-bold">
                    {Math.floor(leg.cumulativeTimeMinutes / 60)}h {leg.cumulativeTimeMinutes % 60}m
                  </td>
                  <td className="p-2.5 text-right text-amber-300">{leg.legFuelLiters} L</td>
                  <td className="p-2.5 text-right text-sky-300 font-bold">
                    <div>{leg.fuelOnBoardRemainingLiters} L</div>
                    <div className="text-[9px] text-gray-500 font-sans border-t border-gray-700/50 mt-0.5 pt-0.5">
                      AFOB: [____]
                    </div>
                  </td>
                  <td className="p-2.5 text-center text-gray-400 font-semibold">{leg.minimumSafeAltitudeFt} ft</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Tactical Critical Points */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-[#0A4D66]/30 pb-1.5">
          <Icon icon="mdi:target-account" className="w-4 h-4 text-[#EF4444]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            2. Tactical Critical Points &amp; Route Safety Analysis (ETP &amp; PNR)
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-4 space-y-2 text-xs">
            <span className="text-[#F59E0B] font-bold block uppercase">Equal Time Point (ETP / Critical Point)</span>
            <div className="font-mono text-gray-300 space-y-1">
              <div>Distance from Departure: <strong className="text-white">{criticalPoints.etpDistanceNm} NM</strong> (~{criticalPoints.etpTimeMinutes} min)</div>
              <div>Outbound GS: {criticalPoints.groundSpeedOutboundKts} kts • Homebound GS: {criticalPoints.groundSpeedHomeboundKts} kts</div>
              {criticalPoints.etpLat && (
                <div>ETP Coordinates: <strong className="text-[#7FD5FF]">{criticalPoints.etpLat.toFixed(4)}°N, {criticalPoints.etpLng?.toFixed(4)}°E</strong></div>
              )}
            </div>
            <div className="text-[11px] text-gray-400">
              {criticalPoints.isEtpPastHalfway ? "Outbound headwind extends safe abort-to-departure window." : "Outbound tailwind pulls decision point closer to departure."}
            </div>
          </div>

          <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001825] p-4 space-y-2 text-xs">
            <span className="text-[#EF4444] font-bold block uppercase">Point of Safe Return (PNR / Point of No Return)</span>
            <div className="font-mono text-gray-300 space-y-1">
              <div>Safe Return Range: <strong className="text-white">{criticalPoints.canReturnSafelyFromAnyPoint ? "Full Corridor Safe" : `${criticalPoints.pnrDistanceNm} NM`}</strong></div>
              <div>Endurance Usable: {criticalPoints.enduranceHours} hrs • Round-Trip Margin: <strong className={criticalPoints.fuelMarginLiters >= 0 ? "text-emerald-400" : "text-red-400"}>{criticalPoints.fuelMarginLiters >= 0 ? `+${criticalPoints.fuelMarginLiters} L` : `${criticalPoints.fuelMarginLiters} L`}</strong></div>
              {criticalPoints.pnrLat && (
                <div>PNR Coordinates: <strong className="text-[#7FD5FF]">{criticalPoints.pnrLat.toFixed(4)}°N, {criticalPoints.pnrLng?.toFixed(4)}°E</strong></div>
              )}
            </div>
            <div className="text-[11px] text-gray-400">
              {criticalPoints.canReturnSafelyFromAnyPoint ? "Aircraft has sufficient endurance to reverse course at any point." : "Beyond PNR, aircraft is fully committed to destination or diversion alternate."}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: ICAO Fuel Hierarchy */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-[#0A4D66]/30 pb-1.5">
          <Icon icon="mdi:gas-station" className="w-4 h-4 text-[#F59E0B]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            3. Pre-Flight Fuel Hierarchy &amp; Tactical Reserves
          </h4>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-[#0A4D66]/50 bg-[#001219] text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
              <tr>
                <th className="p-2.5">Tier / Component</th>
                <th className="p-2.5">Calculation Rule</th>
                <th className="p-2.5 text-right">Per Airframe</th>
                <th className="p-2.5 text-right">Fleet Total ({effectiveAircraftCount})</th>
                <th className="p-2.5 text-right">Weight (Jet A-1)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 font-mono text-xs">
              <tr>
                <td className="p-2.5 font-sans font-bold text-gray-200">1. Taxi Fuel</td>
                <td className="p-2.5 font-sans text-gray-400">Engine start, systems warm-up &amp; hover taxi check</td>
                <td className="p-2.5 text-right">{icaoFuel.taxiFuelL} L</td>
                <td className="p-2.5 text-right font-bold">{fleetTaxiFuelLiters} L</td>
                <td className="p-2.5 text-right text-gray-500">~{Math.round(fleetTaxiFuelLiters * 0.804)} kg</td>
              </tr>
              <tr>
                <td className="p-2.5 font-sans font-bold text-white">2. Trip Fuel</td>
                <td className="p-2.5 font-sans text-gray-400">Enroute corridor burn with dead-reckoning winds</td>
                <td className="p-2.5 text-right text-white font-bold">{icaoFuel.tripFuelL} L</td>
                <td className="p-2.5 text-right text-white font-bold">{fleetTripFuelLiters.toLocaleString()} L</td>
                <td className="p-2.5 text-right text-gray-400">~{Math.round(fleetTripFuelLiters * 0.804)} kg</td>
              </tr>
              <tr>
                <td className="p-2.5 font-sans font-bold text-sky-400">3. Contingency Fuel</td>
                <td className="p-2.5 font-sans text-gray-400">Higher of 5% trip fuel or 5-min cruise burn</td>
                <td className="p-2.5 text-right text-sky-400">{icaoFuel.contingencyFuelL} L</td>
                <td className="p-2.5 text-right text-sky-400 font-bold">{(icaoFuel.contingencyFuelL * effectiveAircraftCount).toLocaleString()} L</td>
                <td className="p-2.5 text-right text-gray-500">~{Math.round(icaoFuel.contingencyFuelL * effectiveAircraftCount * 0.804)} kg</td>
              </tr>
              <tr>
                <td className="p-2.5 font-sans font-bold text-purple-400">4. Alternate Fuel</td>
                <td className="p-2.5 font-sans text-gray-400">Diversion to {icaoFuel.alternateAerodromeName} ({icaoFuel.alternateDistanceNm} NM)</td>
                <td className="p-2.5 text-right text-purple-400">{icaoFuel.alternateFuelL} L</td>
                <td className="p-2.5 text-right text-purple-400 font-bold">{(icaoFuel.alternateFuelL * effectiveAircraftCount).toLocaleString()} L</td>
                <td className="p-2.5 text-right text-gray-500">~{Math.round(icaoFuel.alternateFuelL * effectiveAircraftCount * 0.804)} kg</td>
              </tr>
              <tr>
                <td className="p-2.5 font-sans font-bold text-[#F59E0B]">5. Final Reserve Fuel</td>
                <td className="p-2.5 font-sans text-gray-400">Mandatory {isIfrReserve ? "45-min IFR" : "30-min VFR"} reserve</td>
                <td className="p-2.5 text-right text-[#F59E0B] font-bold">{icaoFuel.finalReserveFuelL} L</td>
                <td className="p-2.5 text-right text-[#F59E0B] font-bold">{fleetReserveFuelLiters.toLocaleString()} L</td>
                <td className="p-2.5 text-right text-gray-500">~{Math.round(fleetReserveFuelLiters * 0.804)} kg</td>
              </tr>
              <tr className="bg-sky-500/10 font-bold">
                <td className="p-2.5 font-sans text-[#7FD5FF]">Minimum Block Fuel</td>
                <td className="p-2.5 font-sans text-gray-300">Regulatory Minimum Required (Tiers 1-5)</td>
                <td className="p-2.5 text-right text-[#7FD5FF]">{icaoFuel.minimumBlockFuelL.toLocaleString()} L</td>
                <td className="p-2.5 text-right text-[#7FD5FF]">{(icaoFuel.minimumBlockFuelL * effectiveAircraftCount).toLocaleString()} L</td>
                <td className="p-2.5 text-right text-gray-300">~{Math.round(icaoFuel.minimumBlockFuelL * effectiveAircraftCount * 0.804)} kg</td>
              </tr>
              <tr className="bg-[#001219] font-black text-sm">
                <td className="p-2.5 font-sans uppercase text-emerald-400">Total Planned Ramp Fuel</td>
                <td className="p-2.5 font-sans text-gray-400 text-xs">Total Fuel Loaded into Airframe Tanks</td>
                <td className="p-2.5 text-right text-emerald-400">{icaoFuel.totalRampFuelL.toLocaleString()} L</td>
                <td className="p-2.5 text-right text-emerald-400 text-base">{fleetTotalFuelLiters.toLocaleString()} L</td>
                <td className="p-2.5 text-right text-white">~{fleetFuelWeightKg.toLocaleString()} kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: Weight & Balance */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 border-b border-[#0A4D66]/30 pb-1.5">
          <Icon icon="mdi:weight-kilogram" className="w-4 h-4 text-[#7FD5FF]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            4. Airframe Weight &amp; Balance (Max Takeoff Weight Envelope)
          </h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
          <div className="bg-[#001825] p-3 rounded-xl border border-[#0A4D66]/30">
            <span className="text-[10px] text-gray-400 uppercase block font-sans">Basic Empty Weight</span>
            <strong className="text-white text-sm">{emptyWeightKg.toLocaleString()} kg</strong>
          </div>
          <div className="bg-[#001825] p-3 rounded-xl border border-[#0A4D66]/30">
            <span className="text-[10px] text-gray-400 uppercase block font-sans">Tactical Config Pods</span>
            <strong className="text-[#7FD5FF] text-sm">+{selectedConfig.weightKg} kg</strong>
            <span className="text-[10px] text-gray-500 block truncate font-sans">{selectedConfig.label}</span>
          </div>
          <div className="bg-[#001825] p-3 rounded-xl border border-[#0A4D66]/30">
            <span className="text-[10px] text-gray-400 uppercase block font-sans">Crew &amp; Payload</span>
            <strong className="text-white text-sm">+{crewWeightKg + Number(payloadKg || 0)} kg</strong>
            <span className="text-[10px] text-gray-500 block font-sans">(Crew {crewWeightKg}kg + Cargo {payloadKg}kg)</span>
          </div>
          <div className="bg-[#001825] p-3 rounded-xl border border-[#0A4D66]/30">
            <span className="text-[10px] text-gray-400 uppercase block font-sans">Takeoff Weight vs MTOW</span>
            <strong className={`text-sm ${isOverweight ? "text-red-400" : "text-emerald-400"}`}>
              {takeoffWeightKg.toLocaleString()} / {maxTakeoffWeightKg.toLocaleString()} kg
            </strong>
            <span className="text-[10px] text-gray-500 block font-sans">
              {isOverweight ? "EXCEEDS MTOW" : `Margin: ${(maxTakeoffWeightKg - takeoffWeightKg).toLocaleString()} kg`}
            </span>
          </div>
        </div>
      </div>

      {/* Official Sign-Off Footer */}
      <div className="border-t border-[#0A4D66]/40 pt-4 flex flex-wrap items-center justify-between gap-4 text-[11px] text-gray-500 font-mono">
        <div>
          Official Nigerian Army Aviation Wing (NAA-AVN) &bull; Generated from AIP Datum WGS-84
        </div>
        <div className="flex items-center gap-6">
          <div>FLIGHT OPERATIONS OFFICER: _______________</div>
          <div>AIRCRAFT COMMANDER: _______________</div>
        </div>
      </div>
    </div>
  );

  // Variant: legs-only
  if (variant === "legs-only" || variant === "navlog") {
    return (
      <div className={`rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 text-gray-200 space-y-4 ${className}`.trim()}>
        {renderFlightControls()}
        {renderNavLogTable()}
      </div>
    );
  }

  // Variant: critical-points
  if (variant === "critical-points") {
    return (
      <div className={`rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 text-gray-200 space-y-4 ${className}`.trim()}>
        {renderFlightControls()}
        {renderCriticalPointsTab()}
      </div>
    );
  }

  // Variant: fuel-only
  if (variant === "fuel-only") {
    return (
      <div className={`rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 text-gray-200 space-y-4 ${className}`.trim()}>
        {renderFlightControls()}
        {renderFuelHierarchyTab()}
      </div>
    );
  }

  // Default: Full Cockpit Integrated View with Tabs & Download PDF Action
  return (
    <div className={`rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-5 text-gray-200 space-y-5 ${className}`.trim()}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A4D66]/30 pb-3">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:airplane-takeoff" className="w-5 h-5 text-[#7FD5FF]" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Tactical Flight Planning, Route Analysis &amp; NavLog
            </h3>
            <p className="text-[11px] text-gray-400">
              Military Dead-Reckoning Navigation &amp; ICAO Mission Fuel Analysis Engine
            </p>
          </div>
        </div>

        {/* Tab Switcher & Download PDF Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#001825] p-1 rounded-xl border border-[#0A4D66]/40 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("navlog")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "navlog" ? "bg-[#0369A1] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon icon="mdi:table-clock" className="w-4 h-4" />
              <span>Tactical NavLog</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("critical-points")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "critical-points" ? "bg-[#0369A1] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon icon="mdi:target-account" className="w-4 h-4" />
              <span>ETP &amp; PNR Points</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("fuel-hierarchy")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "fuel-hierarchy" ? "bg-[#0369A1] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon icon="mdi:gas-station" className="w-4 h-4" />
              <span>ICAO Fuel</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("weight-balance")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "weight-balance" ? "bg-[#0369A1] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon icon="mdi:weight-kilogram" className="w-4 h-4" />
              <span>Weight &amp; Balance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("full-dossier")}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "full-dossier" ? "bg-[#0369A1] text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon icon="mdi:file-document-box-multiple" className="w-4 h-4" />
              <span>Full OFP Dossier</span>
            </button>
          </div>

          {/* Download Flight Plan PDF Button */}
          {hasRouteCoordinates && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-[#0369A1] hover:bg-[#0284c7] disabled:opacity-50 rounded-xl transition-all shadow-lg border border-[#7FD5FF]/40 print:hidden"
              title="Download complete route analysis and tactical flight plan as PDF"
            >
              <Icon
                icon={isExportingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
                className={`w-4 h-4 ${isExportingPdf ? "animate-spin" : "text-amber-300"}`}
              />
              <span>{isExportingPdf ? "Generating PDF..." : "Download Flight Plan (PDF)"}</span>
            </button>
          )}
        </div>
      </div>

      {renderFlightControls()}

      {/* Tab Contents */}
      {activeTab === "navlog" && renderNavLogTable()}
      {activeTab === "critical-points" && renderCriticalPointsTab()}
      {activeTab === "fuel-hierarchy" && renderFuelHierarchyTab()}
      {activeTab === "weight-balance" && renderWeightAndBalanceTab()}
      {activeTab === "full-dossier" && renderFullDossier()}

      {/* Off-screen Render of Full Dossier for 1-Click PDF Generation if user is on other tabs */}
      {activeTab !== "full-dossier" && hasRouteCoordinates && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: 0,
            width: "1050px",
            visibility: "visible",
            pointerEvents: "none",
          }}
        >
          {renderFullDossier()}
        </div>
      )}
    </div>
  );
};
