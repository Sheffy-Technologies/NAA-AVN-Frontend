import { useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useGetUsersQuery } from "@/features/users/api";
import { useLinkPersonnelUserMutation, type LinkedUser } from "../api";

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Could not update the linked account.";
};

const userLabel = (u: Pick<LinkedUser, "firstname" | "lastname" | "email" | "username">) =>
  `${[u.firstname, u.lastname].filter(Boolean).join(" ") || u.username || "User"}${u.email ? ` (${u.email})` : ""}`;

/**
 * Which login account belongs to this personnel record. Linking lets that
 * user open "My personnel record" from their user settings page.
 */
export const LinkedAccountCard = ({ personnelId, user }: { personnelId: number; user: LinkedUser | null | undefined }) => {
  const dispatch = useAppDispatch();
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  const canLink = permissions.includes("personnel.user.link");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { data: users = [], isLoading: usersLoading } = useGetUsersQuery(undefined, { skip: !open });
  const [link, { isLoading }] = useLinkPersonnelUserMutation();

  const save = async (userId: number | null) => {
    try {
      await link({ id: personnelId, user_id: userId }).unwrap();
      dispatch(showToast({ type: "success", message: userId ? "User account linked." : "User account unlinked." }));
      setOpen(false);
      setSelected(null);
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  return (
    <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-[#0A4D66]/40 bg-[#001825] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Icon icon={user ? "mdi:account-check-outline" : "mdi:account-off-outline"} className={user ? "w-5 h-5 text-emerald-400 shrink-0" : "w-5 h-5 text-gray-500 shrink-0"} />
        <div className="min-w-0">
          <div className="text-[11px] uppercase text-gray-400">Linked user account</div>
          <div className="text-sm text-white truncate">{user ? userLabel(user) : "Not linked: this person can't manage their own record yet"}</div>
        </div>
      </div>
      {canLink && (
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelected(user ? String(user.id) : null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50]"
          >
            <Icon icon="mdi:link-variant" className="w-4 h-4" />
            {user ? "Change" : "Link user account"}
          </button>
          {user && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (window.confirm(`Unlink ${userLabel(user)} from this personnel record?`)) void save(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/50 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Icon icon="mdi:link-variant-off" className="w-4 h-4" />
              Unlink
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border border-[#0A4D66] bg-[#001825] p-6 text-white shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#7FD5FF] mb-1">Link user account</h3>
            <p className="text-xs text-gray-400 mb-4">
              Choose the login that belongs to this person. They'll be able to update their own contact details from their user settings.
            </p>
            <SearchableSelect
              size="sm"
              placeholder={usersLoading ? "Loading users…" : "Search users by name or email…"}
              value={selected}
              onChange={(v) => setSelected(v === null ? null : String(v))}
              options={users.map((u) => ({ value: String(u.id), label: userLabel({ ...u, firstname: u.firstname ?? null, lastname: u.lastname ?? null, email: u.email ?? null, username: u.username ?? null }) }))}
            />
            <p className="text-[11px] text-gray-500 mt-2">An account can be linked to only one personnel record.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 hover:bg-slate-800">
                Cancel
              </button>
              <button
                type="button"
                disabled={!selected || isLoading || selected === (user ? String(user.id) : null)}
                onClick={() => save(Number(selected))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0A4D66] text-white hover:bg-[#083c50] disabled:opacity-50"
              >
                <Icon icon="mdi:check" className="w-4 h-4" />
                {isLoading ? "Linking…" : "Link account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
