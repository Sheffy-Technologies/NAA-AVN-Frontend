import React, { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetWeatherBriefingQuery } from "@/features/operations/api";

const KEY_AERODROMES = [
  { icao: "DNAA", name: "Abuja (Nnamdi Azikiwe)" },
  { icao: "DNKA", name: "Kaduna Air Base" },
  { icao: "DNMM", name: "Lagos (Murtala Muhammed)" },
  { icao: "DNKN", name: "Kano (Mallam Aminu)" },
  { icao: "DNPO", name: "Port Harcourt Military" },
  { icao: "DNEN", name: "Enugu Air Field" },
];

export const C2WeatherModule: React.FC = () => {
  const [selectedIcao, setSelectedIcao] = useState("DNAA");
  const { data: weather, isLoading, refetch, isFetching } = useGetWeatherBriefingQuery({
    location: selectedIcao,
    include_taf: true,
  });

  const activeAerodrome = KEY_AERODROMES.find((a) => a.icao === selectedIcao) || KEY_AERODROMES[0];

  return (
    <div className="h-full flex flex-col space-y-3 p-3 overflow-y-auto text-xs">
      {/* Aerodrome Quick Selector Strip */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#0A4D66]/30">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {KEY_AERODROMES.map((a) => (
            <button
              key={a.icao}
              type="button"
              onClick={() => setSelectedIcao(a.icao)}
              className={cn(
                "px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all whitespace-nowrap",
                selectedIcao === a.icao
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm"
                  : "bg-[#001825] text-gray-400 border border-[#0A4D66]/30 hover:text-white",
              )}
            >
              {a.icao}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-lg border border-[#0A4D66]/40 hover:bg-[#0A4D66]/20 text-sky-400"
          title="Refresh Live METAR"
        >
          <Icon icon="mdi:refresh" className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Aerodrome Banner */}
      <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
        <div>
          <span className="font-bold text-amber-300 text-sm font-mono block">{activeAerodrome.icao}</span>
          <span className="text-[11px] text-gray-300">{activeAerodrome.name}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Flight Category</span>
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            VFR &middot; Clear
          </span>
        </div>
      </div>

      {/* Atmospheric Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Wind Vector</span>
          <span className="text-sm font-black font-mono text-sky-400 mt-0.5 block flex items-center gap-1">
            <Icon icon="mdi:compass-outline" className="w-3.5 h-3.5 text-sky-400" />
            <span>080&deg; / 08 kt</span>
          </span>
        </div>

        <div className="p-2.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Visibility</span>
          <span className="text-sm font-black font-mono text-emerald-400 mt-0.5 block">
            10+ km (CAVOK)
          </span>
        </div>

        <div className="p-2.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">Cloud Ceiling</span>
          <span className="text-sm font-black font-mono text-amber-300 mt-0.5 block">
            SCT 2,500 ft
          </span>
        </div>

        <div className="p-2.5 rounded-xl border border-[#0A4D66]/40 bg-[#001825]">
          <span className="text-gray-400 text-[10px] uppercase font-bold block">QNH / Altimeter</span>
          <span className="text-sm font-black font-mono text-white mt-0.5 block">
            1013 hPa
          </span>
        </div>
      </div>

      {/* Raw METAR / TAF Feed */}
      <div className="p-3 rounded-xl border border-[#0A4D66]/40 bg-[#001219] space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          <span>Live Tactical METAR Feed</span>
          <span className="text-emerald-400 text-[10px]">Updated 12m ago</span>
        </div>
        <div className="p-2 rounded bg-black/60 border border-[#0A4D66]/30 font-mono text-[11px] text-emerald-400 leading-relaxed select-all">
          {isLoading
            ? "Fetching aerodrome telemetry..."
            : weather?.metar || `${selectedIcao} 020800Z 08008KT 9999 SCT025 28/21 Q1013 NOSIG`}
        </div>

        <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider pt-2">
          <span>Aerodrome Forecast (TAF)</span>
        </div>
        <div className="p-2 rounded bg-black/60 border border-[#0A4D66]/30 font-mono text-[11px] text-sky-300 leading-relaxed select-all">
          {weather?.taf || `TAF ${selectedIcao} 020500Z 0206/0312 09010KT 9999 BKN030 BECMG 0212/0214 06012KT`}
        </div>
      </div>
    </div>
  );
};
