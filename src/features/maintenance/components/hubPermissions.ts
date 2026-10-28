import { useAppSelector } from "@/app/store";

/** What the signed-in user may do with the Maintenance Hub store (MaintenanceStoreController). */
export const useHubPermissions = () => {
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  const has = (p: string) => permissions.includes(p);
  return {
    has,
    canView: has("maintenance-store.view"),
    canUse: has("maintenance-store.use"),
    canIssue: has("maintenance-store.issue"),
    canRequest: has("spares-requests.create"),
  };
};
