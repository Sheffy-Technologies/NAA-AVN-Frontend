import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch } from "@/app/store";
import { useGetOperationsQuery } from "@/features/operations/api";
import { useGetPersonnelQuery } from "@/features/personnel/api";
import { showToast } from "@/shared/store/toastSlice";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/shared/ui/multi-select/MultiSelect";
import {
  type CreateDefectPayload,
  useCreateDefectMutation,
  useGetAssetByIdQuery,
} from "../api";

export const AddAssetDefectPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const assetId = Number(id);
  const canLoad = Number.isFinite(assetId) && assetId > 0;

  const { data: asset, isLoading } = useGetAssetByIdQuery(assetId, {
    skip: !canLoad,
  });
  const [createDefect, { isLoading: isSaving }] = useCreateDefectMutation();
  const { data: operations = [] } = useGetOperationsQuery();
  const { data: engineers = [] } = useGetPersonnelQuery({
    branches: [],
    units: [],
    ranks: [],
    corps: [],
    specialties: [],
    status: [],
  });

  const engineerOptions: MultiSelectOption[] = useMemo(
    () =>
      engineers.map((p) => ({
        value: p.id,
        label: `${p.rank?.name ? `${p.rank.name} ` : ""}${p.firstname} ${p.lastname}`.trim(),
      })),
    [engineers],
  );

  const [defect, setDefect] = useState({
    defect_reported: "",
    date_of_defect: "",
    operation_id: "",
    defect_description: "",
    remark: "",
    rectified: false,
    rectification_details: "",
    inspection_name: "",
    work_done: "",
    certifying_engineers: [] as number[],
  });

  const handleSubmit = async () => {
    if (!canLoad) return;

    if (!defect.defect_reported && !defect.defect_description) {
      dispatch(
        showToast({
          message: "Please provide defect details",
          type: "error",
        }),
      );
      return;
    }

    const personnel = defect.certifying_engineers
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    const maintenanceEvents = defect.rectified
      ? [
          {
            inspection_name:
              defect.inspection_name || defect.rectification_details || "Rectification",
            work_done: defect.work_done || defect.rectification_details,
          },
        ]
      : undefined;

    try {
      const payload: CreateDefectPayload = {
        asset_id: assetId,
        title: defect.defect_reported || defect.defect_description,
        description: defect.defect_description || defect.defect_reported,
        remarks: defect.remark,
        personnel_ids: personnel,
        maintenance_events: maintenanceEvents,
      };

      if (defect.operation_id) {
        payload.operation_id = Number(defect.operation_id);
      }

      await createDefect(payload).unwrap();

      dispatch(
        showToast({
          message: "Defect reported successfully",
          type: "success",
        }),
      );
      navigate("/dashboard/maintenance/defects");
    } catch {
      dispatch(
        showToast({
          message: "Failed to report defect",
          type: "error",
        }),
      );
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading asset...</div>;
  }

  if (!asset) {
    return <div className="p-8 text-center text-red-400">Asset not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#00090D] text-white p-6 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-[#0A4D66]/40 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-white">
              Report Defect / Snag
            </h1>
            <p className="text-xs text-gray-400 mt-1">{asset.name}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 border border-[#0A4D66]/40 px-3 py-2 rounded text-sm text-gray-300 hover:text-white hover:bg-[#0A4D66]/20"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            Back
          </button>
        </div>

        <div className="bg-[#001219] p-6 rounded-xl border border-[#0A4D66]/40 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Defect Reported</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Defect"
                value={defect.defect_reported}
                onChange={(e) =>
                  setDefect((prev) => ({ ...prev, defect_reported: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Date of defect</label>
              <input
                type="date"
                title="Date of defect"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={defect.date_of_defect}
                onChange={(e) =>
                  setDefect((prev) => ({ ...prev, date_of_defect: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Operation</label>
              <select
                title="Operation"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                value={defect.operation_id}
                onChange={(e) =>
                  setDefect((prev) => ({ ...prev, operation_id: e.target.value }))
                }
              >
                <option value="">Select Operation</option>
                {operations.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Location removed per requirement */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Defect Description</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Description"
                value={defect.defect_description}
                onChange={(e) =>
                  setDefect((prev) => ({ ...prev, defect_description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Remark</label>
              <input
                type="text"
                className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                placeholder="Enter Remark"
                value={defect.remark}
                onChange={(e) => setDefect((prev) => ({ ...prev, remark: e.target.value }))}
              />
            </div>
          </div>

          {/*
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-white">Rectified?</span>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="radio"
                name="rectified"
                checked={defect.rectified}
                onChange={() => setDefect((prev) => ({ ...prev, rectified: true }))}
                className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
              />
              Yes
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="radio"
                name="rectified"
                checked={!defect.rectified}
                onChange={() => setDefect((prev) => ({ ...prev, rectified: false }))}
                className="text-[#7FD5FF] focus:ring-[#7FD5FF]"
              />
              No
            </label>
          </div>
          */}

          {defect.rectified && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Rectification Details</label>
                <input
                  type="text"
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                  placeholder="Enter Details"
                  value={defect.rectification_details}
                  onChange={(e) =>
                    setDefect((prev) => ({
                      ...prev,
                      rectification_details: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Inspection Name</label>
                <input
                  type="text"
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                  placeholder="Enter Inspection Name"
                  value={defect.inspection_name}
                  onChange={(e) =>
                    setDefect((prev) => ({
                      ...prev,
                      inspection_name: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="col-span-3 space-y-1">
                  <label className="text-xs text-gray-400">Work Done</label>
                  <input
                    type="text"
                    className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7FD5FF]"
                    placeholder="Enter Work Done"
                    value={defect.work_done}
                    onChange={(e) =>
                      setDefect((prev) => ({ ...prev, work_done: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <MultiSelect
                    label="Certifying Engineers"
                    placeholder="Select Engineers"
                    options={engineerOptions}
                    selectedValues={defect.certifying_engineers}
                    onChange={(selected) =>
                      setDefect((prev) => ({
                        ...prev,
                        certifying_engineers: selected
                          .map((value) => Number(value))
                          .filter((value) => Number.isFinite(value) && value > 0),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 bg-[#7FD5FF] hover:bg-[#7FD5FF]/90 disabled:opacity-60 text-[#00090D] px-6 py-2 rounded text-sm font-bold transition-colors"
            >
              <Icon icon="mdi:check" className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Defect"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
