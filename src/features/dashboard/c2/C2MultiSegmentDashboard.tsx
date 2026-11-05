import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { type C2ModuleKey, type C2GridLayout, C2_MODULE_META } from "./c2Types";

import { C2FlightOpsModule } from "./modules/C2FlightOpsModule";
import { C2WeatherModule } from "./modules/C2WeatherModule";
import { C2MaintenanceModule } from "./modules/C2MaintenanceModule";
import { C2LogisticsModule } from "./modules/C2LogisticsModule";
import { C2MissionModule } from "./modules/C2MissionModule";
import { C2DirectivesModule } from "./modules/C2DirectivesModule";

type PanelConfig = {
  id: string;
  moduleKey: C2ModuleKey;
};

const DEFAULT_PANELS_BY_LAYOUT: Record<C2GridLayout, PanelConfig[]> = {
  split_2: [
    { id: "panel_1", moduleKey: "flight_ops" },
    { id: "panel_2", moduleKey: "maintenance" },
  ],
  tri_3: [
    { id: "panel_1", moduleKey: "flight_ops" },
    { id: "panel_2", moduleKey: "weather" },
    { id: "panel_3", moduleKey: "maintenance" },
  ],
  quad_4: [
    { id: "panel_1", moduleKey: "flight_ops" },
    { id: "panel_2", moduleKey: "weather" },
    { id: "panel_3", moduleKey: "maintenance" },
    { id: "panel_4", moduleKey: "logistics" },
  ],
  matrix_6: [
    { id: "panel_1", moduleKey: "flight_ops" },
    { id: "panel_2", moduleKey: "weather" },
    { id: "panel_3", moduleKey: "maintenance" },
    { id: "panel_4", moduleKey: "logistics" },
    { id: "panel_5", moduleKey: "mission_planning" },
    { id: "panel_6", moduleKey: "command_directives" },
  ],
};

