import { useState } from "react";
import { Icon } from "@iconify/react";
import {
  useGetWeatherBriefingQuery,
  type WeatherStationData,
} from "../api";

type WeatherBriefingProps = {
  departureLat?: number | string | null;
  departureLon?: number | string | null;
  arrivalLat?: number | string | null;
  arrivalLon?: number | string | null;
  stations?: string;
  flightDate?: string | null;
  flightTime?: string | null;
  className?: string;
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
}: {
  station: WeatherStationData;
  roleLabel?: string;
  onRetry?: () => void;
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
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {roleLabel ? (
                <span className="rounded bg-[#EAF5FC] border border-[#BAE6FD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0077B6]">
                  {roleLabel}
                </span>
              ) : null}
              <span className="text-lg font-bold text-[#0F172A] tracking-tight">
                {station.icao}
              </span>
              <span className="text-xs font-semibold text-[#475569] truncate max-w-xs">
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

          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.bg}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </span>
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
    </div>
  );
};

export const WeatherBriefingCard = ({
  departureLat,
  departureLon,
  arrivalLat,
  arrivalLon,
  stations,
  flightDate,
  flightTime,
  className = "",
}: WeatherBriefingProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const depLatNum = departureLat ? Number(departureLat) : undefined;
  const depLonNum = departureLon ? Number(departureLon) : undefined;
  const arrLatNum = arrivalLat ? Number(arrivalLat) : undefined;
  const arrLonNum = arrivalLon ? Number(arrivalLon) : undefined;

  const { data, isLoading, isFetching, refetch } = useGetWeatherBriefingQuery(
    {
      departure_lat: depLatNum,
      departure_lon: depLonNum,
      arrival_lat: arrLatNum,
      arrival_lon: arrLonNum,
      stations,
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

  const stationsMap = data?.stations || {};
  const stationEntries = Object.values(stationsMap);
  const schedule = data?.flight_schedule;
  const lastUpdated = data?.last_updated || (data?.fetched_at ? new Date(data.fetched_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);

  // Identify departure and arrival station objects
  const departureIcao = data?.departure_station;
  const arrivalIcao = data?.arrival_station;

  const departureStationData = departureIcao ? stationsMap[departureIcao] : null;
  const arrivalStationData = arrivalIcao ? stationsMap[arrivalIcao] : null;

  // Other enroute stations (if any)
  const otherStations = stationEntries.filter(
    (st) => st.icao !== departureIcao && st.icao !== arrivalIcao
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
            Current airport observations and available aviation forecasts for the selected flight route.
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
            Retrieving weather information...
          </span>
          <span className="text-[11px] text-[#94A3B8]">
            Connecting to NOAA Aviation Weather Center telemetry
          </span>
        </div>
      ) : stationEntries.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#64748B] bg-[#F8FAFC] border border-[#DCE4EC] rounded-lg p-6">
          <Icon icon="mdi:map-marker-question" className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
          <h4 className="font-semibold text-[#0F172A] text-sm">No Stations Selected</h4>
          <p className="mt-1 max-w-md mx-auto text-[#64748B]">
            Specify departure and destination coordinates on the map or enter airfield ICAO identifiers to retrieve pre-flight weather.
          </p>
        </div>
      ) : (
        /* B. Airport Cards Grid (2 Cards Side by Side on Desktop) */
        <div className="space-y-4">
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
              /* Fallback if first entry */
              stationEntries[0] && (
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
              /* Fallback if second entry */
              stationEntries[1] && (
                <StationWeatherCard
                  key={`sec-${stationEntries[1].icao}`}
                  station={stationEntries[1]}
                  roleLabel="Destination Airfield"
                  onRetry={handleRefresh}
                />
              )
            )}
          </div>

          {/* Enroute / Waypoint Stations (if more than 2) */}
          {otherStations.length > 0 ? (
            <div className="pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-3 flex items-center gap-1.5">
                <Icon icon="mdi:routes" className="w-4 h-4 text-[#0077B6]" />
                <span>Enroute Waypoint Weather Stations</span>
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
