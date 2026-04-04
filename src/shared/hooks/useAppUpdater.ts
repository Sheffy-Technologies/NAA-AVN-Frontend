import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Checks for a new app version on mount and prompts the user to install it.
 * Safe to call in any top-level React component (e.g. DashboardLayout).
 * Does nothing in the browser (non-Tauri) environment.
 */
export function useAppUpdater() {
  useEffect(() => {
    // Only run inside a real Tauri window
    if (!("__TAURI_INTERNALS__" in window)) return;

    let cancelled = false;

    async function checkForUpdate() {
      try {
        const update = await check();
        if (cancelled || !update?.available) return;

        const yes = await ask(
          `Version ${update.version} is available.\n\n${update.body ?? ""}\n\nInstall now?`,
          { title: "Update Available", kind: "info" },
        );
        if (!yes || cancelled) return;

        await update.downloadAndInstall();
        await relaunch();
      } catch (e) {
        console.error("[updater]", e);
      }
    }

    checkForUpdate();
    return () => {
      cancelled = true;
    };
  }, []);
}
