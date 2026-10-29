import { useState, useRef, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import {
  useGetWeatherBriefingQuery,
  type WeatherStationData,
} from "../api";

export type SearchableAirfield = {
  icao: string;
  name: string;
  city: string;
  state: string;
  elev_ft?: number;
  lat: number;
  lon: number;
  isHub?: boolean;
};

/**
 * Verified Nigerian military and civilian aerodromes with standard ICAO identifiers.
 */
export const NIGERIAN_AIRFIELDS_CATALOG: SearchableAirfield[] = [
  { icao: "DNMM", name: "Murtala Muhammed International Airport", city: "Lagos", state: "Lagos State", elev_ft: 135, lat: 6.5774, lon: 3.3212, isHub: true },
  { icao: "DNKA", name: "Kaduna Military & Civil Airport (NAF Air Training Command)", city: "Kaduna", state: "Kaduna State", elev_ft: 2073, lat: 10.6960, lon: 7.3201, isHub: true },
  { icao: "DNAA", name: "Nnamdi Azikiwe International Airport (HQ NA Avn / Wing)", city: "Abuja", state: "FCT", elev_ft: 1123, lat: 9.0065, lon: 7.2631, isHub: true },
  { icao: "DNKN", name: "Mallam Aminu Kano International Airport", city: "Kano", state: "Kano State", elev_ft: 1562, lat: 12.0476, lon: 8.5246, isHub: true },
  { icao: "DNPO", name: "Port Harcourt International Airport (NAF 115 SOG)", city: "Port Harcourt", state: "Rivers State", elev_ft: 87, lat: 5.0155, lon: 6.9496, isHub: true },
  { icao: "DNMA", name: "Maiduguri International Airport (NA Avn OPHK)", city: "Maiduguri", state: "Borno State", elev_ft: 1099, lat: 11.8553, lon: 13.0809, isHub: true },
  { icao: "DNEN", name: "Akanu Ibiam International Airport", city: "Enugu", state: "Enugu State", elev_ft: 466, lat: 6.4743, lon: 7.5620, isHub: true },
  { icao: "DNJO", name: "Yakubu Gowon Airport", city: "Jos", state: "Plateau State", elev_ft: 4232, lat: 9.6398, lon: 8.8691, isHub: true },
  { icao: "DNYO", name: "Yola Airport (NAF Composite Wing)", city: "Yola", state: "Adamawa State", elev_ft: 599, lat: 9.2575, lon: 12.4303 },
  { icao: "DNSO", name: "Sadiq Abubakar III International Airport", city: "Sokoto", state: "Sokoto State", elev_ft: 1010, lat: 12.9163, lon: 5.2072 },
  { icao: "DNBE", name: "Benin Airport", city: "Benin City", state: "Edo State", elev_ft: 258, lat: 6.3170, lon: 5.5995 },
  { icao: "DNIL", name: "Ilorin International Airport", city: "Ilorin", state: "Kwara State", elev_ft: 1126, lat: 8.4402, lon: 4.4939 },
  { icao: "DNCA", name: "Margaret Ekpo International Airport", city: "Calabar", state: "Cross River State", elev_ft: 211, lat: 4.9760, lon: 8.3472 },
  { icao: "DNGO", name: "Gombe Lawanti International Airport", city: "Gombe", state: "Gombe State", elev_ft: 1590, lat: 10.3015, lon: 10.9004 },
  { icao: "DNBK", name: "Sir Ahmadu Bello International Airport", city: "Birnin Kebbi", state: "Kebbi State", elev_ft: 755, lat: 12.4340, lon: 4.1990 },
  { icao: "DNIB", name: "Ibadan Airport", city: "Ibadan", state: "Oyo State", elev_ft: 725, lat: 7.3625, lon: 3.9783 },
  { icao: "DNMN", name: "Minna Airport", city: "Minna", state: "Niger State", elev_ft: 833, lat: 9.6521, lon: 6.4623 },
  { icao: "DNZA", name: "Zaria Airfield", city: "Zaria", state: "Kaduna State", elev_ft: 2170, lat: 11.1302, lon: 7.6858 },
  { icao: "DNKT", name: "Umaru Musa Yar'adua Airport", city: "Katsina", state: "Katsina State", elev_ft: 1660, lat: 13.0075, lon: 7.6601 },
  { icao: "DNAK", name: "Akure Airport", city: "Akure", state: "Ondo State", elev_ft: 1100, lat: 7.2467, lon: 5.3010 },
  { icao: "DNMK", name: "Makurdi Air Force Base (Tactical Air Command)", city: "Makurdi", state: "Benue State", elev_ft: 371, lat: 7.7039, lon: 8.6139 },
  { icao: "DNKJ", name: "Kainji Air Force Station (Super Tucano Wing)", city: "Kainji", state: "Niger State", elev_ft: 469, lat: 9.8444, lon: 4.4842 },
  { icao: "DNAS", name: "Asaba International Airport", city: "Asaba", state: "Delta State", elev_ft: 305, lat: 6.2023, lon: 6.6636 },
  { icao: "DNIM", name: "Sam Mbakwe International Cargo Airport", city: "Owerri", state: "Imo State", elev_ft: 373, lat: 5.4273, lon: 7.2060 },
  { icao: "DNSU", name: "Warri Airport (Osubi Airfield)", city: "Warri", state: "Delta State", elev_ft: 23, lat: 5.5964, lon: 5.8181 },
  { icao: "DNAI", name: "Victor Attah International Airport", city: "Uyo", state: "Akwa Ibom State", elev_ft: 170, lat: 4.8725, lon: 8.0877 },
  { icao: "DNBC", name: "Sir Abubakar Tafawa Balewa International Airport", city: "Bauchi", state: "Bauchi State", elev_ft: 1980, lat: 10.4853, lon: 9.7431 },
  { icao: "DNDS", name: "Dutse International Airport", city: "Dutse", state: "Jigawa State", elev_ft: 1365, lat: 11.7947, lon: 9.3408 },
  { icao: "DNYG", name: "Bayelsa International Airport", city: "Yenagoa", state: "Bayelsa State", elev_ft: 45, lat: 4.9744, lon: 6.2575 },
];

export type WeatherBriefingProps = {
  departureLat?: number | string | null;
  departureLon?: number | string | null;
  arrivalLat?: number | string | null;
  arrivalLon?: number | string | null;
  stations?: string;
  flightDate?: string | null;
  flightTime?: string | null;
  className?: string;
  onSelectDepartureAirport?: (airport: { icao: string; name: string; lat: number; lon: number }) => void;
  onSelectArrivalAirport?: (airport: { icao: string; name: string; lat: number; lon: number }) => void;
};

/**
 * Returns accessible light-mode badge tokens based on Flight Category or Station Status.
 */
const getStatusBadge = (station: WeatherStationData) => {
  if (station.status === "service_unavailable") {
    return {
      bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]",
      dot: "bg-[#B45309]",
      label: "Service Unavailable",
    };
  }

  if (!station.has_data) {
    return {
      bg: "bg-[#F1F5F9] border-[#E2E8F0] text-[#64748B]",
      dot: "bg-[#94A3B8]",
      label: "No Current METAR",
    };
  }

  if (station.is_outdated) {
    return {
      bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]",
      dot: "bg-[#B45309]",
      label: "Observation Outdated",
    };
  }

  const category = (station.flight_category || "").toUpperCase();
  switch (category) {
    case "VFR":
      return {
        bg: "bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]",
        dot: "bg-[#15803D]",
        label: "VFR (Visual Flight Rules)",
      };
    case "MVFR":
      return {
        bg: "bg-[#EAF5FC] border-[#BAE6FD] text-[#0077B6]",
        dot: "bg-[#0077B6]",
        label: "MVFR (Marginal VFR)",
      };
    case "IFR":
      return {
        bg: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]",
        dot: "bg-[#B45309]",
        label: "IFR (Instrument Rules)",
      };
    case "LIFR":
      return {
        bg: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]",
        dot: "bg-[#B91C1C]",
        label: "LIFR (Low Instrument)",
      };
    default:
      return {
        bg: "bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]",
        dot: "bg-[#15803D]",
        label: "METAR Available",
      };
  }
};

