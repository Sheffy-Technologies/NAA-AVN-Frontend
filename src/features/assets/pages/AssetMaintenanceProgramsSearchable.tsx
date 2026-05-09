import { useState, useMemo } from "react";
import { type NavigateFunction } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { type MaintenanceProgram } from "@/features/maintenance/api";

type AssetMaintenanceProgramsSearchableProps = {
  maintenancePrograms: MaintenanceProgram[];
  selectedProgramIds: Set<number>;
  handleToggleProgramSelection: (programId: number) => void;
  handleSelectAllPrograms: () => void;
  handleDeselectAllPrograms: () => void;
  handleCreateWorkOrder: () => void;
  isCreatingWorkOrder: boolean;
  navigate: NavigateFunction;
};

export default function AssetMaintenanceProgramsSearchable({
  maintenancePrograms,
  selectedProgramIds,
  handleToggleProgramSelection,
  handleSelectAllPrograms,
  handleDeselectAllPrograms,
  handleCreateWorkOrder,
  isCreatingWorkOrder,
  navigate,
}: AssetMaintenanceProgramsSearchableProps) {
  const [search, setSearch] = useState("");

  const filteredPrograms = useMemo(() => {
    if (!search.trim()) return maintenancePrograms;
    const q = search.toLowerCase();
    return maintenancePrograms.filter(
      (p: MaintenanceProgram) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        (p.applicability?.toLowerCase().includes(q) ?? false),
    );
  }, [maintenancePrograms, search]);

  return (
    <div className="space-y-3">
      <input
        className="w-full mb-2 rounded border border-gray-700 bg-[#001219] px-3 py-2 text-sm text-white"
        placeholder="Search tasks by name, description, or type..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {/* Select All / Deselect All + Create CTA */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#0A4D66]/30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllPrograms}
            className="text-xs text-[#7FD5FF] hover:underline"
          >
            Select all
          </button>
          <span className="text-gray-400 text-xs">|</span>
          <button
            type="button"
            onClick={handleDeselectAllPrograms}
            className="text-xs text-gray-400 hover:underline"
          >
            Deselect all
          </button>
          {selectedProgramIds.size > 0 && (
            <span className="text-xs text-gray-400">
              {selectedProgramIds.size} selected
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate("/dashboard/maintenance/planning")}
            className="text-xs text-emerald-400 border border-emerald-400 rounded px-2 py-1 ml-2 hover:bg-emerald-900/20"
          >
            + Add Task
          </button>
        </div>
        <button
          type="button"
          onClick={handleCreateWorkOrder}
          disabled={selectedProgramIds.size === 0 || isCreatingWorkOrder}
          className="inline-flex items-center gap-2 rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon
            icon={isCreatingWorkOrder ? "mdi:loading" : "mdi:file-document-plus-outline"}
            className={cn("w-4 h-4", isCreatingWorkOrder ? "animate-spin" : "")}
          />
          {isCreatingWorkOrder
            ? "Creating..."
            : selectedProgramIds.size > 0
            ? `Create Work Order (${selectedProgramIds.size} task${selectedProgramIds.size > 1 ? "s" : ""})`
            : "Create Work Order"}
        </button>
      </div>
      {filteredPrograms.length === 0 ? (
        <div className="text-gray-400">No maintenance programs found for the selected filters.</div>
      ) : (
        filteredPrograms.map((program: MaintenanceProgram) => (
          <div
            key={program.id}
            className={cn(
              "rounded-lg border p-4 flex items-start gap-3 cursor-pointer transition-colors",
              selectedProgramIds.has(program.id)
                ? "border-[#7FD5FF]/40 bg-[#0A4D66]/20"
                : "border-[#0A4D66]/30 bg-[#001825] hover:border-[#0A4D66]/60",
            )}
            onClick={() => handleToggleProgramSelection(program.id)}
          >
            {/* Checkbox */}
            <div className="mt-0.5 shrink-0">
              <div
                className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                  selectedProgramIds.has(program.id)
                    ? "bg-[#0369A1] border-[#7FD5FF]"
                    : "border-gray-500 bg-transparent",
                )}
              >
                {selectedProgramIds.has(program.id) && (
                  <Icon icon="mdi:check" className="w-3 h-3 text-[#001219]" />
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {program.name}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Applicability: {program.applicability}
                {program.interval_hours != null
                  ? ` | Interval: ${program.interval_hours} hrs`
                  : ""}
                {program.interval_months != null
                  ? ` | ${program.interval_months} months`
                  : ""}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
