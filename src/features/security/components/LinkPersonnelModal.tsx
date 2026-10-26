import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { SearchableSelect } from "@/shared/ui/select/SearchableSelect";
import { useGetPersonnelLinkOptionsQuery, useLinkPersonnelUserMutation } from "@/features/personnel/api";
import type { UserRecord } from "@/features/users/api";

type LinkedPersonnel = NonNullable<UserRecord["linked_personnel"]>;

const errorMessage = (error: unknown) => {
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } })?.data;
  return (data?.errors && Object.values(data.errors)[0]?.[0]) || data?.message || "Could not update the linked personnel record.";
};

/**
 * User management → link a login account to its personnel record. The same
 * link as LinkedAccountCard on the personnel page (PUT /personnel/{id}/user),
 * started from the user's side. An account has at most one personnel record,
 * so picking a different person moves the link.
 */
export const LinkPersonnelModal = ({
  user,
  onClose,
  onSaved,
}: {
  user: { id: number; name: string; personnel: LinkedPersonnel | null };
  onClose: () => void;
  onSaved: () => void;
}) => {
  const dispatch = useAppDispatch();
  const current = user.personnel;
  const [selected, setSelected] = useState<number | null>(current?.id ?? null);
  const { data: people = [], isLoading: peopleLoading } = useGetPersonnelLinkOptionsQuery();
  const [link, { isLoading }] = useLinkPersonnelUserMutation();

  const options = useMemo(
    () =>
      people.map((p) => ({
        value: p.id,
        label: [p.rank, p.name].filter(Boolean).join(" "),
        description: [
          p.service_number,
          p.user_id && p.user_id !== user.id ? "linked to another account" : null,
          p.user_id === user.id ? "linked to this account" : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      })),
    [people, user.id],
  );

  const target = people.find((p) => p.id === selected) ?? null;

  const save = async () => {
    if (!target) return;
    if (target.user_id && target.user_id !== user.id) {
      const ok = window.confirm(
        `${target.name} is already linked to another account. Link them to ${user.name} instead? The other account will lose access to "My personnel record".`,
      );
      if (!ok) return;
    }

    try {
      // An account links to one record: release the old one first.
      if (current && current.id !== target.id) {
        await link({ id: current.id, user_id: null }).unwrap();
      }
      await link({ id: target.id, user_id: user.id }).unwrap();
      dispatch(showToast({ type: "success", message: `${user.name} linked to ${target.name}.` }));
      onSaved();
      onClose();
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
      onSaved();
    }
  };

  const unlink = async () => {
    if (!current) return;
    if (!window.confirm(`Unlink ${user.name} from ${current.name}?`)) return;

    try {
      await link({ id: current.id, user_id: null }).unwrap();
      dispatch(showToast({ type: "success", message: "Personnel record unlinked." }));
      onSaved();
      onClose();
    } catch (err) {
      dispatch(showToast({ type: "error", message: errorMessage(err) }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-[#0A4D66]/50 bg-[#001825] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Link Personnel</h3>
            <p className="mt-1 text-sm text-gray-400">
              Choose the personnel record that belongs to {user.name}. They'll be able to update their own contact details, and their
              actions will show on that person's Activity Log.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-xs text-gray-400">
            Currently linked:{" "}
            <span className="text-white">{current ? `${current.name}${current.service_number ? ` (${current.service_number})` : ""}` : "none"}</span>
          </div>
          <SearchableSelect
            placeholder={peopleLoading ? "Loading personnel…" : "Search personnel by name or service number…"}
            searchPlaceholder="Search personnel..."
            options={options}
            value={selected}
            onChange={(value) => setSelected(value === null ? null : Number(value))}
          />
          <p className="text-[11px] text-gray-500">Only personnel in units you can see are listed.</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            {current && (
              <button
                type="button"
                onClick={() => void unlink()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/50 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Icon icon="mdi:link-variant-off" className="h-4 w-4" />
                Unlink
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#0A4D66]/60 bg-[#001825] px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-[#0A4D66]/30 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!target || isLoading || target.id === current?.id}
              className="inline-flex items-center gap-2 rounded-md bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Icon icon="mdi:link-variant" className="h-4 w-4" />
              {isLoading ? "Linking…" : "Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
