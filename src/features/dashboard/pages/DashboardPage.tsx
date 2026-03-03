import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useGetOperationsQuery } from "@/features/operations/api";
import {
  useGetPersonnelQuery,
  type PersonnelFilters,
} from "@/features/personnel/api";
import { useGetFinanceDashboardQuery } from "@/features/finance/api";
import { useGetInventoryDashboardQuery } from "@/features/inventory/api";
import { useGetAssetsQuery } from "@/features/assets/api";

type Card = {
  label: string;
  value: string | number;
  icon?: string;
  bgClass?: string;
};

const CardItem = ({ card, onClick }: { card: Card; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left rounded-lg border border-[#0A4D66]/40 p-4 flex items-center justify-between transition-colors ${card.bgClass || "bg-[#001219]"} ${onClick ? "cursor-pointer hover:bg-[#001825] hover:border-[#7FD5FF]/40" : ""}`}
  >
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">
        {card.label}
      </p>
      <p className="text-2xl font-semibold text-white">{card.value}</p>
    </div>
    {card.icon && (
      <div className="w-9 h-9 rounded bg-[#021a27] flex items-center justify-center">
        <Icon icon={card.icon} className="w-5 h-5 text-cyan-300" />
      </div>
    )}
  </button>
);

const Section = ({
  title,
  cards,
  onNavigate,
}: {
  title: string;
  cards: Card[];
  onNavigate?: () => void;
}) => (
  <section className="space-y-3">
    <button
      type="button"
      onClick={onNavigate}
      className={`text-left text-xs font-bold tracking-wide ${onNavigate ? "text-gray-200 hover:text-white" : "text-gray-300"}`}
    >
      {title}
    </button>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <CardItem key={`${title}-${i}`} card={c} onClick={onNavigate} />
      ))}
    </div>
  </section>
);

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { data: operations = [] } = useGetOperationsQuery();
  const { data: finance } = useGetFinanceDashboardQuery();
  const { data: inventory } = useGetInventoryDashboardQuery();
  const { data: assets = [] } = useGetAssetsQuery();

  const defaultFilters: PersonnelFilters = {
    branches: [],
    units: [],
    ranks: [],
    corps: [],
    specialties: [],
    status: [],
  };
  const { data: personnel = [] } = useGetPersonnelQuery(defaultFilters);

  const opStats = useMemo(() => {
    return {
      planned: operations.filter((o) => o.status === "planned").length,
      completed: operations.filter((o) => o.status === "completed").length,
      ongoing: operations.filter((o) => o.status === "active").length,
      aborted: operations.filter((o) => o.status === "aborted").length,
    };
  }, [operations]);

  const personnelStats = useMemo(() => {
    const normalize = (s: string) => s?.toLowerCase?.() || "";
    const active = personnel.filter(
      (p) => normalize(p.status) === "active",
    ).length;
    const grounded = personnel.filter(
      (p) => normalize(p.status) === "grounded",
    ).length;
    const medical = personnel.filter(
      (p) => normalize(p.status) === "medical",
    ).length;
    return { total: personnel.length, active, grounded, medical };
  }, [personnel]);

  const aircraftStats = useMemo(() => {
    const aircrafts = assets.filter((a) => a.type === "aircraft");
    const serviceable = aircrafts.filter(
      (a) => a.serviceability_status === "serviceable",
    ).length;
    const underMaintenance = aircrafts.filter(
      (a) => a.serviceability_status === "under_maintenance",
    ).length;
    const grounded = aircrafts.filter(
      (a) => a.serviceability_status === "grounded",
    ).length;
    return {
      total: aircrafts.length,
      serviceable,
      underMaintenance,
      grounded,
    };
  }, [assets]);

  const financeCards: Card[] = useMemo(() => {
    const total = finance?.total_expense ?? 0;
    const monthly = finance?.current_month_expense ?? 0;
    const quarterly = finance?.current_quarter_expense ?? 0;
    const budget = finance?.budget ?? 0;
    const used = finance?.sum_amount ?? total;
    const pct =
      budget > 0 ? Math.round((used / budget) * 1000) / 10 : undefined;
    return [
      {
        label: "Total Expense",
        value: `₦${total.toLocaleString()}`,
        icon: "mdi:cash-fast",
      },
      {
        label: "Monthly",
        value: `₦${monthly.toLocaleString()}`,
        icon: "mdi:calendar-month",
      },
      {
        label: "Quarterly",
        value: `₦${quarterly.toLocaleString()}`,
        icon: "mdi:calendar-range",
      },
      {
        label: "Budget",
        value: `₦${budget.toLocaleString()}${pct !== undefined ? `  ${pct}%` : ""}`,
        icon: "mdi:account-cash",
      },
    ];
  }, [finance]);

  const inventoryCards: Card[] = useMemo(() => {
    return [
      {
        label: "Total In Stock",
        value: inventory?.total_stock ?? 0,
        icon: "mdi:warehouse",
      },
      {
        label: "Low Stock Items",
        value: inventory?.low_stock ?? 0,
        icon: "mdi:alert",
      },
      {
        label: "Expired Items",
        value: inventory?.expired_items ?? 0,
        icon: "mdi:alert-octagon",
      },
      {
        label: "Critical",
        value: inventory?.critical_stock ?? 0,
        icon: "mdi:alert-decagram",
      },
    ];
  }, [inventory]);

  const operationsCards: Card[] = [
    { label: "Planned", value: opStats.planned, icon: "mdi:database" },
    {
      label: "Completed",
      value: opStats.completed,
      icon: "mdi:database-check",
    },
    { label: "Ongoing", value: opStats.ongoing, icon: "mdi:database-sync" },
    { label: "Aborted", value: opStats.aborted, icon: "mdi:database-off" },
  ];

  const personnelCards: Card[] = [
    { label: "Total", value: personnelStats.total, icon: "mdi:account-group" },
    {
      label: "Active",
      value: personnelStats.active,
      icon: "mdi:account-check",
    },
    { label: "Medical", value: personnelStats.medical, icon: "mdi:hospital" },
    { label: "Grounded", value: personnelStats.grounded, icon: "mdi:alert" },
  ];

  const aircraftCards: Card[] = [
    { label: "Total", value: aircraftStats.total, icon: "mdi:airplane" },
    {
      label: "Serviceable",
      value: aircraftStats.serviceable,
      icon: "mdi:airplane-check",
    },
    {
      label: "Under Maintenance",
      value: aircraftStats.underMaintenance,
      icon: "mdi:toolbox",
    },
    {
      label: "Grounded",
      value: aircraftStats.grounded,
      icon: "mdi:airplane-off",
    },
  ];

  const weatherCards: Card[] = [
    { label: "Temperature", value: "31°C", icon: "mdi:thermometer" },
    {
      label: "High Density Altitude",
      value: "31°C • 1,870 ft",
      icon: "mdi:chart-line",
    },
    { label: "Crosswind RW19", value: "12KT", icon: "mdi:weather-windy" },
    { label: "Visibility", value: "8KM", icon: "mdi:eye" },
    {
      label: "Ceiling",
      value: "2,500 ft • Watch",
      icon: "mdi:weather-cloudy-alert",
    },
    { label: "QNH", value: "Watch", icon: "mdi:gauge" },
    { label: "Humidity", value: "82% • Moderate", icon: "mdi:water-percent" },
  ];

  return (
    <div className="space-y-6">
      <Section
        title="OPERATIONS"
        cards={operationsCards}
        onNavigate={() => navigate("/dashboard/operations")}
      />
      <Section
        title="PERSONNEL"
        cards={personnelCards}
        onNavigate={() => navigate("/dashboard/personnel")}
      />
      <Section
        title="FINANCES"
        cards={financeCards}
        onNavigate={() => navigate("/dashboard/finance")}
      />
      <Section
        title="AIRCRAFT"
        cards={aircraftCards}
        onNavigate={() => navigate("/dashboard/assets")}
      />
      <Section
        title="INVENTORY"
        cards={inventoryCards}
        onNavigate={() => navigate("/dashboard/inventory")}
      />
      <Section
        title="WEATHER OVERVIEW"
        cards={weatherCards}
        onNavigate={() => navigate("/dashboard/weather")}
      />
    </div>
  );
};
