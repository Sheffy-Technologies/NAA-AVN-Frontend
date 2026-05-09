import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdaterState {
  status: UpdaterStatus;
  version?: string;
  notes?: string;
  /** 0–100 download progress; undefined if total size unknown. */
  progress?: number;
  downloadedBytes: number;
  totalBytes?: number;
  error?: string;
}

interface UseAppUpdaterReturn extends UpdaterState {
  isTauri: boolean;
  /** Re-run the version check manually. */
  checkNow: () => Promise<void>;
  /** Begin downloading + installing the available update. */
  installUpdate: () => Promise<void>;
  /** Relaunch the app after install completes. */
  restartApp: () => Promise<void>;
  /** Hide the banner / reset state to idle. */
  dismiss: () => void;
}

const isTauriEnv = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Drives a non-blocking update banner. Checks once on mount, exposes
 * state + actions that the UI can render however it wants.
 */
export function useAppUpdater(): UseAppUpdaterReturn {
  const [state, setState] = useState<UpdaterState>({
    status: "idle",
    downloadedBytes: 0,
  });
  const updateRef = useRef<Update | null>(null);
  const isTauri = isTauriEnv();

  const checkNow = useCallback(async () => {
    if (!isTauri) return;
    setState((prev) => ({ ...prev, status: "checking", error: undefined }));
    try {
      const update = await check();
      if (!update?.available) {
        setState({ status: "idle", downloadedBytes: 0 });
        return;
      }
      updateRef.current = update;
      setState({
        status: "available",
        version: update.version,
        notes: update.body ?? undefined,
        downloadedBytes: 0,
      });
    } catch (e) {
      console.error("[updater] check failed", e);
      setState({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        downloadedBytes: 0,
      });
    }
  }, [isTauri]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((prev) => ({
      ...prev,
      status: "downloading",
      downloadedBytes: 0,
      progress: undefined,
      totalBytes: undefined,
      error: undefined,
    }));

    try {
      let total: number | undefined;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
          setState((prev) => ({
            ...prev,
            totalBytes: total,
            downloadedBytes: 0,
            progress: total ? 0 : undefined,
          }));
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState((prev) => ({
            ...prev,
            downloadedBytes: downloaded,
            progress: total
              ? Math.min(100, (downloaded / total) * 100)
              : undefined,
          }));
        } else if (event.event === "Finished") {
          setState((prev) => ({
            ...prev,
            status: "ready",
            progress: 100,
          }));
        }
      });
    } catch (e) {
      console.error("[updater] install failed", e);
      setState((prev) => ({
        ...prev,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  const restartApp = useCallback(async () => {
    if (!isTauri) return;
    try {
      await relaunch();
    } catch (e) {
      console.error("[updater] relaunch failed", e);
    }
  }, [isTauri]);

  const dismiss = useCallback(() => {
    setState({ status: "idle", downloadedBytes: 0 });
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    void checkNow();
  }, [isTauri, checkNow]);

  return {
    ...state,
    isTauri,
    checkNow,
    installUpdate,
    restartApp,
    dismiss,
  };
}