export const C2MultiSegmentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [layout, setLayout] = useState<C2GridLayout>("quad_4");
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS_BY_LAYOUT.quad_4);
  const [maximizedPanelId, setMaximizedPanelId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live clocks
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update panels whenever layout changes (unless custom customized)
  const handleSelectLayout = (newLayout: C2GridLayout) => {
    setLayout(newLayout);
    setMaximizedPanelId(null);
    setPanels(DEFAULT_PANELS_BY_LAYOUT[newLayout]);
  };

  const handleChangeModule = (panelId: string, newModuleKey: C2ModuleKey) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === panelId ? { ...p, moduleKey: newModuleKey } : p))
    );
  };

  const handleToggleMaximize = (panelId: string) => {
    setMaximizedPanelId((prev) => (prev === panelId ? null : panelId));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const zuluTimeStr = currentTime.toUTCString().slice(17, 25) + " Z";
  const localTimeStr =
    currentTime.toLocaleTimeString("en-GB", { hour12: false }) + " WAT";
  const dateStr = currentTime
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  // Render Module Component
  const renderModuleContent = (moduleKey: C2ModuleKey) => {
    switch (moduleKey) {
      case "flight_ops":
        return <C2FlightOpsModule />;
      case "weather":
        return <C2WeatherModule />;
      case "maintenance":
        return <C2MaintenanceModule />;
      case "logistics":
        return <C2LogisticsModule />;
      case "mission_planning":
        return <C2MissionModule />;
      case "command_directives":
        return <C2DirectivesModule />;
      default:
        return null;
    }
  };

  // Determine grid container classes based on current layout
  const getGridClasses = () => {
    if (maximizedPanelId) return "grid grid-cols-1 grid-rows-1";

    switch (layout) {
      case "split_2":
        return "grid grid-cols-1 lg:grid-cols-2 gap-3";
      case "tri_3":
        return "grid grid-cols-1 lg:grid-cols-3 gap-3";
      case "quad_4":
        return "grid grid-cols-1 lg:grid-cols-2 grid-rows-2 gap-3";
      case "matrix_6":
        return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3";
      default:
        return "grid grid-cols-2 gap-3";
    }
  };

  const activePanelsToRender = maximizedPanelId
    ? panels.filter((p) => p.id === maximizedPanelId)
    : panels;

  return (
    <div
      data-c2-dashboard="true"
      className="flex flex-col h-[calc(100vh-6rem)] w-full bg-[#00101A] text-slate-100 rounded-2xl overflow-hidden border border-[#0A4D66]/60 shadow-2xl c2-dark-scope"
    >
      {/* Top Command Bar */}
      <header className="flex-shrink-0 px-4 py-2.5 bg-[#001825] border-b border-[#0A4D66]/80 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Left: Branding & Clocks */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Icon icon="mdi:shield-airplane" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-wide text-white uppercase">
                  NA AVN Command C2
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                  FEED: LIVE
                </span>
              </div>
              <span className="text-[10px] text-gray-400">Multi-Segment Operations Display</span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#0A4D66]/50 hidden sm:block" />

          {/* Tactical Clocks */}
          <div className="hidden md:flex items-center gap-3 font-mono text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00101A] border border-[#0A4D66]/50">
              <span className="text-[10px] font-bold text-sky-400">ZULU:</span>
              <span className="font-bold text-white tracking-widest">{zuluTimeStr}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#00101A] border border-[#0A4D66]/50">
              <span className="text-[10px] font-bold text-emerald-400">LOCAL:</span>
              <span className="font-bold text-white tracking-widest">{localTimeStr}</span>
            </div>
            <span className="text-gray-400 text-[11px] font-semibold">{dateStr}</span>
          </div>
        </div>

        {/* Right: Layout Pickers & Controls */}
        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-[#00101A] p-1 rounded-xl border border-[#0A4D66]/60">
            <button
              type="button"
              onClick={() => handleSelectLayout("split_2")}
              title="2-Panel Split (Dual Segment)"
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                layout === "split_2" && !maximizedPanelId
                  ? "bg-sky-500/30 text-sky-300 border border-sky-500/60 shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Icon icon="mdi:view-column-outline" className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">2-Split</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectLayout("tri_3")}
              title="3-Panel Display (Tri Segment)"
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                layout === "tri_3" && !maximizedPanelId
                  ? "bg-sky-500/30 text-sky-300 border border-sky-500/60 shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Icon icon="mdi:view-dashboard-variant-outline" className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">3-Tri</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectLayout("quad_4")}
              title="4-Panel Quad Display (Command Standard)"
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                layout === "quad_4" && !maximizedPanelId
                  ? "bg-sky-500/30 text-sky-300 border border-sky-500/60 shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Icon icon="mdi:view-grid-outline" className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">4-Quad</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectLayout("matrix_6")}
              title="6-Panel Operations Matrix (All Modules)"
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                layout === "matrix_6" && !maximizedPanelId
                  ? "bg-sky-500/30 text-sky-300 border border-sky-500/60 shadow-sm"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Icon icon="mdi:grid-large" className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">6-Matrix</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Kiosk / Fullscreen Mode"}
            className="p-2 rounded-xl bg-[#00101A] border border-[#0A4D66]/60 text-gray-300 hover:text-white hover:bg-[#0A4D66]/30 transition-all"
          >
            <Icon icon={isFullscreen ? "mdi:fullscreen-exit" : "mdi:fullscreen"} className="w-4 h-4" />
          </button>

          {/* Back to Standard Dashboard */}
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            title="Return to Standard Command View"
            className="px-3 py-1.5 rounded-xl bg-[#00101A] border border-[#0A4D66]/60 text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#0A4D66]/30 transition-all flex items-center gap-1.5"
          >
            <Icon icon="mdi:arrow-left" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit C2</span>
          </button>
        </div>
      </header>

      {/* Main Panels Grid Container */}
      <main className="flex-1 p-3 overflow-hidden">
        <div className={cn("h-full w-full", getGridClasses())}>
          {activePanelsToRender.map((panel, idx) => {
            const meta = C2_MODULE_META[panel.moduleKey];
            const isMaximized = maximizedPanelId === panel.id;

            return (
              <div
                key={panel.id}
                className={cn(
                  "flex flex-col bg-[#001420] rounded-xl border border-[#0A4D66]/70 shadow-lg overflow-hidden transition-all duration-200",
                  isMaximized ? "h-full w-full" : "h-full min-h-[220px]"
                )}
              >
                {/* Panel Header */}
                <div className="flex-shrink-0 px-3 py-2 bg-[#001A29] border-b border-[#0A4D66]/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-gray-400 font-bold">
                      [P{idx + 1}]
                    </span>
                    <Icon icon={meta.icon} className={cn("w-4 h-4 flex-shrink-0", meta.accentColor.split(" ")[0])} />
                    <span className="font-bold text-xs text-white truncate">{meta.label}</span>
                  </div>

                  {/* Panel Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Module Switcher Dropdown */}
                    <div className="relative">
                      <select
                        aria-label="Select panel display module"
                        value={panel.moduleKey}
                        onChange={(e) => handleChangeModule(panel.id, e.target.value as C2ModuleKey)}
                        className="bg-[#00101A] text-gray-300 border border-[#0A4D66]/60 rounded-lg text-[10px] py-1 px-1.5 focus:outline-none focus:border-sky-400 cursor-pointer"
                      >
                        <option value="flight_ops">A. Flight Operations</option>
                        <option value="weather">B. Weather Monitoring</option>
                        <option value="maintenance">C. Aircraft Maintenance</option>
                        <option value="logistics">D. Logistics &amp; Inventory</option>
                        <option value="mission_planning">E. Mission Planning</option>
                        <option value="command_directives">F. Command Directives</option>
                      </select>
                    </div>

                    {/* Maximize / Restore Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleMaximize(panel.id)}
                      title={isMaximized ? "Restore Panel Size" : "Maximize Panel to Full Display"}
                      className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#0A4D66]/40 transition-all"
                    >
                      <Icon
                        icon={isMaximized ? "mdi:window-restore" : "mdi:window-maximize"}
                        className="w-3.5 h-3.5"
                      />
                    </button>
                  </div>
                </div>

                {/* Panel Content Body */}
                <div className="flex-1 overflow-hidden relative">
                  {renderModuleContent(panel.moduleKey)}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Bottom Command Status Bar */}
      <footer className="flex-shrink-0 px-4 py-1.5 bg-[#001825] border-t border-[#0A4D66]/80 flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold text-emerald-400">C2 OPSROOM ACTIVE</span>
          </div>
          <span>&middot;</span>
          <span>AIR DEFENSE &amp; SURVEILLANCE GRID</span>
          <span className="hidden sm:inline">&middot;</span>
          <span className="hidden sm:inline font-mono">HQ NA AVN GIRI BARRACKS</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span>LAYOUT: {layout.toUpperCase().replace("_", " ")}</span>
          {maximizedPanelId && <span className="text-amber-400 font-bold">[PANEL MAXIMIZED]</span>}
        </div>
      </footer>
    </div>
  );
};
export default C2MultiSegmentDashboard;

