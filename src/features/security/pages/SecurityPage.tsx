import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useNavigate } from "react-router-dom";
import {
  useGetActivityLogsQuery,
  useGetDevicesQuery,
  useUpdateDeviceStatusMutation,
} from "@/features/security/api";
import { useGetUsersQuery } from "@/features/users/api";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";

type SecurityTab = "activity" | "device" | "user";

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

  const { data: users = [], isLoading: isUsersLoading } = useGetUsersQuery();

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const userRows = useMemo(() => {
    return users.map((u) => {
      const created = u.created_at ? new Date(u.created_at) : null;
      const hasValid = created && !Number.isNaN(created.getTime());

      const name = [u.firstname, u.lastname].filter(Boolean).join(" ") || u.username || u.email || "-";

      return {
        id: u.id,
        name,
        email: u.email || "-",
        phone: u.phone_number || "-",
        created: hasValid
          ? created.toLocaleString("en-GB", {
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
  }, [users]);

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
      const action = isActiveValue === 1 ? "approved" : "declined";
      dispatch(showToast({ message: `Device ${action} successfully`, type: "success" }));
    } catch (error) {
      console.error("Failed to update device status", error);
      dispatch(showToast({ message: "Failed to update device status", type: "error" }));
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
        <button
          onClick={() => setActiveTab("user")}
          className={cn(
            "pb-3 text-lg font-semibold border-b-2 transition-colors",
            activeTab === "user"
              ? "text-white border-white"
              : "text-gray-400 border-transparent",
          )}
        >
          User Management
        </button>
      </div>

      <div className="bg-[#001D2B] border border-[#0A4D66]/40 rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#0A4D66]/30 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white uppercase">
            {activeTab === "user"
              ? "User Management"
              : activeTab === "device"
              ? "Device Management"
              : "Activity Log"}
          </h2>
          <div className="flex items-center gap-3">
            {activeTab === "user" && (
              <button
                onClick={() => navigate("/dashboard/users/add")}
                className="flex items-center gap-2 bg-[#7FD5FF] text-[#00263A] rounded px-3 py-1.5 text-sm font-medium hover:opacity-90"
                aria-label="Add user"
                title="Add user"
              >
                <Icon icon="mdi:account-plus" className="w-4 h-4" />
                Add User
              </button>
            )}
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
        ) : activeTab === "device" ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-275 text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-[#0A4D66]/30">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isUsersLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      Loading users...
                    </td>
                  </tr>
                ) : userRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  userRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "text-white border-b border-[#0A4D66]/20",
                        index % 2 === 0 ? "bg-[#002336]" : "bg-[#002A40]",
                      )}
                    >
                      <td className="px-6 py-4">{row.name}</td>
                      <td className="px-6 py-4">{row.email}</td>
                      <td className="px-6 py-4">{row.phone}</td>
                      <td className="px-6 py-4">{row.created}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-300 hover:text-white">View</button>
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
