import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";

// Dummy data for the unit details
const UNIT_DETAILS = {
  id: 1,
  name: "HQ NA AVN COMMAND- ABUJA",
  commander: "Wing Cmdr Bello",
  overview: {
    aircraft: 32,
    operations: 32,
    flightProgramme: 32,
    personnel: 32,
    inventory: 32,
    finances: 52001090,
    users: 32,
  },
  inventory: {
    total: 354,
    lowStock: 32,
    expired: 32,
    critical: 32,
  },
  weather: {
    temperature: 31,
    densityAltitude: 31, // High Density Altitude
    crosswind: "RW19",
    crosswindSpeed: "12KT",
    visibility: "8KM",
    ceiling: "2,500 ft",
    qnh: "QNH", // Altimeter Setting
    humidity: "82%", // Moderate
  },
};

type Card = {
  label: string;
  value: string | number;
  icon?: string;
  bgClass?: string;
  textColor?: string;
  subText?: string;
  alert?: boolean;
};

const CardItem = ({ card }: { card: Card }) => (
  <div
    className={cn(
      "rounded-lg border border-[#0A4D66]/40 p-4 flex items-center justify-between",
      card.bgClass || "bg-[#001219]",
    )}
  >
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">
        {card.label}
      </p>
      <p className={cn("text-2xl font-semibold mt-1", card.textColor || "text-white")}>
        {card.value}
      </p>
      {card.subText && (
        <p className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1">
           {card.alert && <Icon icon="mdi:alert" className="w-3 h-3" />}
           {card.subText}
        </p>
      )}
    </div>
    {card.icon && (
      <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
        <Icon icon={card.icon} className="w-5 h-5 text-cyan-300" />
      </div>
    )}
  </div>
);

export const UnitsDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  // In a real app, we would fetch data using the ID
  const unit = { ...UNIT_DETAILS, id: Number(id) };

  const formatCurrency = (val: number) => `₦${val.toLocaleString()}`;

  const overviewCards: Card[] = [
    { label: "AIRCRAFT", value: unit.overview.aircraft, icon: "mdi:helicopter" },
    { label: "OPERATIONS", value: unit.overview.operations, icon: "mdi:database" },
    { label: "FLIGHT PROGRAMME", value: unit.overview.flightProgramme, icon: "mdi:calendar" },
    { label: "PERSONNEL", value: unit.overview.personnel, icon: "mdi:account-hard-hat" },
    { label: "INVENTORY", value: unit.overview.inventory, icon: "mdi:package-variant" },
    { label: "FINANCES", value: formatCurrency(unit.overview.finances), icon: "mdi:cash" },
    { label: "USERS", value: unit.overview.users, icon: "mdi:account-group" },
  ];

  const inventoryCards: Card[] = [
    { label: "TOTAL IN STOCK", value: unit.inventory.total, bgClass: "bg-green-900/20 border-green-800/50", icon: "mdi:package-variant-closed", textColor: "text-white" },
    { label: "LOW STOCK ITEMS", value: unit.inventory.lowStock, bgClass: "bg-yellow-900/20 border-yellow-800/50", icon: "mdi:clipboard-alert", textColor: "text-white" },
    { label: "EXPIRED ITEMS", value: unit.inventory.expired, bgClass: "bg-red-900/20 border-red-800/50", icon: "mdi:alert-octagon", textColor: "text-white" },
    { label: "CRITICAL", value: unit.inventory.critical, bgClass: "bg-orange-900/20 border-orange-800/50", icon: "mdi:calendar-clock", textColor: "text-white" },
  ];

  return (
    <div className="px-2 sm:px-0 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          <span>Back</span>
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-white uppercase tracking-wide">
            {unit.name}
          </h1>
          <div className="flex gap-2">
             <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs">
                <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
                Delete
             </button>
             <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0A4D66] text-white hover:bg-[#0A4D66]/80 text-xs">
                <Icon icon="mdi:pencil" className="w-4 h-4" />
                Edit
             </button>
             <button className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#001219] text-gray-300 border border-[#0A4D66]/40 hover:bg-[#001825] text-xs">
                <Icon icon="mdi:download" className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg flex items-center gap-2">
            <span className="text-cyan-400 font-medium">Commander:</span>
            <span className="text-white font-bold text-lg">{unit.commander}</span>
        </div>
      </div>

      {/* Overview Section */}
      <section>
        <h2 className="text-xs font-bold tracking-wide text-gray-400 mb-3 uppercase">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {overviewCards.map((card, i) => (
            <CardItem key={i} card={card} />
          ))}
        </div>
      </section>

      {/* Inventory Section */}
      <section>
        <h2 className="text-xs font-bold tracking-wide text-gray-400 mb-3 uppercase">Inventory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {inventoryCards.map((card, i) => (
            <CardItem key={i} card={card} />
          ))}
        </div>
      </section>

      {/* Weather Overview Section */}
      <section>
        <h2 className="text-xs font-bold tracking-wide text-gray-400 mb-3 uppercase">Weather Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">31°C</p>
                <p className="text-xs text-white mt-1">Temperature</p>
                <p className="text-[10px] text-yellow-400 mt-1">1,870 ft</p>
            </div>
             <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">31°C</p>
                <p className="text-xs text-white mt-1">High Density</p>
                <p className="text-xs text-white">Altitude</p>
            </div>
             <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-xs text-white">Crosswind</p>
                <p className="text-lg font-bold text-white mt-1">RW19</p>
                <p className="text-[10px] text-yellow-400 mt-1">12KT</p>
            </div>
            <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">8KM</p>
                <p className="text-xs text-white mt-1">Good Visibility</p>
            </div>
             <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">2,500 ft</p>
                <p className="text-xs text-white mt-1">Low Ceiling</p>
                 <p className="text-[10px] text-yellow-400 mt-1 flex items-center justify-center gap-1">
                    <Icon icon="mdi:alert" className="w-3 h-3" /> Watch
                </p>
            </div>
             <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">QNH</p>
                <p className="text-xs text-white mt-1">Altimeter</p>
                <p className="text-xs text-white">Setting</p>
            </div>
             <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">82%</p>
                <p className="text-xs text-white mt-1">Moderate</p>
                 <p className="text-[10px] text-yellow-400 mt-1 flex items-center justify-center gap-1">
                    <Icon icon="mdi:alert" className="w-3 h-3" /> Watch
                </p>
            </div>
        </div>
      </section>
    </div>
  );
};
