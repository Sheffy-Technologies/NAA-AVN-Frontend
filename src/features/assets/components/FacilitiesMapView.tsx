import { useMemo, useRef, useState } from "react";
import { GoogleMap, LoadScript } from "@react-google-maps/api";
import type { Facility } from "../api";

type MapProvider = "google" | "qgis";

type FacilitiesMapViewProps = {
  facilities: Facility[];
  onSelectFacility?: (id: number) => void;
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

const cefoBounds = {
  south: 7.51775,
  west: 5.469,
  north: 13.106,
  east: 14.181,
};

export const FacilitiesMapView = ({
  facilities,
  onSelectFacility,
}: FacilitiesMapViewProps) => {
  const [mapProvider, setMapProvider] = useState<MapProvider>("qgis");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
    | string
    | undefined;
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as
    | string
    | undefined;

  const locatedFacilities = useMemo(
    () =>
      facilities.filter(
        (f) =>
          f.latitude != null &&
          f.longitude != null &&
          !Number.isNaN(Number(f.latitude)) &&
          !Number.isNaN(Number(f.longitude)),
      ),
    [facilities],
  );

  const mapCenter = useMemo(() => {
    if (locatedFacilities.length > 0) {
      const avgLat =
        locatedFacilities.reduce((sum, f) => sum + Number(f.latitude), 0) /
        locatedFacilities.length;
      const avgLng =
        locatedFacilities.reduce((sum, f) => sum + Number(f.longitude), 0) /
        locatedFacilities.length;
      return { lat: avgLat, lng: avgLng };
    }
    return {
      lat: (cefoBounds.south + cefoBounds.north) / 2,
      lng: (cefoBounds.west + cefoBounds.east) / 2,
    };
  }, [locatedFacilities]);

  const handleMapLoad = async (map: google.maps.Map) => {
    mapRef.current = map;
    const { AdvancedMarkerElement } = (await google.maps.importLibrary(
      "marker",
    )) as google.maps.MarkerLibrary;

    markersRef.current.forEach((m) => {
      m.map = null;
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

    locatedFacilities.forEach((facility) => {
      const position = {
        lat: Number(facility.latitude),
        lng: Number(facility.longitude),
      };

      const markerContent = document.createElement("div");
      markerContent.className =
        "inline-flex items-center gap-2 text-[11px] text-white";
      markerContent.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded-sm overflow-hidden bg-[#0369A1] flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
          <span class="font-medium whitespace-nowrap">${facility.name}</span>
        </div>
      `;

      const marker = new AdvancedMarkerElement({
        map,
        position,
        title: facility.name,
        content: markerContent,
      });

      const showInfo = () => {
        if (!infoWindowRef.current) return;
        const container = document.createElement("div");
        container.className =
          "bg-[#001219] text-white p-3 rounded-lg shadow-lg border border-[#0A4D66]/60 min-w-[200px]";
        container.innerHTML = `
          <p class="font-semibold text-sm mb-1">${facility.name}</p>
          ${facility.description ? `<p class="text-xs text-gray-300 mb-2">${facility.description}</p>` : ""}
          <p class="text-xs text-gray-400">Lat: ${Number(facility.latitude).toFixed(4)}, Lng: ${Number(facility.longitude).toFixed(4)}</p>
        `;
        infoWindowRef.current.setContent(container);
        infoWindowRef.current.open({ map, anchor: marker });
      };

      markerContent.addEventListener("mouseenter", showInfo);
      markerContent.addEventListener("mouseleave", () => {
        setTimeout(() => infoWindowRef.current?.close(), 150);
      });

      if (onSelectFacility) {
        markerContent.addEventListener("click", () =>
          onSelectFacility(facility.id),
        );
        markerContent.style.cursor = "pointer";
      }

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
            Configure VITE_GOOGLE_MAPS_API_KEY to view the facilities map.
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
          title="QGIS Facilities Map"
          src="/map/index.html"
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      {mapProvider === "google" && locatedFacilities.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-gray-400 text-sm">
            No facilities have coordinates set.
          </p>
        </div>
      )}
    </div>
  );
};
