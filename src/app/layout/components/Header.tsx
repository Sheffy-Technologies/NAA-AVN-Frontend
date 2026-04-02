import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  type EmergencyLowStockInventoryItem,
  useGetEmergencySummaryQuery,
} from "@/features/emergencies/api";
import { useGetNotificationsQuery } from "@/features/notifications/api";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

type HeaderProps = {
  onOpenSidebar?: () => void;
};

export const Header = ({ onOpenSidebar }: HeaderProps) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [isEmergenciesOpen, setIsEmergenciesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const emergenciesRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { data: emergencySummary = {}, isLoading: isEmergenciesLoading } =
    useGetEmergencySummaryQuery(undefined, {
      skip: !isEmergenciesOpen,
    });
  const { data: notifications = [], isLoading: isNotificationsLoading } =
    useGetNotificationsQuery(undefined, {
      skip: !isNotificationsOpen,
    });

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  const dateTimeLabel = useMemo(() => {
    const datePart = now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const timePart = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });

    return `${datePart} | ${timePart}`;
  }, [now]);

  const notificationItems = useMemo(() => {
    return notifications.map((notification) => {
      const message =
        notification.description ||
        notification.message ||
        notification.body ||
        notification.title ||
        "-";

      const dateLabel = notification.date
        ? notification.date
        : notification.created_at
          ? new Date(notification.created_at).toLocaleDateString("en-US")
          : "-";

      return {
        id: notification.id,
        message,
        dateLabel,
      };
    });
  }, [notifications]);

  const referenceDate = useMemo(() => {
    if (!emergencySummary.reference_date) return "-";
    const parsed = new Date(emergencySummary.reference_date);
    if (Number.isNaN(parsed.getTime())) return emergencySummary.reference_date;
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [emergencySummary.reference_date]);

  const lowStockItems = emergencySummary.low_stock_inventories?.data ?? [];
  const emergencyBadgeCount =
    (emergencySummary.assets_due_for_inspection?.count ?? 0) +
    (emergencySummary.low_stock_inventories?.count ?? 0);

  const formatInventoryLabel = (item: EmergencyLowStockInventoryItem) => {
    const primary = item.part_number || item.serial_number || `Inventory #${item.id}`;
    const type = item.type ? item.type.replace(/_/g, " ") : "inventory";
    return `${primary} (${type})`;
  };

  useClickOutside(
    emergenciesRef,
    () => setIsEmergenciesOpen(false),
    isEmergenciesOpen,
  );

  useClickOutside(
    notificationsRef,
    () => setIsNotificationsOpen(false),
    isNotificationsOpen,
  );

  return (
    <header className="h-16 bg-[#001219] border-b border-[#0A4D66]/30 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Mobile menu + Date/Time */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden p-2 rounded-full hover:bg-[#0A4D66]/30 text-gray-300"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Icon icon="mdi:menu" className="w-5 h-5" />
        </button>
        <div className="text-gray-400 text-xs sm:text-sm font-medium truncate">
          {dateTimeLabel}
        </div>
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Icon
            icon="mdi:magnify"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5"
          />
          <input
            type="text"
            placeholder="Search"
            className="bg-[#00090D] border border-[#0A4D66]/50 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FD5FF] w-52 md:w-64 transition-colors"
          />
        </div>

        {/* Icons */}
        <div className="flex items-center gap-2 text-gray-400">
          <div className="relative" ref={emergenciesRef}>
            <button
              className="p-2 hover:bg-[#0A4D66]/30 rounded-full transition-colors relative"
              onClick={() => setIsEmergenciesOpen((current) => !current)}
              type="button"
              aria-label="Emergencies"
              title="Emergencies"
            >
              <Icon
                icon="material-symbols:e911-emergency-outline"
                className="w-5 h-5"
              />
              {emergencyBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-semibold">
                  {emergencyBadgeCount > 99 ? "99+" : emergencyBadgeCount}
                </span>
              )}
            </button>

            {isEmergenciesOpen && (
              <div className="absolute right-0 top-14 z-50 w-96 max-w-[calc(100vw-2rem)] bg-[#001D2B] border border-[#0A4D66]/40 shadow-[0_25px_80px_rgba(0,0,0,0.55)] rounded-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#0A4D66]/30">
                  <h3 className="text-white text-2xl font-bold uppercase">
                    Emergencies
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEmergenciesOpen(false)}
                    className="w-7 h-7 rounded-full bg-[#B7E6FF] text-[#00263A] flex items-center justify-center hover:opacity-90"
                    aria-label="Close emergencies"
                    title="Close emergencies"
                  >
                    <Icon icon="mdi:close" className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-2 max-h-105 overflow-y-auto">
                  {isEmergenciesLoading ? (
                    <div className="py-8 text-center text-gray-300">
                      Loading emergency summary...
                    </div>
                  ) : !emergencySummary.reference_date &&
                    !emergencySummary.assets_due_for_inspection &&
                    !emergencySummary.low_stock_inventories ? (
                    <div className="py-8 text-center text-gray-300">
                      No emergency summary found
                    </div>
                  ) : (
                    <>
                      <div className="py-4 border-b border-[#0A4D66]/50">
                        <p className="text-xs uppercase tracking-wider text-gray-400">
                          Reference Date
                        </p>
                        <p className="text-white text-sm mt-1">{referenceDate}</p>
                      </div>

                      <div className="py-4 border-b border-[#0A4D66]/50">
                        <p className="text-xs uppercase tracking-wider text-gray-400">
                          Assets Due For Inspection
                        </p>
                        <p className="text-[#7FD5FF] text-base font-semibold mt-1">
                          {emergencySummary.assets_due_for_inspection?.count ?? 0}
                        </p>
                      </div>

                      <div className="py-4 border-b border-[#0A4D66]/50">
                        <p className="text-xs uppercase tracking-wider text-gray-400">
                          Low Stock Inventories
                        </p>
                        <p className="text-[#7FD5FF] text-base font-semibold mt-1">
                          {emergencySummary.low_stock_inventories?.count ?? 0}
                        </p>
                      </div>

                      {lowStockItems.length > 0 && (
                        <div className="py-3">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                            Low Stock Items
                          </p>
                          {lowStockItems.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 border-b border-[#0A4D66]/40 last:border-b-0"
                            >
                              <div>
                                <p className="text-white text-sm leading-6">
                                  {formatInventoryLabel(item)}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  Unit: {item.unit?.name || "-"}
                                </p>
                              </div>
                              <div className="text-right whitespace-nowrap">
                                <p className="text-[#FFB3B3] text-sm font-semibold">
                                  {item.current_stock ?? 0} / {item.re_order_level ?? 0}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  {item.stock_level || "Low"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={notificationsRef}>
            <button
              className="p-2 hover:bg-[#0A4D66]/30 rounded-full transition-colors relative"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              aria-label="View notifications"
              title="View notifications"
              type="button"
            >
              <Icon icon="mdi:bell-outline" className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 top-14 z-50 w-115 max-w-[calc(100vw-2rem)] bg-[#001D2B] border border-[#0A4D66]/40 shadow-[0_25px_80px_rgba(0,0,0,0.55)] rounded-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#0A4D66]/30">
                  <h3 className="text-white text-2xl font-bold uppercase">
                    Notification
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="w-7 h-7 rounded-full bg-[#B7E6FF] text-[#00263A] flex items-center justify-center hover:opacity-90"
                    aria-label="Close notifications"
                    title="Close notifications"
                  >
                    <Icon icon="mdi:close" className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-2 max-h-105 overflow-y-auto">
                  {isNotificationsLoading ? (
                    <div className="py-8 text-center text-gray-300">
                      Loading notifications...
                    </div>
                  ) : notificationItems.length === 0 ? (
                    <div className="py-8 text-center text-gray-300">
                      No notifications found
                    </div>
                  ) : (
                    notificationItems.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[18px_minmax(0,1fr)_110px] gap-4 py-4 border-b border-[#0A4D66]/50 last:border-b-0"
                      >
                        <div className="w-3 h-3 bg-[#0A4D66] mt-1.5" />
                        <p className="text-white text-sm leading-7">
                          {item.message}
                        </p>
                        <div className="text-right text-white text-sm font-semibold whitespace-nowrap">
                          {item.dateLabel}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            className="p-2 hover:bg-[#0A4D66]/30 rounded-full transition-colors relative"
            type="button"
            aria-label="Profile"
            title="Profile"
            onClick={() => navigate("/dashboard/users")}
          >
            <Icon icon="mdi:account-circle-outline" className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
  );
};
