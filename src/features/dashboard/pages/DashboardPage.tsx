import { useMemo, useRef, useState } from "react";
import { GoogleMap, LoadScript } from "@react-google-maps/api";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useGetDashboardHomeQuery } from "@/features/dashboard/api";

type OperationStatus = "Planned" | "Completed" | "Ongoing" | "Aborted";
type OperationPriority = "Low" | "Medium" | "High";

type Operation = {
  id: string;
  name: string;
  unit: string;
  type: string;
  status: OperationStatus;
  date: string;
  time: string;
  priority: OperationPriority;
  location: {
    lat: number;
    lng: number;
  };
};

type ViewMode = "table" | "grid" | "map";
type TabKey = "operations" | "flightProgramme";

type FlightResource = {
  id: string;
  name: string;
  code: string;
  status: "Serviceable" | "Grounded";
  hours: number;
};

type FlightEvent = {
  id: string;
  resourceId: string;
  label: string;
  startHour: number;
  endHour: number;
  color: string;
};

const operations: Operation[] = [
  {
    id: "1",
    name: "OP Eagle Watch",
    unit: "661 NAA – Abuja Air Base",
    type: "Patrol",
    status: "Planned",
    date: "26 Jan 2026",
    time: "14:30 Z - 17:10 Z",
    priority: "High",
    location: { lat: 9.0765, lng: 7.3986 },
  },
  {
    id: "2",
    name: "OP SAFE AIR",
    unit: "662 NAA Bn – Kaduna",
    type: "Logistics",
    status: "Completed",
    date: "26 Jan 2026",
    time: "09:00 Z - 11:30 Z",
    priority: "Medium",
    location: { lat: 10.5167, lng: 7.4333 },
  },
  {
    id: "3",
    name: "OP ZAMAN LAFIYA",
    unit: "NA AVN Trg School – Ilorin",
    type: "Escort",
    status: "Ongoing",
    date: "26 Jan 2026",
    time: "16:00 Z - 18:00 Z",
    priority: "High",
    location: { lat: 8.5, lng: 4.55 },
  },
  {
    id: "4",
    name: "OP Eagle Watch",
    unit: "663 NAA Bn – Makurdi",
    type: "Reconnaissance",
    status: "Ongoing",
    date: "26 Jan 2026",
    time: "12:00 Z - 15:00 Z",
    priority: "Low",
    location: { lat: 7.7337, lng: 8.5361 },
  },
];

const flightResources: FlightResource[] = [
  {
    id: "r1",
    name: "BELL UH-1H",
    code: "NA010",
    status: "Serviceable",
    hours: 1239,
  },
  {
    id: "r2",
    name: "BELL UH-1H 003",
    code: "NA010",
    status: "Grounded",
    hours: 980,
  },
  {
    id: "r3",
    name: "BELL UH-1H",
    code: "NA010",
    status: "Serviceable",
    hours: 1450,
  },
];

const flightEvents: FlightEvent[] = [
  {
    id: "e1",
    resourceId: "r1",
    label: "Lt Ijeoma Anya / Capt Hassan",
    startHour: 6,
    endHour: 9,
    color: "#2ecc71",
  },
  {
    id: "e2",
    resourceId: "r2",
    label: "Lt Ijeoma Anya / Capt Hassan",
    startHour: 10,
    endHour: 13,
    color: "#f1c40f",
  },
];

const timelineHours = Array.from({ length: 13 }, (_, i) => 6 + i); // 06:00 - 18:00

