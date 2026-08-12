import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import {
  type EmergencyAssetInspectionItem,
  type EmergencyLowStockInventoryItem,
  useGetEmergencySummaryQuery,
} from "@/features/emergencies/api";
import {
  type NavigationTarget,
  useGetNotificationsQuery,
} from "@/features/notifications/api";
import { useGetMessagesQuery } from "@/features/messages/api";
import { useAppSelector } from "@/shared/hooks/redux";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useTheme } from "@/context/ThemeContext";
import { ClockInModal } from "@/features/personnel/components/ClockInModal";
import { useGetMyAttendanceStatusQuery } from "@/features/personnel/attendanceApi";

type HeaderProps = {
  onOpenSidebar?: () => void;
};

export const Header = ({ onOpenSidebar }: HeaderProps) => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const userPermissions = useAppSelector(
    (state) => state.auth.user?.permissions ?? [],
  );
  const canViewMessages = true;
  void userPermissions;
  const [now, setNow] = useState(() => new Date());
  const [isEmergenciesOpen, setIsEmergenciesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isClockInOpen, setIsClockInOpen] = useState(false);

  const { data: myAttendance } = useGetMyAttendanceStatusQuery();
  const emergenciesRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { data: emergencySummary = {}, isLoading: isEmergenciesLoading } =
    useGetEmergencySummaryQuery(undefined, {
      skip: !isEmergenciesOpen,
    });
  const { data: notifications = [], isLoading: isNotificationsLoading } =
    useGetNotificationsQuery(undefined, {
      skip: !isNotificationsOpen,
    });
  const { data: inboxMessages = [], isFetching: isMessagesLoading } =
    useGetMessagesQuery(
      { box: "inbox" },
      {
        skip: !canViewMessages,
        refetchOnFocus: true,
        refetchOnReconnect: true,
      },
    );

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
        navigation: notification.navigation,
      };
    });
  }, [notifications]);

  const unreadMessages = useMemo(
    () => inboxMessages.filter((message) => message.is_read === false),
    [inboxMessages],
  );

  const unreadMessageItems = useMemo(() => {
    return unreadMessages.slice(0, 10).map((message) => {
      const senderName =
        [message.sender?.firstname, message.sender?.lastname]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        message.sender?.username ||
        message.sender?.email ||
        "Unknown sender";

      const preview = message.body?.trim() || "(No content)";
      const dateLabel = message.created_at
        ? new Date(message.created_at).toLocaleDateString("en-US")
        : "-";

      return {
        id: message.id,
        senderName,
        preview,
        dateLabel,
      };
    });
  }, [unreadMessages]);

  const unreadMessagesCount = unreadMessages.length;

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
  const assetInspectionItems =
    emergencySummary.assets_due_for_inspection?.data ?? [];
  const emergencyBadgeCount =
    (emergencySummary.assets_due_for_inspection?.count ?? 0) +
    (emergencySummary.low_stock_inventories?.count ?? 0);

  const formatInventoryLabel = (item: EmergencyLowStockInventoryItem) => {
    const primary =
      item.part_number || item.serial_number || `Inventory #${item.id}`;
    const type = item.type ? item.type.replace(/_/g, " ") : "inventory";
    return `${primary} (${type})`;
  };

  const formatAssetInspectionLabel = (item: EmergencyAssetInspectionItem) => {
    return item.name || item.serial_number || `Asset #${item.id}`;
  };

  const resolveDashboardPath = (navigation?: NavigationTarget | null) => {
    if (!navigation?.href) {
      return null;
    }

    const href = navigation.href.startsWith("/")
      ? navigation.href
      : `/${navigation.href}`;

    if (href.startsWith("/dashboard/")) {
      return href;
    }

    const inventoryMatch = href.match(/^\/inventories\/(\d+)$/);
    if (inventoryMatch) {
      return `/dashboard/inventory/${inventoryMatch[1]}`;
    }

    const assetMatch = href.match(/^\/assets\/(\d+)$/);
    if (assetMatch) {
      return `/dashboard/assets/${assetMatch[1]}`;
    }

    const personnelMatch = href.match(/^\/personnel\/(\d+)$/);
    if (personnelMatch) {
      return `/dashboard/personnel/${personnelMatch[1]}`;
    }

    const operationMatch = href.match(/^\/operations\/(\d+)$/);
    if (operationMatch) {
      return `/dashboard/operations/${operationMatch[1]}`;
    }

    return `/dashboard${href}`;
  };

  const handleNavigation = (navigation?: NavigationTarget | null) => {
    const path = resolveDashboardPath(navigation);

    if (!path) {
      return;
    }

    setIsEmergenciesOpen(false);
    setIsNotificationsOpen(false);
    setIsMessagesOpen(false);
    navigate(path);
  };

  const getClickableRowClassName = (isDisabled: boolean) => {
    if (isDisabled) {
      return "grid w-full gap-3 py-3 border-b border-[#0A4D66]/40 last:border-b-0 text-left disabled:cursor-default";
    }

    return "group grid w-full gap-3 py-3 border-b border-[#0A4D66]/40 last:border-b-0 text-left rounded-sm transition-all duration-150 hover:bg-[#0A4D66]/20 hover:shadow-[inset_3px_0_0_0_#7FD5FF] focus-visible:outline-none focus-visible:bg-[#0A4D66]/20 focus-visible:shadow-[inset_3px_0_0_0_#7FD5FF] cursor-pointer";
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

  useClickOutside(messagesRef, () => setIsMessagesOpen(false), isMessagesOpen);

  /* ── theme-derived class helpers ─────────────────────── */
  const hdrBg = isDark
    ? "bg-[#001219] border-[#0A4D66]/30"
    : "bg-white border-gray-200";
  const hdrText = isDark ? "text-gray-400" : "text-gray-500";
  const iconBtn = isDark
    ? "hover:bg-[#0A4D66]/30 text-gray-400"
    : "hover:bg-gray-100 text-gray-500";
  // const searchCls = isDark
  //   ? "bg-[#001219] border border-[#0A4D66]/50 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
  //   : "bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-[#0369A1]";
  const dropdownCls = isDark
    ? "bg-[#001825] border-[#0A4D66]/40 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
    : "bg-white border-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.12)]";
  const dropdownHeader = isDark ? "border-[#0A4D66]/30" : "border-gray-100";
  const dropdownTitle = isDark ? "text-white" : "text-gray-900";
  const dropdownBody = isDark ? "text-gray-300" : "text-gray-500";
  const dropdownRow = isDark
    ? "border-[#0A4D66]/40 hover:bg-[#0A4D66]/20 hover:shadow-[inset_3px_0_0_0_#7FD5FF]"
    : "border-gray-100 hover:bg-gray-50 hover:shadow-[inset_3px_0_0_0_#0369A1]";
  const dropdownRowText = isDark ? "text-white" : "text-gray-800";
  const dropdownRowMuted = isDark ? "text-gray-400" : "text-gray-400";
  const dropdownAccent = isDark ? "text-[#7FD5FF]" : "text-[#0369A1]";
  const dropdownFooter = isDark ? "border-[#0A4D66]/30" : "border-gray-100";
  const closeBtnCls = isDark
    ? "bg-[#B7E6FF] text-[#001219]"
    : "bg-[#0369A1] text-white";
  const mainIconSize = "w-6 h-6";

  return (
    <>
    <header
      className={`h-16 border-b px-4 md:px-6 flex items-center justify-between ${hdrBg}`}
    >
      {/* Left: Mobile menu + Date/Time */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`lg:hidden p-2 rounded-full transition-colors ${iconBtn}`}
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Icon icon="mdi:menu" className={mainIconSize} />
        </button>
        <div className={`text-xs sm:text-sm font-medium truncate ${hdrText}`}>
          {dateTimeLabel}
        </div>
      </div>

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        {/* <div className="relative hidden sm:block">
          <Icon
            icon="mdi:magnify"
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${mainIconSize} ${isDark ? "text-gray-500" : "text-gray-400"}`}
          />
          <input
            type="text"
            placeholder="Search"
            className={`rounded-lg pl-11 pr-4 py-2 text-sm focus:outline-none w-52 md:w-64 transition-colors ${searchCls}`}
          />
        </div> */}

        {/* Icons */}
        <div
          className={`flex items-center gap-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}
        >
          {canViewMessages && (
            <div className="relative" ref={messagesRef}>
              <button
                className={`p-2 rounded-full transition-colors relative ${iconBtn}`}
                onClick={() => {
                  setIsMessagesOpen((current) => !current);
                  setIsNotificationsOpen(false);
                  setIsEmergenciesOpen(false);
                }}
                type="button"
                aria-label="Unread messages"
                title="Unread messages"
              >
                <Icon
                  icon="mdi:message-text-outline"
                  className={mainIconSize}
                />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] leading-4 text-center font-semibold">
                    {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                  </span>
                )}
              </button>

              {isMessagesOpen && (
                <div
                  className={`absolute right-0 top-14 z-50 w-110 max-w-[calc(100vw-2rem)] border rounded-sm overflow-hidden ${dropdownCls}`}
                >
                  <div
                    className={`flex items-center justify-between px-6 py-5 border-b ${dropdownHeader}`}
                  >
                    <h3
                      className={`text-2xl font-bold uppercase ${dropdownTitle}`}
                    >
                      Unread Messages
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsMessagesOpen(false)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center hover:opacity-90 ${closeBtnCls}`}
                      aria-label="Close unread messages"
                      title="Close unread messages"
                    >
                      <Icon icon="mdi:close" className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-6 py-2 max-h-105 overflow-y-auto">
                    {isMessagesLoading ? (
                      <div className={`py-8 text-center ${dropdownBody}`}>
                        Loading unread messages...
                      </div>
                    ) : unreadMessageItems.length === 0 ? (
                      <div className={`py-8 text-center ${dropdownBody}`}>
                        No unread messages
                      </div>
                    ) : (
                      unreadMessageItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setIsMessagesOpen(false);
                            navigate("/dashboard/messages");
                          }}
                          className={`group grid w-full grid-cols-[minmax(0,1fr)_90px] gap-3 border-b py-3 text-left last:border-b-0 transition-all duration-150 ${dropdownRow}`}
                        >
                          <div>
                            <p className={`text-xs ${dropdownAccent}`}>
                              {item.senderName}
                            </p>
                            <p
                              className={`text-sm line-clamp-2 ${dropdownRowText}`}
                            >
                              {item.preview}
                            </p>
                          </div>
                          <div
                            className={`flex items-center justify-end gap-2 text-right text-xs whitespace-nowrap ${dropdownRowMuted}`}
                          >
                            <Icon
                              icon="mdi:open-in-new"
                              className="w-3.5 h-3.5"
                            />
                            <span>{item.dateLabel}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className={`border-t px-6 py-3 ${dropdownFooter}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMessagesOpen(false);
                        navigate("/dashboard/messages");
                      }}
                      className={`text-xs hover:underline ${dropdownAccent}`}
                    >
                      Open messages page
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative" ref={emergenciesRef}>
            <button
              className={`p-2 rounded-full transition-colors relative ${iconBtn}`}
              onClick={() => setIsEmergenciesOpen((current) => !current)}
              type="button"
              aria-label="Emergencies"
              title="Emergencies"
            >
              <Icon
                icon="material-symbols:e911-emergency-outline"
                className={mainIconSize}
              />
              {emergencyBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center font-semibold">
                  {emergencyBadgeCount > 99 ? "99+" : emergencyBadgeCount}
                </span>
              )}
            </button>

            {isEmergenciesOpen && (
              <div
                className={`absolute right-0 top-14 z-50 w-96 max-w-[calc(100vw-2rem)] border rounded-sm overflow-hidden ${dropdownCls}`}
              >
                <div
                  className={`flex items-center justify-between px-6 py-5 border-b ${dropdownHeader}`}
                >
                  <h3
                    className={`text-2xl font-bold uppercase ${dropdownTitle}`}
                  >
                    Emergencies
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEmergenciesOpen(false)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center hover:opacity-90 ${closeBtnCls}`}
                    aria-label="Close emergencies"
                    title="Close emergencies"
                  >
                    <Icon icon="mdi:close" className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-2 max-h-105 overflow-y-auto">
                  {isEmergenciesLoading ? (
                    <div className={`py-8 text-center ${dropdownBody}`}>
                      Loading emergency summary...
                    </div>
                  ) : !emergencySummary.reference_date &&
                    !emergencySummary.assets_due_for_inspection &&
                    !emergencySummary.low_stock_inventories ? (
                    <div className={`py-8 text-center ${dropdownBody}`}>
                      No emergency summary found
                    </div>
                  ) : (
                    <>
                      <div className={`py-4 border-b ${dropdownHeader}`}>
                        <p
                          className={`text-xs uppercase tracking-wider ${dropdownRowMuted}`}
                        >
                          Reference Date
                        </p>
                        <p className={`text-sm mt-1 ${dropdownRowText}`}>
                          {referenceDate}
                        </p>
                      </div>

                      <div className={`py-4 border-b ${dropdownHeader}`}>
                        <p
                          className={`text-xs uppercase tracking-wider ${dropdownRowMuted}`}
                        >
                          Assets Due For Inspection
                        </p>
                        <p
                          className={`text-base font-semibold mt-1 ${dropdownAccent}`}
                        >
                          {emergencySummary.assets_due_for_inspection?.count ??
                            0}
                        </p>
                      </div>

                      <div className={`py-4 border-b ${dropdownHeader}`}>
                        <p
                          className={`text-xs uppercase tracking-wider ${dropdownRowMuted}`}
                        >
                          Low Stock Inventories
                        </p>
                        <p
                          className={`text-base font-semibold mt-1 ${dropdownAccent}`}
                        >
                          {emergencySummary.low_stock_inventories?.count ?? 0}
                        </p>
                      </div>

                      {assetInspectionItems.length > 0 && (
                        <div className="py-3 border-b border-[#0A4D66]/50">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                            Assets Due Now
                          </p>
                          {assetInspectionItems.map((item) => {
                            const targetPath = resolveDashboardPath(
                              item.navigation,
                            );

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  handleNavigation(item.navigation)
                                }
                                disabled={!targetPath}
                                className={`${getClickableRowClassName(!targetPath)} grid-cols-[minmax(0,1fr)_auto]`}
                              >
                                <div>
                                  <p className="text-white text-sm leading-6">
                                    {formatAssetInspectionLabel(item)}
                                  </p>
                                  <p className="text-gray-400 text-xs">
                                    Serial: {item.serial_number || "-"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-right whitespace-nowrap">
                                  {targetPath && (
                                    <Icon
                                      icon="mdi:open-in-new"
                                      className="w-4 h-4 text-[#7FD5FF] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                                    />
                                  )}
                                  <p className="text-[#FFB3B3] text-sm font-semibold">
                                    Due
                                  </p>
                                  <p className="text-gray-400 text-xs group-hover:text-[#B7E6FF] group-focus-visible:text-[#B7E6FF]">
                                    Open item
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {lowStockItems.length > 0 && (
                        <div className="py-3">
                          <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                            Low Stock Items
                          </p>
                          {lowStockItems.map((item) => {
                            const targetPath = resolveDashboardPath(
                              item.navigation,
                            );

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  handleNavigation(item.navigation)
                                }
                                disabled={!targetPath}
                                className={`${getClickableRowClassName(!targetPath)} grid-cols-[minmax(0,1fr)_auto]`}
                              >
                                <div>
                                  <p className="text-white text-sm leading-6">
                                    {formatInventoryLabel(item)}
                                  </p>
                                  <p className="text-gray-400 text-xs">
                                    Unit: {item.unit?.name || "-"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-right whitespace-nowrap">
                                  {targetPath && (
                                    <Icon
                                      icon="mdi:open-in-new"
                                      className="w-4 h-4 text-[#7FD5FF] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                                    />
                                  )}
                                  <div>
                                    <p className="text-[#FFB3B3] text-sm font-semibold">
                                      {item.current_stock ?? 0} /{" "}
                                      {item.re_order_level ?? 0}
                                    </p>
                                    <p className="text-gray-400 text-xs group-hover:text-[#B7E6FF] group-focus-visible:text-[#B7E6FF]">
                                      {item.stock_level || "Low"}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
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
              className={`p-2 rounded-full transition-colors relative ${iconBtn}`}
              onClick={() => setIsNotificationsOpen((current) => !current)}
              aria-label="View notifications"
              title="View notifications"
              type="button"
            >
              <Icon icon="mdi:bell-outline" className={mainIconSize} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {isNotificationsOpen && (
              <div
                className={`absolute right-0 top-14 z-50 w-115 max-w-[calc(100vw-2rem)] border rounded-sm overflow-hidden ${dropdownCls}`}
              >
                <div
                  className={`flex items-center justify-between px-6 py-5 border-b ${dropdownHeader}`}
                >
                  <h3
                    className={`text-2xl font-bold uppercase ${dropdownTitle}`}
                  >
                    Notification
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center hover:opacity-90 ${closeBtnCls}`}
                    aria-label="Close notifications"
                    title="Close notifications"
                  >
                    <Icon icon="mdi:close" className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-2 max-h-105 overflow-y-auto">
                  {isNotificationsLoading ? (
                    <div className={`py-8 text-center ${dropdownBody}`}>
                      Loading notifications...
                    </div>
                  ) : notificationItems.length === 0 ? (
                    <div className={`py-8 text-center ${dropdownBody}`}>
                      No notifications found
                    </div>
                  ) : (
                    notificationItems.map((item) => {
                      const targetPath = resolveDashboardPath(item.navigation);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigation(item.navigation)}
                          disabled={!targetPath}
                          className={`${getClickableRowClassName(!targetPath)} grid-cols-[18px_minmax(0,1fr)_110px] py-4 ${isDark ? "border-[#0A4D66]/50" : "border-gray-100"}`}
                        >
                          <div
                            className={`w-3 h-3 mt-1.5 transition-colors ${isDark ? "bg-[#0A4D66] group-hover:bg-[#0369A1] group-focus-visible:bg-[#0369A1]" : "bg-gray-300 group-hover:bg-[#0369A1] group-focus-visible:bg-[#0369A1]"}`}
                          />
                          <p className={`text-sm leading-7 ${dropdownRowText}`}>
                            {item.message}
                          </p>
                          <div
                            className={`flex items-center justify-end gap-2 text-right text-sm font-semibold whitespace-nowrap ${dropdownRowText}`}
                          >
                            {targetPath && (
                              <Icon
                                icon="mdi:open-in-new"
                                className="w-4 h-4 text-[#7FD5FF] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                              />
                            )}
                            <span className="group-hover:text-[#B7E6FF] group-focus-visible:text-[#B7E6FF] transition-colors">
                              {item.dateLabel}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Clock In / Out — available to all users */}
          <button
            type="button"
            onClick={() => setIsClockInOpen(true)}
            title={myAttendance?.clocked_in ? (myAttendance.clocked_out ? "Duty complete" : "Clock out") : "Clock in"}
            aria-label="Clock in or out"
            className={`p-2 rounded-full transition-colors relative ${iconBtn}`}
          >
            <Icon
              icon={myAttendance?.clocked_in && !myAttendance.clocked_out ? "mdi:logout" : "mdi:login"}
              className={mainIconSize}
            />
            {myAttendance?.clocked_in && !myAttendance.clocked_out && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </button>

          <button
            className={`p-2 rounded-full transition-colors relative ${iconBtn}`}
            type="button"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            <Icon
              icon={isDark ? "mdi:weather-sunny" : "mdi:weather-night"}
              className={mainIconSize}
            />
          </button>
          <button
            className={`p-2 rounded-full transition-colors relative ${iconBtn}`}
            type="button"
            aria-label="Profile"
            title="Profile"
            onClick={() => navigate("/dashboard/users")}
          >
            <Icon icon="mdi:account-circle-outline" className={mainIconSize} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </header>

    <ClockInModal open={isClockInOpen} onClose={() => setIsClockInOpen(false)} />
    </>
  );
};
