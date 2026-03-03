import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, LoadScript } from "@react-google-maps/api";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useGetOperationsQuery } from "../api";

type ViewMode = "table" | "grid" | "map" | "schedule";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#021019" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b8ca8" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#01070c" }] },
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

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  completed: "bg-emerald-400",
  active: "bg-amber-400",
  aborted: "bg-red-500",
};

const priorityTextColor: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-300",
  high: "text-red-400",
};

const priorityDotColor: Record<string, string> = {
  low: "#2ecc71",
  medium: "#f1c40f",
  high: "#ff4d4f",
};

export const OperationsPage = () => {
  const navigate = useNavigate();
  const { data: operations = [], isLoading } = useGetOperationsQuery();
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyBIweqHwa_afI3FuUFMcnc8A__SkwzSkiM") as string | undefined;
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as
    | string
    | undefined;

  const stats = useMemo(() => {
    return {
      planned: operations.filter((op) => op.status === "planned").length,
      completed: operations.filter((op) => op.status === "completed").length,
      ongoing: operations.filter((op) => op.status === "active").length,
      aborted: operations.filter((op) => op.status === "aborted").length,
    };
  }, [operations]);

  const mapCenter = useMemo(() => ({ lat: 9.0765, lng: 7.3986 }), []);

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
      if (!op.location) return;

      const markerContent = document.createElement("div");
      markerContent.className =
        "inline-flex items-center gap-2 text-[11px] text-white";
      const dotColor = priorityDotColor[op.priority] || "#fff";

      markerContent.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-sm overflow-hidden bg-[#111827]"></div>
          <span class="font-medium whitespace-nowrap">${op.name}</span>
          <span class="ml-2 flex items-center justify-center rounded-full" style="width: 18px; height: 18px; border: 2px solid #000000; background-color: transparent;">
            <span class="rounded-full" style="width: 10px; height: 10px; background-color: ${dotColor};"></span>
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

        if (!infoWindowRef.current) return;

        const container = document.createElement("div");
        container.className =
          "bg-[#001219] text-white p-3 rounded-lg shadow-lg border border-[#0A4D66]/60 min-w-[220px]";
        container.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <p class="font-semibold text-sm">${op.name}</p>
            <span class="text-xs px-2 py-0.5 rounded-full border border-current ${priorityTextColor[op.priority] || "text-gray-400"}">
              Priority: ${op.priority}
            </span>
          </div>
          <p class="text-xs text-gray-300 mb-1">${op.unit.name}</p>
          <p class="text-xs text-gray-400 mb-1">${new Date(op.start_date_time).toLocaleDateString()} • ${new Date(op.start_date_time).toLocaleTimeString()}</p>
          <p class="text-xs flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${statusDotColor[op.status] || "bg-gray-400"}"></span>
            Status: ${op.status}
          </p>
        `;

        infoWindowRef.current.setContent(container);
        infoWindowRef.current.open({ map, anchor: marker });
      };

      const hideInfo = () => {
        if (!infoWindowRef.current) return;
        hoverTimeoutRef.current = window.setTimeout(() => {
          infoWindowRef.current?.close();
        }, 150);
      };

      markerContent.addEventListener("mouseenter", showInfo);
      markerContent.addEventListener("mouseleave", hideInfo);
      markerContent.addEventListener("click", () => navigate(String(op.id)));
      markerContent.style.cursor = "pointer";
      markersRef.current.push(marker);
    });
  };

  const renderMapView = () => {
    if (!googleMapsApiKey) {
      return (
        <div className="h-[600px] flex items-center justify-center text-gray-400 border border-[#0A4D66]/40 rounded-xl bg-[#001219]">
          Configure VITE_GOOGLE_MAPS_API_KEY to view the operations map.
        </div>
      );
    }
    return (
      <div className="h-[600px] rounded-xl overflow-hidden border border-[#0A4D66]/40 bg-[#001219]">
        <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={["marker"]}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
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
  };

  const renderScheduleView = () => {
    const timelineHours = Array.from({ length: 13 }, (_, i) => 6 + i); // 06:00 - 18:00

    return (
      <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#0A4D66]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:calendar-today" className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-white">
              TUE, APRIL 30, 2026
            </span>
            <div className="flex gap-1 ml-4">
              <button className="p-1 rounded hover:bg-[#0A4D66]/40 text-gray-400">
                <Icon icon="mdi:chevron-left" className="w-5 h-5" />
              </button>
              <button className="p-1 rounded hover:bg-[#0A4D66]/40 text-gray-400">
                <Icon icon="mdi:chevron-right" className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] flex-1 ml-4 text-center text-xs text-gray-400 font-medium">
            {timelineHours.map((h) => (
              <div key={h}>{h.toString().padStart(2, "0")}:00</div>
            ))}
          </div>
        </div>

        {/* Placeholder Schedule Content */}
        <div className="min-h-[400px] relative">
          <div className="absolute inset-0 grid grid-cols-[repeat(13,minmax(0,1fr))] ml-[200px] pointer-events-none">
            {timelineHours.map((h) => (
              <div
                key={h}
                className="border-l border-[#0A4D66]/20 h-full"
              ></div>
            ))}
          </div>

          <div className="divide-y divide-[#0A4D66]/30">
            {operations.map((op) => (
              <div
                key={op.id}
                className="flex h-16 group hover:bg-[#0A4D66]/10 relative"
              >
                <div className="w-[200px] flex-shrink-0 p-3 border-r border-[#0A4D66]/40 bg-[#001219] z-10">
                  <p className="text-sm font-medium text-white truncate">
                    {op.unit.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{op.name}</p>
                </div>
                {/* Simplified timeline bar */}
                <div className="flex-1 relative">
                  {/* Position bar based on time (mock logic) */}
                  <div
                    className={cn(
                      "absolute top-3 bottom-3 rounded px-2 flex items-center text-xs font-medium text-black truncate",
                      op.status === "completed"
                        ? "bg-emerald-400"
                        : op.status === "planned"
                          ? "bg-blue-400"
                          : op.status === "aborted"
                            ? "bg-red-400"
                            : "bg-amber-400",
                    )}
                    style={{
                      left: `${Math.random() * 60}%`,
                      width: `${20 + Math.random() * 20}%`,
                    }}
                  >
                    {op.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => (
    <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-gray-200">
          <thead className="bg-[#021a27] text-gray-400 uppercase text-xs">
            <tr>
              <th className="text-left px-6 py-3 font-medium">Purpose</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Departure</th>
              <th className="text-left px-4 py-3 font-medium">Destination</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op, idx) => (
              <tr
                key={op.id}
                onClick={() => navigate(String(op.id))}
                className={cn(
                  "border-t border-[#0A4D66]/40 cursor-pointer hover:bg-[#0A4D66]/20 transition-colors",
                  idx % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                )}
              >
                <td className="px-6 py-3 font-medium text-white">
                  {op.description}
                </td>
                <td className="px-4 py-3 text-gray-200">{op.name}</td>
                <td className="px-4 py-3 text-gray-200">{op.unit.name}</td>
                <td className="px-4 py-3 text-gray-200">{op.unit.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusDotColor[op.status] || "bg-gray-400",
                      )}
                    />
                    <span className="capitalize">{op.status}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-right">
                  <button className="text-gray-400 hover:text-white">
                    <Icon icon="mdi:dots-horizontal" className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {operations.map((op) => (
        <div
          key={op.id}
          onClick={() => navigate(String(op.id))}
          className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-[#7FD5FF]/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{op.unit.name}</p>
              <p className="text-base font-semibold text-white">{op.name}</p>
            </div>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border border-current",
                priorityTextColor[op.priority],
              )}
            >
              {op.priority}
            </span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-2">{op.description}</p>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-2 border-t border-[#0A4D66]/20">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  statusDotColor[op.status] || "bg-gray-400",
                )}
              />
              <span className="capitalize">{op.status}</span>
            </div>
            <span>{new Date(op.start_date_time).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#021019] text-gray-200">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white tracking-wide">
            OPERATIONS
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search"
                className="bg-[#001219] border border-[#0A4D66]/40 rounded text-sm pl-9 pr-3 py-1.5 focus:outline-none focus:border-cyan-500/50 w-64"
              />
            </div>
            <div className="flex gap-2">
              <button className="relative p-2 text-gray-400 hover:text-white">
                <Icon icon="mdi:bell" className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#001219] p-3 rounded-lg border border-[#0A4D66]/40">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>{" "}
              Planned:{" "}
              <span className="font-bold text-white">{stats.planned}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>{" "}
              Completed:{" "}
              <span className="font-bold text-white">{stats.completed}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>{" "}
              Ongoing:{" "}
              <span className="font-bold text-white">{stats.ongoing}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Aborted:{" "}
              <span className="font-bold text-white">{stats.aborted}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#021a27] rounded-md p-1 flex border border-[#0A4D66]/40">
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "map"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:map" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("schedule")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "schedule"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:calendar-month" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "table"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:table" className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-[#0A4D66] text-white"
                    : "text-gray-400 hover:text-white",
                )}
              >
                <Icon icon="mdi:view-grid" className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-[#0A4D66]/40 mx-1"></div>

            <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 flex items-center gap-1">
              All Units <Icon icon="mdi:chevron-down" className="w-4 h-4" />
            </button>
            <button className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 flex items-center gap-1">
              All Priority <Icon icon="mdi:chevron-down" className="w-4 h-4" />
            </button>

            <button className="p-1.5 text-gray-400 hover:text-white">
              <Icon icon="mdi:download" className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/dashboard/operations/add")}
              className="bg-[#7FD5FF] text-black text-xs font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#7FD5FF]/90 transition-colors"
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              ADD OPERATION
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2" />{" "}
            Loading operations...
          </div>
        ) : (
          <>
            {viewMode === "map" && renderMapView()}
            {viewMode === "schedule" && renderScheduleView()}
            {viewMode === "table" && renderTableView()}
            {viewMode === "grid" && renderGridView()}
          </>
        )}
      </div>
    </div>
  );
};
