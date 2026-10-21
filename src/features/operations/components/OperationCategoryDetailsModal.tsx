import React from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import Modal from "@/shared/ui/modal/Modal";
import { useGetOperationCategoryByIdQuery } from "../api";
import { cn } from "@/shared/utils/cn";

interface OperationCategoryDetailsModalProps {
  open: boolean;
  onClose: () => void;
  categoryId: number | null;
  onFilterInMissionsTab?: (categoryId: number) => void;
}

const statusBadgeColor: Record<string, { bg: string; dot: string; text: string }> = {
  planned: { bg: "bg-blue-500/10 border-blue-500/30", dot: "bg-blue-400", text: "text-blue-300" },
  completed: { bg: "bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400", text: "text-emerald-300" },
  ongoing: { bg: "bg-amber-500/10 border-amber-500/30", dot: "bg-amber-400", text: "text-amber-300" },
  aborted: { bg: "bg-red-500/10 border-red-500/30", dot: "bg-red-400", text: "text-red-300" },
};

export const OperationCategoryDetailsModal: React.FC<OperationCategoryDetailsModalProps> = ({
  open,
  onClose,
  categoryId,
  onFilterInMissionsTab,
}) => {
  const navigate = useNavigate();

  const { data: category, isLoading } = useGetOperationCategoryByIdQuery(
    categoryId ?? 0,
    { skip: !categoryId || !open },
  );

  const missions = category?.operations ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `Operation: ${category.name}` : "Operation Details"}
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Icon icon="mdi:loading" className="w-8 h-8 animate-spin mr-2 text-[#7FD5FF]" />
            <span>Loading operation details...</span>
          </div>
        ) : category ? (
          <>
            {/* Header / Mandate Overview */}
            <div className="rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#0A4D66]/30 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#7FD5FF] block">
                    Strategic Operational Mandate
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-wide mt-0.5">
                    {category.name}
                  </h3>
                </div>
                {onFilterInMissionsTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onFilterInMissionsTab(category.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0A4D66]/60 border border-[#0A4D66] text-xs font-semibold text-[#7FD5FF] hover:text-white hover:bg-[#0A4D66] transition-colors"
                  >
                    <Icon icon="mdi:filter-outline" className="w-4 h-4" />
                    <span>Filter In Missions Tab</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                {category.description || (
                  <span className="italic text-gray-500">
                    No operational description or mandate recorded for this theater command.
                  </span>
                )}
              </p>

              {/* Status Breakdown Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                <div className="rounded-lg bg-[#001825] p-2.5 border border-[#0A4D66]/20">
                  <span className="text-gray-400 text-[10px] uppercase font-semibold block">
                    Total Missions
                  </span>
                  <span className="text-white font-bold text-base mt-0.5 block">
                    {category.operations_count ?? missions.length}
                  </span>
                </div>
                <div className="rounded-lg bg-[#001825] p-2.5 border border-emerald-500/20">
                  <span className="text-emerald-400 text-[10px] uppercase font-semibold block">
                    Completed
                  </span>
                  <span className="text-white font-bold text-base mt-0.5 block">
                    {category.completed_count ??
                      missions.filter((m) => m.status === "completed").length}
                  </span>
                </div>
                <div className="rounded-lg bg-[#001825] p-2.5 border border-amber-500/20">
                  <span className="text-amber-400 text-[10px] uppercase font-semibold block">
                    Ongoing
                  </span>
                  <span className="text-white font-bold text-base mt-0.5 block">
                    {category.ongoing_count ??
                      missions.filter((m) => m.status === "ongoing").length}
                  </span>
                </div>
                <div className="rounded-lg bg-[#001825] p-2.5 border border-blue-500/20">
                  <span className="text-blue-400 text-[10px] uppercase font-semibold block">
                    Planned
                  </span>
                  <span className="text-white font-bold text-base mt-0.5 block">
                    {category.planned_count ??
                      missions.filter((m) => m.status === "planned").length}
                  </span>
                </div>
              </div>
            </div>

            {/* Child Missions Sub-Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                  <Icon icon="mdi:format-list-bulleted" className="w-4 h-4 text-[#7FD5FF]" />
                  <span>Missions Under This Operation ({missions.length})</span>
                </h4>
              </div>

              {missions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#0A4D66]/40 bg-[#001825]/40 p-8 text-center space-y-2">
                  <Icon
                    icon="mdi:airplane-off"
                    className="w-10 h-10 text-gray-500 mx-auto"
                  />
                  <div className="text-sm font-semibold text-white">
                    No Missions Assigned Yet
                  </div>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    No flight sorties or missions have been assigned to {category.name}. When creating a new mission, select this operation from the dropdown.
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-xl border border-[#0A4D66]/40 bg-[#001219]">
                  <table className="w-full text-left text-xs text-gray-200">
                    <thead className="sticky top-0 bg-[#001825] uppercase text-[10px] tracking-wider text-gray-400 border-b border-[#0A4D66]/30">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Mission / Code</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Command Unit</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A4D66]/20">
                      {missions.map((mission) => {
                        const badge =
                          statusBadgeColor[mission.status] || statusBadgeColor.planned;
                        const dateFormatted = mission.start_date_time
                          ? new Date(mission.start_date_time).toLocaleDateString()
                          : "—";

                        return (
                          <tr
                            key={mission.id}
                            className="hover:bg-[#0A4D66]/15 transition-colors"
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap text-gray-300">
                              {dateFormatted}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-white">
                              {mission.name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-300">
                              {mission.operation_type?.name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-300">
                              {mission.unit?.name || "—"}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider",
                                  badge.bg,
                                  badge.text,
                                )}
                              >
                                <span className={cn("w-1.5 h-1.5 rounded-full", badge.dot)} />
                                {mission.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  navigate(`/dashboard/operations/${mission.id}`);
                                }}
                                className="inline-flex items-center gap-1 text-[#7FD5FF] hover:text-white font-semibold transition-colors"
                                title="View Mission Details"
                              >
                                <span>Inspect</span>
                                <Icon icon="mdi:arrow-right" className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-[#0A4D66]/20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded bg-[#0A4D66]/50 border border-[#0A4D66]/60 text-xs font-semibold text-white hover:bg-[#0A4D66] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
