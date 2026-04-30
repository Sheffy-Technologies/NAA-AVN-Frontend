import { useMemo, useRef, useState } from "react";
import { GoogleMap, LoadScript } from "@react-google-maps/api";
import type { Operation } from "../api";

type MapProvider = "google" | "qgis";

type OperationsMapViewProps = {
  operations: Operation[];
  onSelectOperation: (id: number) => void;
};

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#001219" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b8ca8" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#01070c" }] },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#001219" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#001219" }],
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

const cefoBounds = {
  south: 7.51775,
  west: 5.469,
  north: 13.106,
  east: 14.181,
};

export const OperationsMapView = ({
  operations,
  onSelectOperation,
}: OperationsMapViewProps) => {
  const [mapProvider, setMapProvider] = useState<MapProvider>("qgis");

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined;
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as
    | string
    | undefined;

  const mapCenter = useMemo(
    () => ({
      lat: (cefoBounds.south + cefoBounds.north) / 2,
      lng: (cefoBounds.west + cefoBounds.east) / 2,
    }),
    [],
  );

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

    map.fitBounds({
      south: cefoBounds.south,
      west: cefoBounds.west,
      north: cefoBounds.north,
      east: cefoBounds.east,
    });

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
      markerContent.addEventListener("click", () => onSelectOperation(op.id));
      markerContent.style.cursor = "pointer";
      markersRef.current.push(marker);
    });
  };

  return (
    <div className="h-[600px] rounded-xl overflow-hidden border border-[#0A4D66]/40 bg-[#001219] relative">
      <div className="absolute top-3 right-3 z-10">
        <select
          value={mapProvider}
          onChange={(e) => setMapProvider(e.target.value as MapProvider)}
          aria-label="Map provider"
          className="px-3 py-1.5 rounded border border-[#0A4D66]/60 bg-[#001219] text-xs text-gray-200 focus:outline-none"
        >
          <option value="qgis">QGIS Map</option>
          <option value="google">Google Map</option>
        </select>
      </div>

      {mapProvider === "google" ? (
        !googleMapsApiKey ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            Configure VITE_GOOGLE_MAPS_API_KEY to view the operations map.
          </div>
        ) : (
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
        )
      ) : (
        <iframe
          title="QGIS Operations Map"
          src="/map/index.html"
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
};
