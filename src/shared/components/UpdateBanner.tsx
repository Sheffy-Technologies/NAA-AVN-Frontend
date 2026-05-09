import { Icon } from "@iconify/react";
import { useTheme } from "@/context/ThemeContext";
import { useAppUpdater } from "@/shared/hooks/useAppUpdater";

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
};

export const UpdateBanner = () => {
  const { isDark } = useTheme();
  const updater = useAppUpdater();

  if (!updater.isTauri) return null;
  if (updater.status === "idle" || updater.status === "checking") return null;

  const cardCls = isDark
    ? "border-[#0A4D66]/60 bg-[#04131A] text-white"
    : "border-gray-200 bg-white text-gray-900";
  const subTextCls = isDark ? "text-gray-400" : "text-gray-500";
  const progressTrackCls = isDark ? "bg-[#0A4D66]/30" : "bg-gray-200";

  const renderBody = () => {
    if (updater.status === "available") {
      return (
        <>
          <div className="flex items-start gap-3">
            <Icon
              icon="mdi:cloud-download-outline"
              className="mt-0.5 h-5 w-5 shrink-0 text-[#7FD5FF]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Update available · v{updater.version}
              </p>
              {updater.notes && (
                <p
                  className={`mt-0.5 line-clamp-2 text-xs ${subTextCls}`}
                  title={updater.notes}
                >
                  {updater.notes}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={updater.dismiss}
              className={`rounded-md px-3 py-1.5 text-xs ${
                isDark
                  ? "text-gray-300 hover:bg-[#0A4D66]/30"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => void updater.installUpdate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0476b8]"
            >
              <Icon icon="mdi:download" className="h-3.5 w-3.5" />
              Install Update
            </button>
          </div>
        </>
      );
    }

    if (updater.status === "downloading") {
      const pct = updater.progress;
      return (
        <>
          <div className="flex items-start gap-3">
            <Icon
              icon="mdi:download"
              className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-[#7FD5FF]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Downloading update v{updater.version}…
              </p>
              <p className={`mt-0.5 text-xs ${subTextCls}`}>
                {formatBytes(updater.downloadedBytes)}
                {updater.totalBytes
                  ? ` of ${formatBytes(updater.totalBytes)}`
                  : ""}
                {pct !== undefined ? ` · ${pct.toFixed(0)}%` : ""}
              </p>
            </div>
          </div>
          <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${progressTrackCls}`}>
            <div
              className="h-full rounded-full bg-[#0369A1] transition-[width] duration-200"
              // eslint-disable-next-line react/forbid-dom-props
              style={{ width: `${pct ?? 25}%` }}
            />
          </div>
        </>
      );
    }

    if (updater.status === "ready") {
      return (
        <>
          <div className="flex items-start gap-3">
            <Icon
              icon="mdi:check-circle-outline"
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Update v{updater.version} ready
              </p>
              <p className={`mt-0.5 text-xs ${subTextCls}`}>
                Restart the app to finish installation.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={updater.dismiss}
              className={`rounded-md px-3 py-1.5 text-xs ${
                isDark
                  ? "text-gray-300 hover:bg-[#0A4D66]/30"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => void updater.restartApp()}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Icon icon="mdi:restart" className="h-3.5 w-3.5" />
              Restart Now
            </button>
          </div>
        </>
      );
    }

    if (updater.status === "error") {
      return (
        <>
          <div className="flex items-start gap-3">
            <Icon
              icon="mdi:alert-circle-outline"
              className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Update failed</p>
              <p
                className={`mt-0.5 line-clamp-2 text-xs ${subTextCls}`}
                title={updater.error}
              >
                {updater.error || "Unknown error"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={updater.dismiss}
              className={`rounded-md px-3 py-1.5 text-xs ${
                isDark
                  ? "text-gray-300 hover:bg-[#0A4D66]/30"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => void updater.checkNow()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0369A1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0476b8]"
            >
              <Icon icon="mdi:refresh" className="h-3.5 w-3.5" />
              Try Again
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-50 w-[min(22rem,calc(100vw-3rem))]">
      <div
        className={`pointer-events-auto rounded-xl border p-4 shadow-[0_15px_40px_rgba(0,0,0,0.35)] ${cardCls}`}
      >
        {renderBody()}
      </div>
    </div>
  );
};
