import { useMemo, useState } from "react";
import Modal from "@/shared/ui/modal/Modal";
import { SearchableSelect, type SearchableSelectOption } from "@/shared/ui/select/SearchableSelect";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { assetsApi, useGetAssetsQuery } from "@/features/assets/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import {
  useCreateDefectMutation,
  type CreateMaintenanceDefectRequest,
} from "@/features/maintenance/api";

const PERSONNEL_FILTERS = {
  branches: [],
  units: [],
  ranks: [],
  corps: [],
  specialties: [],
  status: [],
};

const SEVERITIES: Array<NonNullable<CreateMaintenanceDefectRequest["severity"]>> = [
  "low",
  "medium",
  "high",
  "critical",
];

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  asset_id: null as number | null,
  title: "",
  description: "",
  severity: "medium" as NonNullable<CreateMaintenanceDefectRequest["severity"]>,
  reported_by: null as number | null,
  reported_at: today(),
  reported_hours: "",
  remarks: "",
});

const inputCls =
  "w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]";

type CreateDefectModalProps = {
  open: boolean;
  onClose: () => void;
};

export const CreateDefectModal = ({ open, onClose }: CreateDefectModalProps) => {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: assets = [], isLoading: isAssetsLoading } = useGetAssetsQuery(undefined, {
    skip: !open,
  });
  const { data: personnel = [], isLoading: isPersonnelLoading } = useGetPersonnelQuery(
    PERSONNEL_FILTERS,
    { skip: !open },
  );
  const [createDefectRecord, { isLoading: isSaving }] = useCreateDefectMutation();

  const assetOptions: SearchableSelectOption[] = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.id,
        label: asset.tail_number ? `${asset.name} (${asset.tail_number})` : asset.name,
        description: [asset.type, asset.serial_number].filter(Boolean).join(" · "),
      })),
    [assets],
  );

  const personnelOptions: SearchableSelectOption[] = useMemo(
    () =>
      personnel.map((person) => ({
        value: person.id,
        label:
          [person.rank?.name, person.firstname, person.lastname]
            .filter(Boolean)
            .join(" ") || `Personnel #${person.id}`,
        description: person.service_number || undefined,
      })),
    [personnel],
  );

  const handleClose = () => {
    setForm(emptyForm());
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.asset_id) {
      setError("Select the asset this defect was found on.");
      return;
    }
    if (!form.title.trim()) {
      setError("Enter a title for the defect.");
      return;
    }

    const reportedHours = form.reported_hours.trim() === "" ? null : Number(form.reported_hours);
    if (reportedHours !== null && (!Number.isFinite(reportedHours) || reportedHours < 0)) {
      setError("Reported hours must be a positive number.");
      return;
    }

    try {
      await createDefectRecord({
        asset_id: form.asset_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        severity: form.severity,
        status: "open",
        reported_by: form.reported_by,
        reported_at: form.reported_at || null,
        reported_hours: reportedHours,
        remarks: form.remarks.trim() || null,
      }).unwrap();

      // The asset details page reads defects off the asset, which lives in a separate API cache.
      dispatch(assetsApi.util.invalidateTags([{ type: "Assets", id: form.asset_id }]));
      dispatch(showToast({ message: "Defect logged successfully", type: "success" }));
      handleClose();
    } catch (err: unknown) {
      const responseError = err as { data?: { message?: string } };
      setError(responseError?.data?.message || "Failed to log defect.");
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Log New Defect" className="max-w-2xl!">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <SearchableSelect
          label="Asset *"
          placeholder={isAssetsLoading ? "Loading assets..." : "Select asset"}
          searchPlaceholder="Search by name or tail number..."
          options={assetOptions}
          value={form.asset_id}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, asset_id: value === null ? null : Number(value) }))
          }
          disabled={isAssetsLoading}
        />

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Title *</label>
          <input
            type="text"
            className={inputCls}
            placeholder="e.g. Hydraulic leak on left main gear"
            value={form.title}
            maxLength={255}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Description</label>
          <textarea
            rows={3}
            className={inputCls}
            placeholder="Describe the defect"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Severity</label>
            <select
              title="Severity"
              className={`${inputCls} capitalize`}
              value={form.severity}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  severity: e.target.value as typeof prev.severity,
                }))
              }
            >
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Reported On</label>
            <input
              type="date"
              title="Reported on"
              className={inputCls}
              value={form.reported_at}
              onChange={(e) => setForm((prev) => ({ ...prev, reported_at: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Reported At (Hours)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              className={inputCls}
              placeholder="Airframe hours"
              value={form.reported_hours}
              onChange={(e) => setForm((prev) => ({ ...prev, reported_hours: e.target.value }))}
            />
          </div>
        </div>

        <SearchableSelect
          label="Reported By"
          placeholder={isPersonnelLoading ? "Loading personnel..." : "Select personnel (optional)"}
          searchPlaceholder="Search by name or service number..."
          options={personnelOptions}
          value={form.reported_by}
          onChange={(value) =>
            setForm((prev) => ({ ...prev, reported_by: value === null ? null : Number(value) }))
          }
          disabled={isPersonnelLoading}
        />

        <div className="space-y-1">
          <label className="text-xs text-gray-400">Remarks</label>
          <input
            type="text"
            className={inputCls}
            placeholder="Optional remarks"
            value={form.remarks}
            maxLength={255}
            onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-[#0A4D66]/50 px-4 py-2 text-sm text-gray-300 hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded bg-[#0369A1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1]/90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Log Defect"}
          </button>
        </div>
      </form>
    </Modal>
  );
};
