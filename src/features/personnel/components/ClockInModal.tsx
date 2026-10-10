import { useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import {
  useClockInMutation,
  useClockOutMutation,
  useGetMyAttendanceStatusQuery,
} from "../attendanceApi";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const ClockInModal = ({ open, onClose }: Props) => {
  const dispatch = useAppDispatch();
  const [notes, setNotes] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const { data: myStatus, isLoading: isStatusLoading } = useGetMyAttendanceStatusQuery(undefined, { skip: !open });
  const [clockIn, { isLoading: isClockinLoading }] = useClockInMutation();
  const [clockOut, { isLoading: isClockoutLoading }] = useClockOutMutation();

  const isLoading = isClockinLoading || isClockoutLoading;

  if (!open) return null;

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLoading(false);
          setGeoError(null);
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        () => {
          setGeoLoading(false);
          setGeoError("Could not retrieve location. Proceeding without coordinates.");
          resolve(null);
        },
        { timeout: 8000 },
      );
    });

  const handleClockIn = async () => {
    const coords = await getLocation();
    try {
      const result = await clockIn({
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        notes: notes.trim() || null,
      }).unwrap();

      if (!result.within_range) {
        dispatch(showToast({ message: "Clocked in — outside unit geofence", type: "warning" }));
      } else {
        dispatch(showToast({ message: "Clocked in successfully", type: "success" }));
      }
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? "Clock-in failed";
      dispatch(showToast({ message: msg, type: "error" }));
    }
  };

  const handleClockOut = async () => {
    const coords = await getLocation();
    try {
      await clockOut({
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      }).unwrap();
      dispatch(showToast({ message: "Clocked out successfully", type: "success" }));
      onClose();
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message ?? "Clock-out failed";
      dispatch(showToast({ message: msg, type: "error" }));
    }
  };

  const alreadyClockedIn = myStatus?.clocked_in ?? false;
  const alreadyClockedOut = myStatus?.clocked_out ?? false;
  const attendance = myStatus?.attendance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-[#001219] border border-[#0A4D66]/40 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#0A4D66]/40">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:clock-outline" className="w-5 h-5 text-[#7FD5FF]" />
            <h2 className="text-sm font-semibold text-white">Duty Time</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isStatusLoading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 text-sm gap-2">
              <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
              Checking status...
            </div>
          ) : (
            <>
              {/* Status card */}
              {alreadyClockedIn && attendance && (
                <div className="bg-[#001825] border border-[#0A4D66]/30 rounded-lg p-3 text-xs text-gray-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Clock In</span>
                    <span className="text-white font-medium">
                      {attendance.clock_in
                        ? new Date(`1970-01-01T${attendance.clock_in}`).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                  {alreadyClockedOut && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Clock Out</span>
                      <span className="text-white font-medium">
                        {attendance.clock_out
                          ? new Date(`1970-01-01T${attendance.clock_out}`).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span
                      className={cn(
                        "font-medium capitalize",
                        attendance.status === "present" && "text-emerald-400",
                        attendance.status === "late" && "text-amber-400",
                      )}
                    >
                      {attendance.status}
                    </span>
                  </div>
                  {!attendance.is_within_range && (
                    <div className="flex items-center gap-1.5 mt-1 text-amber-400">
                      <Icon icon="mdi:map-marker-off-outline" className="w-3.5 h-3.5" />
                      <span>Outside unit geofence</span>
                    </div>
                  )}
                </div>
              )}

              {geoError && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1">
                  <Icon icon="mdi:alert-outline" className="w-3.5 h-3.5" />
                  {geoError}
                </p>
              )}

              {!alreadyClockedIn && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Any remarks for today..."
                    className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#7FD5FF]/40 resize-none"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                {!alreadyClockedIn && (
                  <button
                    type="button"
                    onClick={handleClockIn}
                    disabled={isLoading || geoLoading}
                    className="w-full py-2.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {geoLoading ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Getting location...
                      </>
                    ) : isClockinLoading ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Clocking in...
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:login" className="w-4 h-4" />
                        Clock In
                      </>
                    )}
                  </button>
                )}

                {alreadyClockedIn && !alreadyClockedOut && (
                  <button
                    type="button"
                    onClick={handleClockOut}
                    disabled={isLoading || geoLoading}
                    className="w-full py-2.5 rounded bg-red-700 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {geoLoading ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Getting location...
                      </>
                    ) : isClockoutLoading ? (
                      <>
                        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Clocking out...
                      </>
                    ) : (
                      <>
                        <Icon icon="mdi:logout" className="w-4 h-4" />
                        Clock Out
                      </>
                    )}
                  </button>
                )}

                {alreadyClockedIn && alreadyClockedOut && (
                  <p className="text-center text-sm text-gray-400 py-2">
                    Duty completed for today.
                  </p>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 rounded border border-[#0A4D66]/40 text-xs text-gray-300 hover:bg-[#0A4D66]/20"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