const StationWeatherCard = ({
  station,
  roleLabel,
  onRetry,
  onRemove,
  onSetDeparture,
  onSetArrival,
}: {
  station: WeatherStationData;
  roleLabel?: string;
  onRetry?: () => void;
  onRemove?: () => void;
  onSetDeparture?: () => void;
  onSetArrival?: () => void;
}) => {
  const [showRawMetar, setShowRawMetar] = useState(false);
  const [showRawTaf, setShowRawTaf] = useState(false);

  const badge = getStatusBadge(station);
  const obsFormatted = station.observed_at
    ? new Date(station.observed_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <div className="rounded-[10px] border border-[#DCE4EC] bg-[#FFFFFF] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-4">
      {/* Station Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#DCE4EC] pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {roleLabel ? (
                <span className="rounded bg-[#EAF5FC] border border-[#BAE6FD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0077B6]">
                  {roleLabel}
                </span>
              ) : null}
              <span className="text-lg font-bold text-[#0F172A] tracking-tight">
                {station.icao}
              </span>
              <span className="text-xs font-semibold text-[#475569] truncate max-w-xs" title={station.name}>
                {station.name}
              </span>
            </div>
            {station.elevation_ft !== null ? (
              <p className="text-[11px] text-[#64748B] mt-1 font-medium">
                Field Elevation: {station.elevation_ft.toLocaleString()} ft AMSL
                {station.distance_to_query_nm !== undefined
                  ? ` • ${station.distance_to_query_nm} NM from route point`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.bg}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </span>

            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1 rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove from monitored weather cards"
              >
                <Icon icon="mdi:close" className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Outdated Observation Warning Alert */}
        {station.has_data && station.is_outdated ? (
          <div className="mt-3 rounded-lg border border-[#FDE68A] bg-[#FEF3C7] p-2.5 flex items-start gap-2 text-xs text-[#B45309]">
            <Icon icon="mdi:clock-alert-outline" className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold">Observation Outdated: </span>
              {station.status_message ||
                `Reported ${station.age_minutes}m ago. Verify fresh meteorological update prior to flight release.`}
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Content Area */}
      {station.has_data ? (
        <div className="space-y-3.5 flex-1">
          {/* Observation Timestamp Bar */}
          <div className="flex items-center justify-between text-xs text-[#64748B] bg-[#F8FAFC] border border-[#DCE4EC] rounded-lg px-3 py-1.5">
            <span className="flex items-center gap-1.5">
              <Icon icon="mdi:clock-outline" className="w-3.5 h-3.5 text-[#0077B6]" />
              <span>
                Observed:{" "}
                <strong className="text-[#0F172A] font-semibold">
                  {obsFormatted || "Recent"}
                </strong>
                {station.age_minutes !== null ? ` (${station.age_minutes}m ago)` : ""}
              </span>
            </span>
            <span className="text-[11px] text-[#475569] font-medium">
              Source: NOAA AWC
            </span>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Wind */}
            <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#DCE4EC]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">
                Surface Wind
              </span>
              <span className="text-[#0F172A] font-bold text-sm mt-0.5 block truncate">
                {station.wind?.label || "Calm"}
              </span>
            </div>

            {/* Visibility */}
            <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#DCE4EC]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">
                Visibility
              </span>
              <span className="text-[#0F172A] font-bold text-sm mt-0.5 block truncate">
                {station.visibility?.label || "10+ SM"}
              </span>
            </div>

            {/* Temperature & Dew Point */}
            <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#DCE4EC]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">
                Temp / Dew
              </span>
              <span className="text-[#0F172A] font-bold text-sm mt-0.5 block truncate">
                {station.temperature_c !== null
                  ? `${station.temperature_c}°C / ${station.dewpoint_c ?? "-"}°C`
                  : "N/A"}
              </span>
            </div>

            {/* Altimeter / QNH */}
            <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#DCE4EC]">
              <span className="text-[#64748B] block text-[10px] uppercase font-bold tracking-wider">
                Altimeter / QNH
              </span>
              <span className="text-[#0F172A] font-bold text-sm mt-0.5 block truncate">
                {station.altimeter_hpa
                  ? `${station.altimeter_hpa} hPa`
                  : station.altimeter_inhg
                    ? `${station.altimeter_inhg} inHg`
                    : "N/A"}
              </span>
            </div>
          </div>

          {/* Cloud Layers */}
          {station.clouds && station.clouds.length > 0 ? (
            <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#DCE4EC] flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-[#64748B] font-medium">
                <Icon icon="mdi:weather-cloudy" className="w-4 h-4 text-[#0077B6]" />
                <span>Cloud Layers:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {station.clouds.map((cloud, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-[#FFFFFF] border border-[#CBD5E1] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#0F172A]"
                  >
                    {cloud.cover} {cloud.base_ft !== null ? `${cloud.base_ft.toLocaleString()} ft` : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Weather Phenomena (if observed) */}
          {station.weather_phenomena?.label ? (
            <div className="rounded-lg bg-[#FEF3C7]/60 border border-[#FDE68A] p-2 flex items-center gap-2 text-xs text-[#B45309]">
              <Icon icon="mdi:weather-lightning" className="w-4 h-4 text-[#B45309] shrink-0" />
              <span>
                <strong>Phenomena:</strong> {station.weather_phenomena.label}
                {station.weather_phenomena.raw ? ` (${station.weather_phenomena.raw})` : ""}
              </span>
            </div>
          ) : null}

          {/* Expandable Raw METAR */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRawMetar((prev) => !prev)}
              className="text-[#0077B6] hover:text-[#0B5D7A] text-xs font-semibold flex items-center gap-1 focus:outline-none focus:underline"
              aria-expanded={showRawMetar}
            >
              <Icon
                icon={showRawMetar ? "mdi:chevron-up" : "mdi:chevron-down"}
                className="w-4 h-4"
              />
              <span>{showRawMetar ? "Hide Raw METAR" : "View Raw METAR"}</span>
            </button>

            {showRawMetar && station.raw_metar ? (
              <div className="mt-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] p-3 text-xs font-mono text-[#0F172A] leading-relaxed break-all">
                <div className="text-[10px] uppercase font-bold text-[#64748B] mb-1 font-sans">
                  Official METAR Telemetry String:
                </div>
                {station.raw_metar}
              </div>
            ) : null}
          </div>

          {/* Terminal Aerodrome Forecast (TAF) Section */}
          <div className="border-t border-[#DCE4EC] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                <Icon icon="mdi:calendar-arrow-right" className="w-3.5 h-3.5 text-[#0077B6]" />
                <span>Terminal Forecast (TAF)</span>
              </span>

              {station.has_taf ? (
                <span className="inline-flex items-center gap-1 rounded bg-[#EAF5FC] border border-[#BAE6FD] px-2 py-0.5 text-[10px] font-semibold text-[#0077B6]">
                  <Icon icon="mdi:check-circle" className="w-3 h-3 text-[#0077B6]" />
                  <span>Forecast Available</span>
                </span>
              ) : (
                <span className="text-[11px] text-[#94A3B8] italic">
                  No TAF Published
                </span>
              )}
            </div>

            {station.has_taf && station.raw_taf ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowRawTaf((prev) => !prev)}
                  className="text-[#0077B6] hover:text-[#0B5D7A] text-xs font-semibold flex items-center gap-1 focus:outline-none focus:underline"
                  aria-expanded={showRawTaf}
                >
                  <Icon
                    icon={showRawTaf ? "mdi:chevron-up" : "mdi:chevron-down"}
                    className="w-4 h-4"
                  />
                  <span>{showRawTaf ? "Hide TAF Forecast" : "View TAF Forecast"}</span>
                </button>

                {showRawTaf ? (
                  <div className="mt-2 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] p-3 text-xs font-mono text-[#0F172A] leading-relaxed whitespace-pre-wrap break-all">
                    <div className="text-[10px] uppercase font-bold text-[#64748B] mb-1 font-sans">
                      TAF Terminal Aerodrome Forecast:
                    </div>
                    {station.raw_taf}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : station.status === "service_unavailable" ? (
        /* State D: WEATHER SERVICE UNAVAILABLE */
        <div className="rounded-lg bg-[#F8FAFC] border border-[#DCE4EC] p-5 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#B45309]">
            <Icon icon="mdi:cloud-off-outline" className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-[#0F172A]">
            Weather Service Unavailable
          </h4>
          <p className="text-xs text-[#64748B] max-w-sm">
            Weather information could not be retrieved from the aviation weather provider. Please try again.
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shadow-sm"
            >
              <Icon icon="mdi:refresh" className="w-3.5 h-3.5 text-[#0077B6]" />
              <span>Retry Telemetry</span>
            </button>
          ) : null}
        </div>
      ) : (
        /* State C: NO CURRENT METAR */
        <div className="rounded-lg bg-[#F8FAFC] border border-[#DCE4EC] p-5 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
            <Icon icon="mdi:weather-dust" className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-[#0F172A]">
            No Current METAR
          </h4>
          <p className="text-xs text-[#64748B] max-w-sm">
            No current observation is available from the weather service for this station.
          </p>
          <span className="text-[11px] text-[#94A3B8] italic block pt-1">
            Station reports irregularly or is outside active WMO aeronautical broadcast hours.
          </span>
        </div>
      )}

      {/* Optional action buttons to apply as route departure or destination */}
      {(onSetDeparture || onSetArrival) && (
        <div className="flex items-center gap-2 pt-3 border-t border-[#DCE4EC]">
          {onSetDeparture && (
            <button
              type="button"
              onClick={onSetDeparture}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition-colors shadow-sm"
              title="Apply this airfield coordinates as Operation Departure"
            >
              <Icon icon="mdi:airplane-takeoff" className="w-3.5 h-3.5 text-emerald-600" />
              <span>Set as Departure</span>
            </button>
          )}
          {onSetArrival && (
            <button
              type="button"
              onClick={onSetArrival}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-50 hover:bg-red-100/80 px-2.5 py-1.5 text-xs font-semibold text-red-800 transition-colors shadow-sm"
              title="Apply this airfield coordinates as Operation Destination"
            >
              <Icon icon="mdi:airplane-landing" className="w-3.5 h-3.5 text-red-600" />
              <span>Set as Destination</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const QUICK_PRESETS = [
  { icao: "DNMM", label: "Lagos (DNMM)" },
  { icao: "DNKA", label: "Kaduna (DNKA)" },
  { icao: "DNAA", label: "Abuja (DNAA)" },
  { icao: "DNKN", label: "Kano (DNKN)" },
  { icao: "DNPO", label: "Port Harcourt (DNPO)" },
  { icao: "DNMA", label: "Maiduguri (DNMA)" },
  { icao: "DNEN", label: "Enugu (DNEN)" },
  { icao: "DNJO", label: "Jos (DNJO)" },
];

export const WeatherBriefingCard = ({
  departureLat,
  departureLon,
  arrivalLat,
  arrivalLon,
  stations,
  flightDate,
  flightTime,
  className = "",
  onSelectDepartureAirport,
  onSelectArrivalAirport,
}: WeatherBriefingProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchedStations, setSearchedStations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const depLatNum = departureLat ? Number(departureLat) : undefined;
  const depLonNum = departureLon ? Number(departureLon) : undefined;
  const arrLatNum = arrivalLat ? Number(arrivalLat) : undefined;
  const arrLonNum = arrivalLon ? Number(arrivalLon) : undefined;

  // Combine parent provided stations and user-searched stations
  const combinedStations = useMemo(() => {
    const list: string[] = [];
    if (stations) {
      list.push(...stations.split(",").map((s) => s.trim().toUpperCase()));
    }
    list.push(...searchedStations);
    return Array.from(new Set(list.filter(Boolean))).join(",");
  }, [stations, searchedStations]);

  const { data, isLoading, isFetching, refetch } = useGetWeatherBriefingQuery(
    {
      departure_lat: depLatNum,
      departure_lon: depLonNum,
      arrival_lat: arrLatNum,
      arrival_lon: arrLonNum,
      stations: combinedStations || undefined,
      flight_date: flightDate || undefined,
      flight_time: flightTime || undefined,
    },
    {
      pollingInterval: 300000, // Revalidate every 5 minutes
    }
  );

  const handleRefresh = async () => {
    if (isFetching || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddStation = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    if (!searchedStations.includes(clean)) {
      setSearchedStations((prev) => [clean, ...prev]);
    }
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  const handleToggleStation = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (searchedStations.includes(clean)) {
      setSearchedStations((prev) => prev.filter((c) => c !== clean));
    } else {
      setSearchedStations((prev) => [clean, ...prev]);
    }
  };

  const handleRemoveStation = (code: string) => {
    setSearchedStations((prev) => prev.filter((c) => c !== code));
  };

  const handleClearAllSearched = () => {
    setSearchedStations([]);
    setSearchQuery("");
  };

  const getAirfieldMeta = (icao: string) => {
    return NIGERIAN_AIRFIELDS_CATALOG.find((a) => a.icao.toUpperCase() === icao.toUpperCase());
  };

  // Filter airport suggestions
  const filteredAirfields = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return NIGERIAN_AIRFIELDS_CATALOG.filter((a) => a.isHub);
    }
    return NIGERIAN_AIRFIELDS_CATALOG.filter(
      (a) =>
        a.icao.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.state.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchQuery]);

  const stationsMap = data?.stations || {};
  const stationEntries = Object.values(stationsMap);
  const schedule = data?.flight_schedule;
  const lastUpdated = data?.last_updated || (data?.fetched_at ? new Date(data.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);

  // Identify departure and arrival station objects
  const departureIcao = data?.departure_station;
  const arrivalIcao = data?.arrival_station;

  const departureStationData = departureIcao ? stationsMap[departureIcao] : null;
  const arrivalStationData = arrivalIcao ? stationsMap[arrivalIcao] : null;

  // Searched station objects
  const searchedStationEntries = useMemo(() => {
    return searchedStations
      .map((code) => stationsMap[code])
      .filter((st): st is WeatherStationData => Boolean(st));
  }, [searchedStations, stationsMap]);

  // Other enroute stations (excluding departure, arrival, and user-searched stations)
  const otherStations = stationEntries.filter(
    (st) =>
      st.icao !== departureIcao &&
      st.icao !== arrivalIcao &&
      !searchedStations.includes(st.icao)
  );

  return (
    <div
      className={`rounded-[10px] border border-[#DCE4EC] bg-[#FFFFFF] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-5 text-[#0F172A] ${className}`.trim()}
    >
      {/* A. Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE4EC] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#EAF5FC] text-[#0077B6]">
              <Icon icon="mdi:weather-partly-cloudy" className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-[#0F172A] tracking-tight">
              Operational Weather Briefing
            </h3>
          </div>
          <p className="text-xs text-[#475569] mt-1">
            Current aerodrome observations, weather alerts, and aviation forecasts for flight planning.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated ? (
            <span className="text-xs text-[#64748B] hidden sm:inline-block">
              Updated: <strong className="text-[#0F172A] font-semibold">{lastUpdated}</strong>
            </span>
          ) : null}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isFetching || isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/20 transition-all disabled:opacity-50 shadow-sm"
            title="Request fresh weather telemetry from Aviation Weather Center"
          >
            <Icon
              icon="mdi:refresh"
              className={`w-3.5 h-3.5 text-[#0077B6] ${isFetching || isRefreshing ? "animate-spin" : ""}`}
            />
            <span>{isFetching || isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* B. Airport Weather Search & Dynamic Explorer Bar */}
      <div className="rounded-xl border border-[#DCE4EC] bg-[#F8FAFC] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:airplane-search" className="w-5 h-5 text-[#0077B6]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              Search Airfield Weather
            </span>
            <span className="text-[11px] text-[#64748B] hidden md:inline">
              (e.g., check Lagos while in Kaduna, or look up any airport METAR)
            </span>
          </div>
          {searchedStations.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllSearched}
              className="text-xs text-[#0077B6] hover:text-red-600 font-semibold transition-colors flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5" />
              <span>Clear Lookups ({searchedStations.length})</span>
            </button>
          )}
        </div>

        {/* Search Input with Autocomplete Dropdown */}
        <div className="relative" ref={searchContainerRef}>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon icon="mdi:magnify" className="w-4 h-4 text-[#64748B]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    if (filteredAirfields.length > 0) {
                      handleAddStation(filteredAirfields[0].icao);
                    } else if (searchQuery.trim().length >= 3) {
                      handleAddStation(searchQuery.trim().toUpperCase());
                    }
                  }
                }
              }}
              placeholder="Search airfield by City or ICAO (e.g., Lagos, Kaduna, Abuja, Port Harcourt, DNMM, DNKA)..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] pl-9 pr-24 py-2 text-xs font-medium text-[#0F172A] placeholder-[#94A3B8] focus:border-[#0077B6] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/20 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-20 text-[#94A3B8] hover:text-[#0F172A] p-1"
                title="Clear input"
              >
                <Icon icon="mdi:close-circle" className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (searchQuery.trim()) {
                  if (filteredAirfields.length > 0) {
                    handleAddStation(filteredAirfields[0].icao);
                  } else {
                    handleAddStation(searchQuery.trim().toUpperCase());
                  }
                }
              }}
              disabled={!searchQuery.trim()}
              className="absolute right-1.5 inline-flex items-center gap-1 rounded-md bg-[#0077B6] hover:bg-[#005B8C] disabled:bg-[#CBD5E1] px-3 py-1 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm disabled:cursor-not-allowed"
            >
              <Icon icon="mdi:cloud-search-outline" className="w-3.5 h-3.5" />
              <span>Lookup</span>
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#CBD5E1] bg-[#FFFFFF] shadow-xl py-1 text-xs text-[#0F172A] divide-y divide-[#F1F5F9]">
              {filteredAirfields.length > 0 ? (
                filteredAirfields.map((airport) => {
                  const isAlreadyAdded = searchedStations.includes(airport.icao);
                  return (
                    <button
                      key={airport.icao}
                      type="button"
                      onClick={() => handleAddStation(airport.icao)}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                        isAlreadyAdded ? "bg-[#EAF5FC]/50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#EAF5FC] text-[#0077B6] border border-[#BAE6FD]">
                          {airport.icao}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0F172A] truncate">
                            {airport.name}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {airport.city}, {airport.state}
                            {airport.elev_ft !== undefined ? ` • Elev: ${airport.elev_ft.toLocaleString()} ft` : ""}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-[#0077B6] shrink-0 ml-2">
                        {isAlreadyAdded ? "Viewing" : "+ Add"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-[#64748B]">
                  No predefined aerodrome matches "{searchQuery}".
                  {searchQuery.trim().length >= 3 && (
                    <button
                      type="button"
                      onClick={() => handleAddStation(searchQuery.trim().toUpperCase())}
                      className="mt-2 block mx-auto px-3 py-1 bg-[#0077B6] text-white rounded font-semibold text-xs hover:bg-[#005B8C] cursor-pointer"
                    >
                      Lookup custom ICAO station: {searchQuery.trim().toUpperCase()}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Hub Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mr-1">
            Quick Hubs:
          </span>
          {QUICK_PRESETS.map((preset) => {
            const isSelected = searchedStations.includes(preset.icao);
            return (
              <button
                key={preset.icao}
                type="button"
                onClick={() => handleToggleStation(preset.icao)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0077B6] text-white border border-[#005B8C] shadow-sm"
                    : "bg-[#FFFFFF] text-[#475569] border border-[#CBD5E1] hover:border-[#0077B6] hover:text-[#0077B6]"
                }`}
                title={`Check live weather for ${preset.label}`}
              >
                <Icon icon="mdi:airplane" className="w-3 h-3" />
                <span>{preset.label}</span>
                {isSelected && <Icon icon="mdi:check" className="w-3 h-3 text-white" />}
              </button>
            );
          })}
        </div>

        {/* Active Searched Station Pills */}
        {searchedStations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#E2E8F0]">
            <span className="text-[11px] font-bold text-[#0077B6] uppercase tracking-wider mr-1">
              Active Lookups:
            </span>
            {searchedStations.map((code) => {
              const meta = getAirfieldMeta(code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF5FC] border border-[#BAE6FD] pl-2.5 pr-1.5 py-0.5 text-xs font-semibold text-[#0077B6]"
                >
                  <span>{meta ? `${meta.city} (${code})` : code}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStation(code)}
                    className="p-0.5 rounded-full hover:bg-[#BAE6FD] text-[#0077B6] transition-colors cursor-pointer"
                    title={`Remove ${code} lookup`}
                  >
                    <Icon icon="mdi:close" className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Flight Schedule & Meteorological Validity Banner */}
      {schedule || flightDate ? (
        <div
          className={`rounded-lg border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            schedule?.is_today
              ? "bg-[#DCFCE7]/60 border-[#86EFAC] text-[#15803D]"
              : schedule?.is_future
                ? "bg-[#EAF5FC] border-[#BAE6FD] text-[#0B5D7A]"
                : "bg-[#F8FAFC] border-[#DCE4EC] text-[#475569]"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-md mt-0.5 shrink-0 ${
                schedule?.is_today
                  ? "bg-[#DCFCE7] text-[#15803D]"
                  : schedule?.is_future
                    ? "bg-[#EAF5FC] text-[#0077B6]"
                    : "bg-[#F1F5F9] text-[#64748B]"
              }`}
            >
              <Icon icon="mdi:calendar-clock" className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#0F172A] text-[13px] tracking-wide">
                  Mission Sortie: {schedule?.flight_date || flightDate}
                  {flightTime ? ` at ${flightTime} hrs (ZULU/Local)` : ""}
                </span>
                {schedule?.is_today ? (
                  <span className="rounded-full bg-[#DCFCE7] border border-[#86EFAC] px-2.5 py-0.5 text-[10px] font-bold text-[#15803D] uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" />
                    Today's Sortie (Live METAR Active)
                  </span>
                ) : schedule?.is_future ? (
                  <span className="rounded-full bg-[#EAF5FC] border border-[#BAE6FD] px-2.5 py-0.5 text-[10px] font-bold text-[#0077B6] uppercase tracking-wide">
                    Scheduled in {Math.abs(schedule.days_from_today)} Day
                    {Math.abs(schedule.days_from_today) === 1 ? "" : "s"}
                  </span>
                ) : schedule?.is_past ? (
                  <span className="rounded-full bg-[#F1F5F9] border border-[#CBD5E1] px-2.5 py-0.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wide">
                    Historical / Archived Mission
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] leading-relaxed max-w-2xl text-[#475569]">
                {schedule?.advisory ||
                  "Review live METAR observation baseline for flight planning. Final tactical briefing mandatory within 2 hours of wheels-up."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* State A: Loading State */}
      {isLoading ? (
        <div className="py-14 flex flex-col items-center justify-center text-[#64748B] gap-3">
          <Icon icon="mdi:loading" className="w-7 h-7 animate-spin text-[#0077B6]" />
          <span className="text-xs font-semibold text-[#0F172A]">
            Retrieving aviation weather telemetry...
          </span>
          <span className="text-[11px] text-[#94A3B8]">
            Connecting to NOAA Aviation Weather Center network
          </span>
        </div>
      ) : stationEntries.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#64748B] bg-[#F8FAFC] border border-[#DCE4EC] rounded-lg p-6">
          <Icon icon="mdi:map-marker-question" className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
          <h4 className="font-semibold text-[#0F172A] text-sm">No Stations Selected</h4>
          <p className="mt-1 max-w-md mx-auto text-[#64748B]">
            Search for an airport above (e.g. Lagos, Kaduna, Abuja) or plot departure and destination points on the map.
          </p>
        </div>
      ) : (
        /* C. Weather Cards Display Grid */
        <div className="space-y-6">
          {/* Section 1: User-Searched & Monitored Airfields */}
          {searchedStationEntries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-[#EAF5FC] text-[#0077B6]">
                    <Icon icon="mdi:radar" className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0077B6]">
                    Searched Airfield Weather ({searchedStationEntries.length})
                  </h4>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  On-demand METAR & TAF observations
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                {searchedStationEntries.map((st) => {
                  const meta = getAirfieldMeta(st.icao);
                  return (
                    <StationWeatherCard
                      key={`searched-${st.icao}`}
                      station={st}
                      roleLabel={`Searched Airfield • ${meta ? meta.city : "Custom Lookup"}`}
                      onRetry={handleRefresh}
                      onRemove={() => handleRemoveStation(st.icao)}
                      onSetDeparture={
                        onSelectDepartureAirport && meta
                          ? () => onSelectDepartureAirport({ icao: meta.icao, name: meta.name, lat: meta.lat, lon: meta.lon })
                          : undefined
                      }
                      onSetArrival={
                        onSelectArrivalAirport && meta
                          ? () => onSelectArrivalAirport({ icao: meta.icao, name: meta.name, lat: meta.lat, lon: meta.lon })
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Mission Route Aerodromes (Departure & Destination) */}
          {(departureStationData || arrivalStationData || (!departureStationData && !arrivalStationData && searchedStationEntries.length === 0)) && (
            <div className="space-y-3">
              {(departureStationData || arrivalStationData) && searchedStationEntries.length > 0 && (
                <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
                  <span className="p-1 rounded bg-[#F1F5F9] text-[#475569]">
                    <Icon icon="mdi:routes" className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Flight Route Aerodromes
                  </h4>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                {/* Departure Airfield Card */}
                {departureStationData ? (
                  <StationWeatherCard
                    key={`dep-${departureStationData.icao}`}
                    station={departureStationData}
                    roleLabel="Departure Airfield"
                    onRetry={handleRefresh}
                  />
                ) : (
                  /* Fallback if no explicit departure station and not already in searched */
                  stationEntries[0] && !searchedStations.includes(stationEntries[0].icao) && (
                    <StationWeatherCard
                      key={`first-${stationEntries[0].icao}`}
                      station={stationEntries[0]}
                      roleLabel="Departure Airfield"
                      onRetry={handleRefresh}
                    />
                  )
                )}

                {/* Destination Airfield Card */}
                {arrivalStationData ? (
                  <StationWeatherCard
                    key={`arr-${arrivalStationData.icao}`}
                    station={arrivalStationData}
                    roleLabel="Destination Airfield"
                    onRetry={handleRefresh}
                  />
                ) : (
                  /* Fallback if no explicit arrival station and not already in searched */
                  stationEntries[1] && !searchedStations.includes(stationEntries[1].icao) && (
                    <StationWeatherCard
                      key={`sec-${stationEntries[1].icao}`}
                      station={stationEntries[1]}
                      roleLabel="Destination Airfield"
                      onRetry={handleRefresh}
                    />
                  )
                )}
              </div>
            </div>
          )}

          {/* Section 3: Other Enroute Stations (if any) */}
          {otherStations.length > 0 ? (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3 flex items-center gap-1.5">
                <Icon icon="mdi:routes" className="w-4 h-4 text-[#0077B6]" />
                <span>Enroute Weather Stations</span>
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {otherStations.map((st) => (
                  <StationWeatherCard
                    key={`other-${st.icao}`}
                    station={st}
                    roleLabel="Enroute Airfield"
                    onRetry={handleRefresh}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* E. Attribution & Operational Safety Disclaimer Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[#DCE4EC] text-[11px] text-[#64748B]">
        <span className="flex items-center gap-1">
          <Icon icon="mdi:shield-check-outline" className="w-3.5 h-3.5 text-[#0077B6]" />
          <span>Source: NOAA Aviation Weather Center (AWC) • WMO Aeronautical Telemetry</span>
        </span>
        <span className="italic text-[#475569]">
          Weather information is advisory. Verify current conditions through approved aviation weather briefing procedures before flight release.
        </span>
      </div>
    </div>
  );
};