const mapContainerStyle:
  | google.maps.MapOptions["styles"]
  | { width: string; height: string } = {
  width: "100%",
  height: "100%",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    {
      elementType: "geometry",
      stylers: [{ color: "#021019" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b8ca8" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#01070c" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#052333" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#052333" }],
    },
  ],
};

const statusDotColor: Record<OperationStatus, string> = {
  Planned: "bg-blue-400",
  Completed: "bg-emerald-400",
  Ongoing: "bg-amber-400",
  Aborted: "bg-red-500",
};

const priorityTextColor: Record<OperationPriority, string> = {
  Low: "text-emerald-400",
  Medium: "text-amber-300",
  High: "text-red-400",
};

const priorityDotColor: Record<OperationPriority, string> = {
  Low: "#2ecc71",
  Medium: "#f1c40f",
  High: "#ff4d4f",
};

type StatCardConfig = {
  id: string;
  label: string;
  value: string;
  icon: string;
};

const StatCard = ({ config }: { config: StatCardConfig }) => {
  return (
    <div className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {config.label}
        </p>
        <p className="text-2xl font-semibold text-white">{config.value}</p>
      </div>
      <div className="w-9 h-9 rounded bg-[#021a27] flex items-center justify-center">
        <Icon icon={config.icon} className="w-5 h-5 text-cyan-300" />
      </div>
    </div>
  );
};

export const DashboardPage = () => {
  const { data: homeData, isLoading: isHomeLoading } =
    useGetDashboardHomeQuery();

  const statCards: StatCardConfig[] = useMemo(() => {
    const formatNumber = (value: number | undefined) =>
      typeof value === "number" ? value.toLocaleString() : "—";

    const formatCurrency = (value: number | undefined) =>
      typeof value === "number" ? `₦${value.toLocaleString()}` : "₦—";

    return [
      {
        id: "aircraft",
        label: "Aircraft",
        value: formatNumber(homeData?.aircraft_count),
        icon: "mdi:airplane",
      },
      {
        id: "operations",
        label: "Operations",
        value: formatNumber(homeData?.operation_count),
        icon: "mdi:database",
      },
      {
        id: "personnel",
        label: "Personnel",
        value: formatNumber(homeData?.personnel_count),
        icon: "mdi:account-group",
      },
      {
        id: "inventory",
        label: "Inventory",
        value: formatNumber(homeData?.inventories_count),
        icon: "mdi:package-variant",
      },
      {
        id: "finances",
        label: "Finances",
        value: formatCurrency(homeData?.finances),
        icon: "mdi:home-city-outline",
      },
      {
        id: "users",
        label: "Users",
        value: formatNumber(homeData?.user_count),
        icon: "mdi:account-multiple",
      },
    ];
  }, [homeData]);

  const [activeTab, setActiveTab] = useState<TabKey>("operations");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const mapCenter = useMemo(
    () => ({
      lat: 9.0765,
      lng: 7.3986,
    }),
    [],
  );

  const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyBIweqHwa_afI3FuUFMcnc8A__SkwzSkiM") as string | undefined;
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as
    | string
    | undefined;

  const handleMapLoad = async (map: google.maps.Map) => {
    mapRef.current = map;

    const { AdvancedMarkerElement } = (await google.maps.importLibrary(
      "marker",
    )) as google.maps.MarkerLibrary;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    operations.forEach((op) => {
      const markerContent = document.createElement("div");
      markerContent.className =
        "inline-flex items-center gap-2 text-[11px] text-white";

      const dotColor = priorityDotColor[op.priority];

      markerContent.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-sm overflow-hidden bg-[#111827]"></div>
          <span class="font-medium whitespace-nowrap">${op.name}</span>
          <span
            class="ml-2 flex items-center justify-center rounded-full"
            style="
              width: 18px;
              height: 18px;
              border: 2px solid #000000;
              background-color: transparent;
            "
          >
            <span
              class="rounded-full"
              style="
                width: 10px;
                height: 10px;
                background-color: ${dotColor};
              "
            ></span>
          </span>
        </div>
      `;

      const marker = new AdvancedMarkerElement({
        map,
        position: op.location,
        title: op.name,
        content: markerContent,
      });

      const showInfo = () => {
        if (hoverTimeoutRef.current !== null) {
          window.clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        if (!infoWindowRef.current) {
          return;
        }

        const container = document.createElement("div");
        container.className =
          "bg-[#001219] text-white p-3 rounded-lg shadow-lg border border-[#0A4D66]/60 min-w-[220px]";
        container.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <p class="font-semibold text-sm">${op.name}</p>
            <span class="text-xs px-2 py-0.5 rounded-full border border-current ${priorityTextColor[op.priority]}">
              Priority: ${op.priority}
            </span>
          </div>
          <p class="text-xs text-gray-300 mb-1">${op.unit}</p>
          <p class="text-xs text-gray-400 mb-1">${op.date} • ${op.time}</p>
          <p class="text-xs flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${statusDotColor[op.status]}"></span>
            Status: ${op.status}
          </p>
        `;

        infoWindowRef.current.setContent(container);
        infoWindowRef.current.open({
          map,
          anchor: marker,
        });
      };

      const hideInfo = () => {
        if (!infoWindowRef.current) {
          return;
        }

        hoverTimeoutRef.current = window.setTimeout(() => {
          infoWindowRef.current?.close();
        }, 150);
      };

      markerContent.addEventListener("mouseenter", showInfo);
      markerContent.addEventListener("mouseleave", hideInfo);

      markersRef.current.push(marker);
    });
  };

  const renderOperationsContent = () => {
    if (viewMode === "map") {
      if (!googleMapsApiKey) {
        return (
          <div className="h-[320px] md:h-[420px] flex items-center justify-center text-gray-400">
            Configure VITE_GOOGLE_MAPS_API_KEY to view the operations map.
          </div>
        );
      }

      return (
        <div className="h-[320px] md:h-[420px] rounded-xl overflow-hidden border border-[#0A4D66]/40 bg-[#001219]">
          <LoadScript
            googleMapsApiKey={googleMapsApiKey}
            libraries={["marker"]}
          >
            <GoogleMap
              mapContainerStyle={
                mapContainerStyle as { width: string; height: string }
              }
              center={mapCenter}
              zoom={6}
              options={
                googleMapsMapId
                  ? { ...mapOptions, mapId: googleMapsMapId }
                  : mapOptions
              }
              onLoad={handleMapLoad}
            />
          </LoadScript>
        </div>
      );
    }

    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {operations.map((op) => (
            <div
              key={op.id}
              className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-400">{op.unit}</p>
                  <p className="text-base font-semibold text-white">
                    {op.name}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border",
                    priorityTextColor[op.priority],
                    "border-current",
                  )}
                >
                  {op.priority} Priority
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      statusDotColor[op.status],
                    )}
                  />
                  <span>{op.status}</span>
                </div>
                <span>
                  {op.date} • {op.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
              <tr>
                <th className="text-left px-6 py-3 font-medium">Unit</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Time</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-right px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, idx) => (
                <tr
                  key={op.id}
                  className={cn(
                    "border-t border-[#0A4D66]/40",
                    idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                  )}
                >
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-white">{op.unit}</span>
                      <span className="text-xs text-gray-400">{op.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{op.type}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-200">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          statusDotColor[op.status],
                        )}
                      />
                      {op.status}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{op.date}</td>
                  <td className="px-4 py-3 text-gray-200">{op.time}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        priorityTextColor[op.priority],
                      )}
                    >
                      {op.priority}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button className="inline-flex items-center justify-center rounded-full h-8 w-8 hover:bg-[#0A4D66]/40 text-gray-400 hover:text-white transition-colors">
                      <Icon icon="mdi:dots-vertical" className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderFlightProgrammeContent = () => {
    return (
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#0A4D66]/40 max-h-72 md:max-h-none overflow-y-auto">
          <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-gray-400">
              Aircraft List
            </p>
          </div>
          <div className="divide-y divide-[#0A4D66]/30">
            {flightResources.map((res) => (
              <div key={res.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
                  <Icon icon="mdi:airplane" className="w-5 h-5 text-cyan-300" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white">{res.name}</p>
                  <p className="text-[11px] text-gray-400">{res.code}</p>
                  <p className="text-[11px] text-gray-400 flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        res.status === "Serviceable"
                          ? "bg-emerald-400"
                          : "bg-red-500",
                      )}
                    />
                    {res.status} • {res.hours.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-gray-400">
                Tue, April 30, 2026
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <button className="px-2 py-1 rounded border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30">
                  Day
                </button>
                <button className="px-2 py-1 rounded border border-transparent text-gray-500">
                  Week
                </button>
              </div>
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `80px repeat(${timelineHours.length}, 1fr)`,
              }}
            >
              <div className="bg-[#021a27] border-b border-[#0A4D66]/40" />
              {timelineHours.map((h) => (
                <div
                  key={h}
                  className="bg-[#021a27] border-b border-l border-[#0A4D66]/40 text-[11px] text-gray-400 flex items-center justify-center"
                >
                  {h.toString().padStart(2, "0")}:00
                </div>
              ))}

              {flightResources.map((res) => (
                <div key={res.id} className="contents">
                  <div className="border-b border-[#0A4D66]/40 bg-[#001219] px-3 py-2 text-xs text-gray-300">
                    {res.code}
                  </div>
                  {timelineHours.map((h) => (
                    <div
                      key={`${res.id}-${h}`}
                      className="border-b border-l border-[#0A4D66]/40 bg-[#001219]"
                    />
                  ))}

                  {flightEvents
                    .filter((ev) => ev.resourceId === res.id)
                    .map((ev) => {
                      const startIndex = timelineHours.indexOf(ev.startHour);
                      const endIndex = timelineHours.indexOf(ev.endHour);
                      if (
                        startIndex === -1 ||
                        endIndex === -1 ||
                        endIndex <= startIndex
                      ) {
                        return null;
                      }
                      const colStart = startIndex + 2;
                      const colEnd = endIndex + 2;
                      return (
                        <div
                          key={ev.id}
                          className="row-start-auto h-8 mt-1 flex items-center"
                          style={{
                            gridColumnStart: colStart,
                            gridColumnEnd: colEnd,
                          }}
                        >
                          <div
                            className="h-full rounded text-[11px] px-3 flex items-center text-[#021019] font-medium overflow-hidden whitespace-nowrap text-ellipsis"
                            style={{ backgroundColor: ev.color }}
                          >
                            {ev.label}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="space-y-6 min-h-screen -m-6 p-6"
      style={{
        background:
          "linear-gradient(335.25deg, #00090D 9.91%, #002A36 50.24%, #063F4B 89.79%)",
      }}
    >
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {isHomeLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="bg-[#001219] p-4 rounded-xl border border-[#0A4D66]/40 flex items-center justify-between"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-20 bg-[#021a27] rounded-full animate-pulse" />
                  <div className="h-6 w-16 bg-[#021a27] rounded-full animate-pulse" />
                </div>
                <div className="w-9 h-9 rounded bg-[#021a27] animate-pulse" />
              </div>
            ))
          : statCards.map((card) => <StatCard key={card.id} config={card} />)}
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between px-4 pt-4 gap-3">
          <div className="flex items-center gap-2">
            <button
              className={cn(
                "px-4 py-2 text-xs font-medium rounded-t-md md:rounded-md border-b-2 md:border border-transparent",
                activeTab === "operations"
                  ? "border-[#7FD5FF] text-white bg-[#021a27]"
                  : "text-gray-400 hover:text-white hover:bg-[#021a27]",
              )}
              onClick={() => setActiveTab("operations")}
            >
              Operations
            </button>
            <button
              className={cn(
                "px-4 py-2 text-xs font-medium rounded-t-md md:rounded-md border-b-2 md:border border-transparent",
                activeTab === "flightProgramme"
                  ? "border-[#7FD5FF] text-white bg-[#021a27]"
                  : "text-gray-400 hover:text-white hover:bg-[#021a27]",
              )}
              onClick={() => setActiveTab("flightProgramme")}
            >
              Flight Programme
            </button>
          </div>

          {activeTab === "operations" && (
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <div className="hidden sm:flex items-center gap-1 bg-[#021a27] rounded-md border border-[#0A4D66]/40 p-1">
                <button
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded",
                    viewMode === "table"
                      ? "bg-[#0A4D66]"
                      : "hover:bg-[#0A4D66]/40",
                  )}
                  onClick={() => setViewMode("table")}
                >
                  <Icon icon="mdi:view-list-outline" className="w-4 h-4" />
                </button>
                <button
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded",
                    viewMode === "grid"
                      ? "bg-[#0A4D66]"
                      : "hover:bg-[#0A4D66]/40",
                  )}
                  onClick={() => setViewMode("grid")}
                >
                  <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
                </button>
                <button
                  className={cn(
                    "h-7 w-7 flex items-center justify-center rounded",
                    viewMode === "map"
                      ? "bg-[#0A4D66]"
                      : "hover:bg-[#0A4D66]/40",
                  )}
                  onClick={() => setViewMode("map")}
                >
                  <Icon icon="mdi:map" className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] whitespace-nowrap">
                  12
                </button>
                <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] whitespace-nowrap">
                  All Units
                </button>
                <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] whitespace-nowrap">
                  All Priority
                </button>
                <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] whitespace-nowrap">
                  All Operations
                </button>
                <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] whitespace-nowrap">
                  Today
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-3">
          {activeTab === "operations"
            ? renderOperationsContent()
            : renderFlightProgrammeContent()}
        </div>
      </section>
    </div>
  );
};
