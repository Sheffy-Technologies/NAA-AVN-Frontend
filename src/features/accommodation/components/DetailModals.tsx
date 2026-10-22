import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { PrimaryButton, SecondaryButton, SqStatus } from "@/features/safety/components/sqUi";
import { useSqPermissions } from "@/features/safety/components/sqHelpers";
import { useDeleteOccupancyMutation, useGetResidenceQuery, type Occupancy } from "../api";
import { OCCUPANCY_STATUS, STAY_STATUS, apiError, fmtDate, personName } from "../accommodationHelpers";
import type { StayModal } from "./StayModals";

const Shell = ({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) => {
  const { isDark } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full max-w-2xl rounded-xl border p-6 shadow-2xl my-8 text-xs",
          isDark ? "bg-[#001825] border-[#0A4D66] text-white" : "bg-white border-slate-200 text-slate-900",
        )}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b dark:border-slate-700">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A4D66] dark:text-[#7FD5FF] flex items-center gap-2">
            <Icon icon={icon} className="w-5 h-5" />
            {title}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Facts = ({ items }: { items: Array<[string, React.ReactNode]> }) => (
  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
    {items.map(([label, value]) => (
      <div key={label}>
        <dt className="opacity-60">{label}</dt>
        <dd className="font-semibold">{value || "–"}</dd>
      </div>
    ))}
  </dl>
);

/** One resident's stay, with edit / vacate / delete. */
export const ResidentDetailModal = ({ stay, onClose, onAction }: { stay: Occupancy; onClose: () => void; onAction: (m: StayModal) => void }) => {
  const dispatch = useAppDispatch();
  const { has } = useSqPermissions();
  const [remove, { isLoading: deleting }] = useDeleteOccupancyMutation();
  const p = stay.personnel;
  const r = stay.residence;
  const status = STAY_STATUS[stay.status];

  const onDelete = async () => {
    if (!window.confirm("Delete this stay? Only do this for an entry made in error; use Vacate when someone moves out.")) return;
    try {
      await remove(stay.id).unwrap();
      dispatch(showToast({ type: "success", message: "Stay deleted." }));
      onClose();
    } catch (err) {
      dispatch(showToast({ type: "error", message: apiError(err) }));
    }
  };

  return (
    <Shell title="Resident" icon="mdi:account-key-outline" onClose={onClose}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold">{personName(p)}</div>
          <div className="opacity-70">{[p?.service_number, p?.unit?.name].filter(Boolean).join(" · ")}</div>
        </div>
        <SqStatus value={status.tone} label={status.label} />
      </div>
      <Facts
        items={[
          ["Category", r?.block?.category?.name],
          ["Block", r?.block?.name],
          ["Residence", r?.name],
          ["Moved in", fmtDate(stay.move_in_date)],
          [stay.status === "vacated" ? "Moved out" : "Expected move-out", fmtDate(stay.status === "vacated" ? stay.move_out_date : stay.expected_move_out_date)],
          ["Dependants", stay.dependants ?? "–"],
          ["Allocation ref.", stay.allocation_reference],
          ["Phone", p?.phone_number],
          ["Allocated by", stay.allocator ? `${stay.allocator.firstname} ${stay.allocator.lastname}` : "–"],
        ]}
      />
      {stay.notes && <p className="mb-2"><span className="opacity-60">Notes: </span>{stay.notes}</p>}
      {stay.vacate_remarks && <p className="mb-2"><span className="opacity-60">Vacating remarks: </span>{stay.vacate_remarks}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t dark:border-slate-700">
        <div>
          {has("residence-occupancies.delete") && (
            <button type="button" disabled={deleting} onClick={onDelete} className="inline-flex items-center gap-1 text-red-500 font-semibold hover:underline">
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              Delete entry
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {has("residence-occupancies.update") && (
            <SecondaryButton icon="mdi:pencil-outline" onClick={() => onAction({ kind: "edit", stay })}>
              Edit
            </SecondaryButton>
          )}
          {has("residence-occupancies.update") && stay.status === "active" && (
            <PrimaryButton icon="mdi:exit-run" onClick={() => onAction({ kind: "vacate", stay })}>
              Vacate
            </PrimaryButton>
          )}
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        </div>
      </div>
    </Shell>
  );
};

/** A residence with its facts and every stay (current residents first). */
export const ResidenceDetailModal = ({
  residenceId,
  onClose,
  onAction,
  onOpenStay,
}: {
  residenceId: number;
  onClose: () => void;
  onAction: (m: StayModal) => void;
  onOpenStay: (stay: Occupancy) => void;
}) => {
  const { has } = useSqPermissions();
  const { data: r, isLoading } = useGetResidenceQuery(residenceId);
  const occ = r ? OCCUPANCY_STATUS[r.occupancy_status] : null;
  const hasRoom = r ? r.status === "available" && r.active_occupancies_count < r.capacity : false;

  return (
    <Shell title={r ? r.name : "Residence"} icon="mdi:home-city-outline" onClose={onClose}>
      {isLoading || !r ? (
        <p className="opacity-60 py-6 text-center">Loading…</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="opacity-80">{[r.block?.category?.name, r.block?.name, r.block?.location].filter(Boolean).join(" · ")}</div>
            {occ && <SqStatus value={occ.tone} label={occ.label} />}
          </div>
          <Facts
            items={[
              ["Type", r.apartment_type_label],
              ["Rooms", r.rooms ?? "–"],
              ["Bathrooms", r.bathrooms ?? "–"],
              ["Floor", r.floor],
              ["Occupants", `${r.active_occupancies_count} of ${r.capacity}`],
              ["Furnished", r.is_furnished ? "Yes" : "No"],
              ["Boys' quarters", r.has_boys_quarters ? "Yes" : "No"],
            ]}
          />
          {r.notes && <p className="mb-4"><span className="opacity-60">Notes: </span>{r.notes}</p>}

          <div className="font-semibold mb-2">Residents & history</div>
          {r.occupancies?.length ? (
            <ul className="divide-y dark:divide-slate-700 border rounded-lg dark:border-slate-700 mb-4">
              {r.occupancies.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenStay({
                        ...s,
                        residence: { id: r.id, name: r.name, accommodation_block_id: r.accommodation_block_id, apartment_type: r.apartment_type, rooms: r.rooms, capacity: r.capacity, status: r.status, block: r.block },
                      })
                    }
className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-white/5">
                    <span>
                      <span className="font-semibold">{personName(s.personnel)}</span>
                      <span className="opacity-70">
                        {" "}
                        · {fmtDate(s.move_in_date)} – {s.status === "vacated" ? fmtDate(s.move_out_date) : "present"}
                      </span>
                    </span>
                    <SqStatus value={STAY_STATUS[s.status].tone} label={STAY_STATUS[s.status].label} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="opacity-60 mb-4">Nobody has been allocated this residence yet.</p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-700">
            {has("residence-occupancies.create") && hasRoom && (
              <PrimaryButton icon="mdi:key-plus" onClick={() => onAction({ kind: "allocate", residenceId: r.id })}>
                Allocate
              </PrimaryButton>
            )}
            <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          </div>
        </>
      )}
    </Shell>
  );
};
