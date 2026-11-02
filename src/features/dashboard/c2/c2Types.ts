export type C2ModuleKey =
  | "flight_ops"
  | "weather"
  | "maintenance"
  | "logistics"
  | "mission_planning"
  | "command_directives";

export type C2GridLayout = "split_2" | "tri_3" | "quad_4" | "matrix_6";

export type C2PanelConfig = {
  id: string;
  moduleKey: C2ModuleKey;
  isMaximized?: boolean;
};

export const C2_MODULE_META: Record<
  C2ModuleKey,
  { label: string; shortLabel: string; icon: string; accentColor: string; description: string }
> = {
  flight_ops: {
    label: "A. Flight Operations Tracking",
    shortLabel: "Flight Ops",
    icon: "mdi:airplane-takeoff",
    accentColor: "text-sky-400 border-sky-500/40 bg-sky-500/10",
    description: "Aircraft positions, flight status, routes, ETAs, and mission progress",
  },
  weather: {
    label: "B. Weather Monitoring & Intel",
    shortLabel: "Weather",
    icon: "mdi:weather-partly-cloudy",
    accentColor: "text-amber-400 border-amber-500/40 bg-amber-500/10",
    description: "METAR, TAF, wind vectors, cloud ceilings, radar, and severe weather alerts",
  },
  maintenance: {
    label: "C. Aircraft Maintenance Status",
    shortLabel: "Maintenance",
    icon: "mdi:wrench-clock",
    accentColor: "text-rose-400 border-rose-500/40 bg-rose-500/10",
    description: "Fleet serviceability, AOG alerts, open defects, and overhaul due horizons",
  },
  logistics: {
    label: "D. Logistics & Spares Inventory",
    shortLabel: "Logistics",
    icon: "mdi:package-variant-closed",
    accentColor: "text-teal-400 border-teal-500/40 bg-teal-500/10",
    description: "Serviceable parts, unserviceable spares holding, AWB shipment tracking",
  },
  mission_planning: {
    label: "E. Mission Planning & Execution",
    shortLabel: "Missions",
    icon: "mdi:target-variant",
    accentColor: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
    description: "Scheduled sorties, airframe tasking, crew readiness, and sortie status",
  },
  command_directives: {
    label: "F. Command Directives & Approvals",
    shortLabel: "Directives",
    icon: "mdi:bullhorn-outline",
    accentColor: "text-purple-400 border-purple-500/40 bg-purple-500/10",
    description: "Operational directives, pending approvals, urgent memos, priority notices",
  },
};

