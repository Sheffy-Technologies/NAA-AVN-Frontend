import { useMemo } from "react";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { useGetResidencesQuery, useSaveOccupancyMutation, useVacateOccupancyMutation, type Occupancy } from "../api";
import { allocateFields, stayFields, toPayload, vacateFields, valuesFrom } from "../accForms";
import { personName, today } from "../accommodationHelpers";
import { AccFormModal } from "./AccFormModal";

export type StayModal =
  | { kind: "allocate"; residenceId?: number; categoryId?: number }
  | { kind: "edit"; stay: Occupancy }
  | { kind: "vacate"; stay: Occupancy }
  | null;

const ALL_PERSONNEL = { branches: [], units: [], ranks: [], corps: [], specialties: [], status: [] };

/** Allocate a residence, correct a stay, or record someone moving out. */
export const StayModals = ({ modal, onClose }: { modal: StayModal; onClose: () => void }) => {
  const dispatch = useAppDispatch();
  const allocating = modal?.kind === "allocate";
  const { data: personnel = [] } = useGetPersonnelQuery(ALL_PERSONNEL, { skip: !allocating });
  const { data: residences = [] } = useGetResidencesQuery(
    allocating && modal.categoryId ? { accommodation_category_id: modal.categoryId } : undefined,
    { skip: !allocating },
  );
  const [save] = useSaveOccupancyMutation();
  const [vacate] = useVacateOccupancyMutation();

  const residenceOptions = useMemo(
    () =>
      residences
        .filter((r) => r.status === "available" && (r.active_occupancies_count < r.capacity || (allocating && r.id === modal.residenceId)))
        .map((r) => ({
          value: r.id,
          label: `${r.name} · ${r.block?.name ?? ""}`,
          description: `${r.block?.category?.name ?? ""} · ${r.apartment_type_label} · ${r.active_occupancies_count}/${r.capacity} occupied`,
        })),
    [residences, allocating, modal],
  );
  const personnelOptions = useMemo(
    () =>
      personnel.map((p) => ({
        value: p.id,
        label: `${(p as { rank?: { name?: string } | null }).rank?.name ?? ""} ${p.firstname} ${p.lastname}`.trim(),
        description: p.service_number ?? undefined,
      })),
    [personnel],
  );

  if (!modal) return null;
  const done = (message: string) => dispatch(showToast({ type: "success", message }));

  if (modal.kind === "allocate") {
    const fields = allocateFields(residenceOptions, personnelOptions);
    return (
      <AccFormModal
        title="Allocate residence"
        icon="mdi:key-plus"
        fields={fields}
        initial={valuesFrom(fields, null, { move_in_date: today(), residence_id: modal.residenceId ? String(modal.residenceId) : "" })}
        submitLabel="Allocate"
        onSubmit={async (values) => {
          await save({ data: toPayload(fields, values) }).unwrap();
          done("Residence allocated.");
        }}
        onClose={onClose}
      />
    );
  }

  const { stay } = modal;
  const who = `${personName(stay.personnel)} · ${stay.residence?.name ?? ""}`;

  if (modal.kind === "vacate") {
    return (
      <AccFormModal
        title="Record move-out"
        icon="mdi:exit-run"
        fields={vacateFields}
        initial={{ move_out_date: today(), vacate_remarks: "" }}
        submitLabel="Vacate"
        intro={<p className="opacity-80">{who} moved in on {stay.move_in_date.slice(0, 10)}. The stay is kept in the residence's history.</p>}
        onSubmit={async (values) => {
          await vacate({ id: stay.id, move_out_date: String(values.move_out_date), vacate_remarks: values.vacate_remarks ? String(values.vacate_remarks) : null }).unwrap();
          done("Move-out recorded.");
        }}
        onClose={onClose}
      />
    );
  }

  const fields = stayFields(stay.status === "vacated");
  return (
    <AccFormModal
      title="Edit stay"
      icon="mdi:home-edit-outline"
      fields={fields}
      initial={valuesFrom(fields, stay)}
      intro={<p className="opacity-80">{who}. To move someone to another residence, vacate this one and allocate the new one.</p>}
      onSubmit={async (values) => {
        await save({ id: stay.id, data: toPayload(fields, values) }).unwrap();
        done("Stay updated.");
      }}
      onClose={onClose}
    />
  );
};
