import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import {
  useGetActivityLogsQuery,
  useGetDevicesQuery,
  useUpdateDeviceStatusMutation,
} from "@/features/security/api";

type SecurityTab = "activity" | "device";

export const SecurityPage = () => {
  const [activeTab, setActiveTab] = useState<SecurityTab>("activity");
  const { data: logs = [], isLoading } = useGetActivityLogsQuery();
  const {
    data: devices = [],
    isLoading: isDevicesLoading,
    refetch: refetchDevices,
  } = useGetDevicesQuery();
  const [updateDeviceStatus, { isLoading: isUpdatingDeviceStatus }] =
    useUpdateDeviceStatusMutation();
  const [openDeviceActionId, setOpenDeviceActionId] = useState<number | null>(
    null,
  );

  const currentDateTime = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
  }, []);

  const displayRows = useMemo(() => {
    return logs.map((log) => {
      const createdAt = log.created_at ? new Date(log.created_at) : null;
      const validDate = createdAt && !Number.isNaN(createdAt.getTime());

      const date =
        log.date ||
        (validDate
          ? createdAt.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "-");

      const time =
        log.time ||
        (validDate
          ? `${createdAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })} Z`
          : "-");

      const name =
        [log.causer?.firstname, log.causer?.lastname]
          .filter(Boolean)
          .join(" ") ||
        log.name ||
        log.user?.name ||
        [log.user?.firstname, log.user?.lastname, log.user?.othernames]
          .filter(Boolean)
          .join(" ") ||
        "-";

      const email = log.causer?.email || "-";

      return {
        id: log.id,
        date,
        time,
        name,
        email,
        action: log.description || log.action || "-",
        userType: log.user_type || "-",
        deviceCode: log.device_code || "-",
        unit: log.unit?.name || "-",
      };
    });
  }, [logs]);

  const deviceRows = useMemo(() => {
    return devices.map((device) => {
      const lastSeenRaw = device.last_seen_at || device.updated_at || device.created_at;
      const parsed = lastSeenRaw ? new Date(lastSeenRaw) : null;
      const hasValidDate = parsed && !Number.isNaN(parsed.getTime());

      return {
        id: device.id,
        name: device.device_name || device.name || "-",
        code: device.device_code || device.code || "-",
        status:
          Number(device.is_active) === 1
            ? "active"
            : Number(device.is_active) === 0
              ? "inactive"
              : "-",
        lastSeen: hasValidDate
          ? parsed.toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : "-",
      };
    });
  }, [devices]);

  const handleDeviceAction = async (id: number, isActiveValue: 1 | 0) => {
    try {
      await updateDeviceStatus({ id, is_active: isActiveValue }).unwrap();
      setOpenDeviceActionId(null);
      await refetchDevices();
    } catch (error) {
      console.error("Failed to update device status", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">{currentDateTime} Abuja</span>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon
              icon="mdi:magnify"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search"
              className="w-80 bg-[#1A1A1A] border border-[#2B2B2B] rounded px-9 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#0A4D66]"
            />
          </div>
          <button
            className="relative text-gray-300 hover:text-white"
            aria-label="User profile"
            title="User profile"
          >
            <Icon icon="mdi:account" className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <button
            className="relative text-gray-300 hover:text-white"
            aria-label="Messages"
            title="Messages"
          >
            <Icon icon="mdi:message-text-outline" className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <button
            className="relative text-gray-300 hover:text-white"
            aria-label="Notifications"
            title="Notifications"
          >
            <Icon icon="mdi:bell-outline" className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-8 border-b border-[#0A4D66]/40">
        <button
          onClick={() => setActiveTab("activity")}
          className={cn(
            "pb-3 text-lg font-semibold border-b-2 transition-colors",
            activeTab === "activity"
              ? "text-white border-white"
              : "text-gray-400 border-transparent",
          )}
        >
          Activity Log
        </button>
        <button
          onClick={() => setActiveTab("device")}
          className={cn(
            "pb-3 text-lg font-semibold border-b-2 transition-colors",
            activeTab === "device"
              ? "text-white border-white"
              : "text-gray-400 border-transparent",
          )}
        >
          Device Management
        </button>
      </div>

      <div className="bg-[#001D2B] border border-[#0A4D66]/40 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#0A4D66]/30 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white uppercase">
            {activeTab === "activity" ? "Activity Log" : "Device Management"}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[#7FD5FF] text-sm">12 Reset Filter</span>
            <select
              title="Filter by unit"
              aria-label="Filter by unit"
              className="bg-[#00263A] border border-[#0A4D66]/40 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-[#7FD5FF]"
            >
              <option>All Units</option>
            </select>
            <button
              className="text-gray-300 hover:text-white"
              aria-label="Download"
              title="Download"
            >
              <Icon icon="mdi:download" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeTab === "activity" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-275 text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-[#0A4D66]/30">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Action</th>
                  <th className="px-6 py-3 font-medium">User Type</th>
                  <th className="px-6 py-3 font-medium">Device Code</th>
                  <th className="px-6 py-3 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      Loading activity logs...
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "text-white border-b border-[#0A4D66]/20",
                        index % 2 === 0 ? "bg-[#002336]" : "bg-[#002A40]",
                      )}
                    >
                      <td className="px-6 py-4">{row.date}</td>
                      <td className="px-6 py-4">{row.time}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span>{row.name}</span>
                          <span className="text-xs text-gray-300">{row.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{row.action}</td>
                      <td className="px-6 py-4">{row.userType}</td>
                      <td className="px-6 py-4">{row.deviceCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{row.unit}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-275 text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-[#0A4D66]/30">
                  <th className="px-6 py-3 font-medium">Device Name</th>
                  <th className="px-6 py-3 font-medium">Device Code</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Last Seen</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isDevicesLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      Loading devices...
                    </td>
                  </tr>
                ) : deviceRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      No devices found
                    </td>
                  </tr>
                ) : (
                  deviceRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "text-white border-b border-[#0A4D66]/20",
                        index % 2 === 0 ? "bg-[#002336]" : "bg-[#002A40]",
                      )}
                    >
                      <td className="px-6 py-4">{row.name}</td>
                      <td className="px-6 py-4">{row.code}</td>
                      <td className="px-6 py-4 capitalize">{row.status}</td>
                      <td className="px-6 py-4">{row.lastSeen}</td>
                      <td className="px-6 py-4 text-right relative">
                        <button
                          onClick={() =>
                            setOpenDeviceActionId((current) =>
                              current === row.id ? null : row.id,
                            )
                          }
                          className="text-gray-300 hover:text-white"
                          aria-label="Device actions"
                          title="Device actions"
                        >
                          <Icon icon="mdi:dots-horizontal" className="w-5 h-5" />
                        </button>

                        {openDeviceActionId === row.id && (
                          <div className="absolute right-6 top-12 z-50 w-32 rounded-md border border-[#0A4D66]/50 bg-[#001D2B] shadow-xl overflow-hidden">
                            <button
                              onClick={() => handleDeviceAction(row.id, 1)}
                              className="w-full px-3 py-2 text-left text-xs text-emerald-300 hover:bg-[#0A4D66]/40 disabled:opacity-50"
                              disabled={isUpdatingDeviceStatus}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeviceAction(row.id, 0)}
                              className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-[#0A4D66]/40 disabled:opacity-50"
                              disabled={isUpdatingDeviceStatus}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
