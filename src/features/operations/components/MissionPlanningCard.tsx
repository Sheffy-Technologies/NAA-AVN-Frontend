import { useState, useMemo, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useGetInventoriesQuery } from "@/features/inventory/api";
import { calculateDistanceNM, calculateBearing } from "../utils/coordinates";

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
  aircraftCount?: number;
  variant?: "all" | "legs-only" | "fuel-only";
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
  aircraftCount = 1,
  variant = "all",
  isEditable = true,
  onPlanningChange,
  className = "",
}: MissionPlanningCardProps) => {
  // Flight performance state
  const [cruiseSpeedKts, setCruiseSpeedKts] = useState<number>(120); // 120 kts typical rotorcraft cruise
  const [burnRateLph, setBurnRateLph] = useState<number>(240); // 240 L/hr typical light twin turbine
  const [equipmentConfig] = useState<MissionEquipmentConfig>("slick_transport");
  const [payloadKg] = useState<number>(300); // 300 kg cargo / troops
  const [emptyWeightKg] = useState<number>(2100); // 2,100 kg basic empty operating weight
  const [maxTakeoffWeightKg] = useState<number>(3175); // 3,175 kg typical MTOW (e.g. AW109)

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

  // Compute Multi-Leg Route Segments
  const legs = useMemo(() => {
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

    const points: Array<{ name: string; lat: number; lng: number }> = [
      { name: "Departure Aerodrome", lat: depLatNum, lng: depLngNum },
    ];

    waypoints.forEach((wp, idx) => {
      const wLat = Number(wp.latitude);
      const wLng = Number(wp.longitude);
      if (!Number.isNaN(wLat) && !Number.isNaN(wLng)) {
        points.push({
          name: wp.name?.trim() ? wp.name.trim() : `Checkpoint ${idx + 1}`,
          lat: wLat,
          lng: wLng,
        });
      }
    });

    if (
      arrivalLat &&
      arrivalLng &&
      !Number.isNaN(arrLatNum) &&
      !Number.isNaN(arrLngNum)
    ) {
      points.push({ name: "Destination Aerodrome", lat: arrLatNum, lng: arrLngNum });
    }

    if (points.length < 2) return [];

    const computedLegs: Array<{
      fromName: string;
      toName: string;
      distanceNm: number;
      distanceKm: number;
      bearingDeg: number;
      eteMinutes: number;
    }> = [];

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const distNm = calculateDistanceNM(from.lat, from.lng, to.lat, to.lng);
      const distKm = Number((distNm * 1.852).toFixed(1));
      const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
      const eteMin = Math.round((distNm / (cruiseSpeedKts || 120)) * 60);

      computedLegs.push({
        fromName: from.name,
        toName: to.name,
        distanceNm: distNm,
        distanceKm: distKm,
        bearingDeg: bearing,
        eteMinutes: eteMin,
      });
    }

    return computedLegs;
  }, [departureLat, departureLng, arrivalLat, arrivalLng, waypoints, cruiseSpeedKts]);

  // Total Distance & Time
  const totalDistanceNm = useMemo(
    () => Number(legs.reduce((acc, leg) => acc + leg.distanceNm, 0).toFixed(1)),
    [legs]
  );
  const totalDistanceKm = Number((totalDistanceNm * 1.852).toFixed(1));
  const estimatedFlightHours = useMemo(
    () => (cruiseSpeedKts > 0 ? Number((totalDistanceNm / cruiseSpeedKts).toFixed(2)) : 0),
    [totalDistanceNm, cruiseSpeedKts]
  );

  // Per-Airframe Fuel Calculations
  const taxiFuelLiters = 40; // Fixed 40L engine start, taxi & hover check
  const tripFuelLiters = Math.round(estimatedFlightHours * burnRateLph);
  const reserveFuelLiters = Math.round(0.5 * burnRateLph); // Mandatory 30-min military VFR reserve
  const totalFuelLiters = taxiFuelLiters + tripFuelLiters + reserveFuelLiters;

  // Fleet Aggregated Fuel Calculations
  const fleetTotalFuelLiters = totalFuelLiters * effectiveAircraftCount;
  const fleetFuelWeightKg = Math.round(fleetTotalFuelLiters * 0.804); // Jet A-1 density = 0.804 kg/L
  const fleetTripFuelLiters = tripFuelLiters * effectiveAircraftCount;
  const fleetTaxiFuelLiters = taxiFuelLiters * effectiveAircraftCount;
  const fleetReserveFuelLiters = reserveFuelLiters * effectiveAircraftCount;

  // Weight & Balance Calculations (per airframe baseline)
  const selectedConfig =
    MISSION_EQUIPMENT_OPTIONS.find((opt) => opt.id === equipmentConfig) ||
    MISSION_EQUIPMENT_OPTIONS[0];

  const fuelWeightKg = Math.round(totalFuelLiters * 0.804); // Jet A-1 density = 0.804 kg/L
  const crewWeightKg = 170; // 2 flight crew @ 85 kg
  const takeoffWeightKg =
    emptyWeightKg +
    selectedConfig.weightKg +
    fuelWeightKg +
    crewWeightKg +
    Number(payloadKg || 0);

  const isOverweight = takeoffWeightKg > maxTakeoffWeightKg;

  // Notify parent on planning state changes
  useEffect(() => {
    if (onPlanningChange) {
      onPlanningChange({
        totalDistanceNm,
        totalDistanceKm,
        estimatedFlightHours,
        cruiseSpeedKts,
        burnRateLph,
        tripFuelLiters,
        taxiFuelLiters,
        reserveFuelLiters,
        totalFuelLiters,
        fleetTotalFuelLiters,
        aircraftCount: effectiveAircraftCount,
        equipmentConfig,
        payloadKg,
        takeoffWeightKg,
        maxTakeoffWeightKg,
        isOverweight,
      });
    }
  }, [
    totalDistanceNm,
    totalDistanceKm,
    estimatedFlightHours,
    cruiseSpeedKts,
    burnRateLph,
    tripFuelLiters,
    taxiFuelLiters,
    reserveFuelLiters,
    totalFuelLiters,
    fleetTotalFuelLiters,
    effectiveAircraftCount,
    equipmentConfig,
    payloadKg,
    takeoffWeightKg,
    maxTakeoffWeightKg,
    isOverweight,
    onPlanningChange,
  ]);

  const hasRouteCoordinates = Boolean(departureLat && departureLng);

  // Sub-render: Route Legs Breakdown
  const renderRouteLegs = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:routes" className="w-4 h-4 text-[#7FD5FF]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#7FD5FF]">
            Operational Package Leg Breakdown ({legs.length} Sortie Legs)
          </span>
        </div>
        {hasRouteCoordinates && (
          <span className="text-xs text-gray-300 font-mono">
            Corridor: <strong className="text-white">{totalDistanceNm} NM</strong> ({totalDistanceKm} km) • Est. ETE:{" "}
            <strong className="text-white">
              {Math.floor(estimatedFlightHours)}h{" "}
              {Math.round((estimatedFlightHours % 1) * 60)}m
            </strong>
          </span>
        )}
      </div>

      {!hasRouteCoordinates ? (
        <div className="rounded-lg border border-dashed border-[#0A4D66]/50 p-5 text-center text-xs text-gray-400">
          Enter Departure and Arrival coordinates to compute corridor distance, legs, and flight duration.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#0A4D66]/30 bg-[#001825]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#0A4D66]/40 bg-[#001219] text-[11px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="p-3">Leg</th>
                <th className="p-3">From Fix</th>
                <th className="p-3">To Fix</th>
                <th className="p-3 text-right">Bearing</th>
                <th className="p-3 text-right">Distance (NM)</th>
                <th className="p-3 text-right">Distance (km)</th>
                <th className="p-3 text-right">Leg ETE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A4D66]/20 font-mono">
              {legs.map((leg, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 font-sans font-bold text-[#F59E0B]">
                    Leg {idx + 1}
                  </td>
                  <td className="p-3 font-sans text-gray-300">{leg.fromName}</td>
                  <td className="p-3 font-sans text-white font-medium">{leg.toName}</td>
                  <td className="p-3 text-right text-[#7FD5FF]">{String(leg.bearingDeg).padStart(3, "0")}° True</td>
                  <td className="p-3 text-right text-gray-200">{leg.distanceNm} NM</td>
                  <td className="p-3 text-right text-gray-400">{leg.distanceKm} km</td>
                  <td className="p-3 text-right text-emerald-400">~{leg.eteMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Sub-render: Fuel Calculation & Unit Inventory
  const renderFuelCalculation = () => (
    <div className="rounded-xl border border-[#0A4D66]/30 bg-[#001825]/80 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/20 pb-2">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:barrel" className="w-4 h-4 text-[#F59E0B]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Pre-Flight Fuel Calculation &amp; Unit Inventory Status
          </h4>
          <span className="rounded bg-[#0A4D66]/40 px-2 py-0.5 text-[10px] font-semibold text-[#7FD5FF]">
            {effectiveAircraftCount} {effectiveAircraftCount === 1 ? "Airframe Sortie" : "Airframe Sorties"}
          </span>
        </div>

        {/* Live Inventory Connection Status Badge */}
        {unitId ? (
          isLoadingInventory ? (
            <span className="text-[11px] text-gray-400">Checking unit fuel stock...</span>
          ) : availableFuelStock >= fleetTotalFuelLiters ? (
            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <Icon icon="mdi:check-circle" className="w-3.5 h-3.5" />
              <span>
                Unit Stock Sufficient: {availableFuelStock.toLocaleString()} L in Depot
                {effectiveAircraftCount > 1
                  ? ` (${fleetTotalFuelLiters.toLocaleString()} L Req for ${effectiveAircraftCount} airframes)`
                  : ` (Req: ${totalFuelLiters.toLocaleString()} L)`}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
              <Icon icon="mdi:alert" className="w-3.5 h-3.5" />
              <span>
                Fuel Stock Alert: Depot has {availableFuelStock.toLocaleString()} L (Req:{" "}
                {fleetTotalFuelLiters.toLocaleString()} L
                {effectiveAircraftCount > 1 ? ` for ${effectiveAircraftCount} airframes` : ""})
              </span>
            </span>
          )
        ) : (
          <span className="text-[11px] text-gray-500 italic">Select a Unit in Step 1 to verify depot stock</span>
        )}
      </div>

      {!hasRouteCoordinates ? (
        <div className="rounded-lg border border-dashed border-[#0A4D66]/50 p-4 text-center text-xs text-gray-400">
          Plot Departure and Arrival coordinates in Step 2 to compute fuel burn and duration for allocated airframes.
        </div>
      ) : (
        <>
          {/* Performance Sliders / Inputs */}
          {isEditable && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Planned Cruising Ground Speed</span>
                  <span className="text-white font-mono">{cruiseSpeedKts} kts</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={200}
                  step={5}
                  value={cruiseSpeedKts}
                  onChange={(e) => setCruiseSpeedKts(Number(e.target.value))}
                  className="w-full accent-[#0369A1]"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Aircraft Jet A-1 Burn Rate</span>
                  <span className="text-white font-mono">{burnRateLph} L/hour</span>
                </div>
                <input
                  type="range"
                  min={120}
                  max={800}
                  step={10}
                  value={burnRateLph}
                  onChange={(e) => setBurnRateLph(Number(e.target.value))}
                  className="w-full accent-[#0369A1]"
                />
              </div>
            </div>
          )}

          {/* Fuel Breakdown Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="rounded border border-[#0A4D66]/40 bg-[#001219] p-3">
              <div className="text-[10px] uppercase text-gray-400">Taxi &amp; Run-up</div>
              <div className="text-base font-bold text-gray-200 font-mono">
                {effectiveAircraftCount > 1 ? `${fleetTaxiFuelLiters} L` : `${taxiFuelLiters} L`}
              </div>
              <div className="text-[10px] text-gray-500">
                {effectiveAircraftCount > 1
                  ? `${effectiveAircraftCount} × 40 L start / hover`
                  : "Fixed start / hover"}
              </div>
            </div>
            <div className="rounded border border-[#0A4D66]/40 bg-[#001219] p-3">
              <div className="text-[10px] uppercase text-gray-400">Enroute Trip Fuel</div>
              <div className="text-base font-bold text-white font-mono">
                {effectiveAircraftCount > 1 ? `${fleetTripFuelLiters.toLocaleString()} L` : `${tripFuelLiters} L`}
              </div>
              <div className="text-[10px] text-gray-500">
                {effectiveAircraftCount > 1
                  ? `${effectiveAircraftCount} airframes @ ${tripFuelLiters} L`
                  : `${totalDistanceNm} NM @ ${cruiseSpeedKts} kts`}
              </div>
            </div>
            <div className="rounded border border-[#0A4D66]/40 bg-[#001219] p-3">
              <div className="text-[10px] uppercase text-gray-400">30-min Reserve</div>
              <div className="text-base font-bold text-[#F59E0B] font-mono">
                {effectiveAircraftCount > 1 ? `${fleetReserveFuelLiters.toLocaleString()} L` : `${reserveFuelLiters} L`}
              </div>
              <div className="text-[10px] text-gray-500">
                {effectiveAircraftCount > 1
                  ? `${effectiveAircraftCount} × ${reserveFuelLiters} L reserve`
                  : "Military VFR standard"}
              </div>
            </div>
            <div className="rounded border border-[#7FD5FF]/40 bg-[#001219] p-3 ring-1 ring-[#7FD5FF]/30">
              <div className="text-[10px] uppercase text-[#7FD5FF] font-bold">Total Planned Fuel</div>
              <div className="text-lg font-black text-white font-mono">
                {fleetTotalFuelLiters.toLocaleString()} L
              </div>
              <div className="text-[10px] text-gray-400">
                ~{fleetFuelWeightKg.toLocaleString()} kg Jet A-1
              </div>
              {effectiveAircraftCount > 1 && (
                <div className="text-[10px] text-[#7FD5FF] font-medium mt-0.5">
                  ({effectiveAircraftCount} airframes × {totalFuelLiters.toLocaleString()} L)
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Variant: legs-only
  if (variant === "legs-only") {
    return (
      <div
        className={`rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 text-gray-200 space-y-3 ${className}`.trim()}
      >
        {renderRouteLegs()}
      </div>
    );
  }

  // Variant: fuel-only
  if (variant === "fuel-only") {
    return (
      <div className={className}>
        {renderFuelCalculation()}
      </div>
    );
  }

  // Variant: all (default)
  return (
    <div
      className={`rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-5 text-gray-200 space-y-6 ${className}`.trim()}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A4D66]/30 pb-3">
        <div className="flex items-center gap-2">
          <Icon icon="mdi:gas-station-outline" className="w-5 h-5 text-[#7FD5FF]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Operational Fuel Planning &amp; Unit Inventory Status
          </h3>
          <span className="rounded bg-[#0A4D66]/40 px-2 py-0.5 text-[10px] font-semibold text-[#7FD5FF]">
            Multi-Mission Package Engine
          </span>
        </div>
      </div>

      {!hasRouteCoordinates ? (
        <div className="rounded-lg border border-dashed border-[#0A4D66]/50 p-6 text-center text-xs text-gray-400">
          Enter Departure and Arrival coordinates to compute corridor distance, fuel burn, and flight duration.
        </div>
      ) : (
        <>
          {renderRouteLegs()}
          {renderFuelCalculation()}
        </>
      )}
    </div>
  );
};
