import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import {
  NIGERIA_AERONAUTICAL_DATABASE,
  type AeronauticalPoint,
  type AeronauticalPointType,
} from "../utils/navigationEngine";

interface AeronauticalDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPoint: (point: AeronauticalPoint) => void;
  title?: string;
  filterType?: AeronauticalPointType;
}

export const AeronauticalDatabaseModal = ({
  isOpen,
  onClose,
  onSelectPoint,
  title = "Select Nigerian Aeronautical Fix",
  filterType,
}: AeronauticalDatabaseModalProps) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(filterType || "all");

  const filteredPoints = useMemo(() => {
    return NIGERIA_AERONAUTICAL_DATABASE.filter((pt) => {
      // Category filter
      if (selectedCategory !== "all" && pt.type !== selectedCategory) {
        return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        pt.ident.toLowerCase().includes(q) ||
        pt.name.toLowerCase().includes(q) ||
        (pt.notes && pt.notes.toLowerCase().includes(q)) ||
        (pt.frequency && pt.frequency.toLowerCase().includes(q))
      );
    });
  }, [search, selectedCategory]);

  if (!isOpen) return null;

  const getTypeBadge = (type: AeronauticalPointType) => {
    switch (type) {
      case "military_base":
        return { label: "Military Base", color: "bg-red-500/20 text-red-400 border-red-500/40" };
      case "airport":
        return { label: "AIP Airport", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" };
      case "fob":
        return { label: "Tactical FOB", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" };
      case "vor":
        return { label: "VOR / DME", color: "bg-purple-500/20 text-purple-400 border-purple-500/40" };
      case "tactical_lz":
        return { label: "Tactical LZ", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" };
      default:
        return { label: "Waypoint", color: "bg-gray-500/20 text-gray-400 border-gray-500/40" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-[#0A4D66]/60 bg-[#001219] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#0A4D66]/40 px-6 py-4 bg-[#001825]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#0A4D66]/30 text-[#7FD5FF]">
              <Icon icon="mdi:radar" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h3>
              <p className="text-xs text-gray-400">Nigerian Military &amp; AIP Aeronautical Database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-[#0A4D66]/30 bg-[#001219] space-y-3">
          <div className="relative">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ICAO ident, name, frequency or tactical base..."
              className="w-full pl-10 pr-4 py-2 bg-[#001825] border border-[#0A4D66]/40 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#7FD5FF]"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: "all", label: "All Fixes" },
              { id: "military_base", label: "Air Force Bases" },
              { id: "airport", label: "Civilian / Joint Airports" },
              { id: "fob", label: "FOB Outposts" },
              { id: "vor", label: "VOR / Navaids" },
              { id: "tactical_lz", label: "Tactical LZs" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-[#0369A1] text-white"
                    : "bg-[#001825] text-gray-400 hover:text-gray-200 border border-[#0A4D66]/40"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-[#0A4D66]/20">
          {filteredPoints.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No aeronautical fixes found matching &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filteredPoints.map((point) => {
              const badge = getTypeBadge(point.type);
              return (
                <div
                  key={point.id}
                  onClick={() => {
                    onSelectPoint(point);
                    onClose();
                  }}
                  className="pt-2 first:pt-0 group flex items-center justify-between p-3 rounded-xl hover:bg-[#001825] cursor-pointer transition-all border border-transparent hover:border-[#0A4D66]/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#7FD5FF] group-hover:text-white transition-colors">
                        {point.ident}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      {point.elevationFt && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          Elev {point.elevationFt} ft
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-300 font-medium">{point.name}</div>
                    {point.notes && (
                      <div className="text-[11px] text-gray-500 line-clamp-1">{point.notes}</div>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-mono text-xs text-gray-300">
                      {point.latitude.toFixed(4)}°, {point.longitude.toFixed(4)}°
                    </div>
                    {point.frequency && (
                      <div className="font-mono text-[11px] text-[#F59E0B] font-semibold">
                        {point.frequency}
                      </div>
                    )}
                    <span className="inline-block text-[10px] text-[#7FD5FF] underline opacity-0 group-hover:opacity-100 transition-opacity">
                      Select Fix &rarr;
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#0A4D66]/40 p-3 bg-[#001825] text-center text-[11px] text-gray-500">
          Official Nigerian Aeronautical Information Publication (AIP) &bull; Standard Datum WGS-84
        </div>
      </div>
    </div>
  );
};
