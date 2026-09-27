import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import {
  useCreateMaintenanceProgramMutation,
  useDeleteMaintenanceProgramMutation,
  useGetMaintenanceProgramsQuery,
  useUpdateMaintenanceProgramMutation,
  type MaintenanceProgram,
} from "@/features/maintenance/api";
import { useGetAssetsQuery, useGetAtaChaptersQuery } from "@/features/assets/api";

type ProgramFormState = {
  name: string;
  category: "scheduled" | "airworthiness_directive" | "service_bulletin";
  reference_number: string;
  description: string;
  applicability: "component" | "engine" | "avionics";
  interval_type: "hours" | "cycles" | "calendar";
  interval_hours: string;
  interval_cycles: string;
  interval_months: string;
  ata_chapter_id: string;
  asset_id: string;
};

const initialFormState: ProgramFormState = {
  name: "",
  category: "scheduled",
  reference_number: "",
  description: "",
  applicability: "component",
  interval_type: "hours",
  interval_hours: "",
  interval_cycles: "",
  interval_months: "",
  ata_chapter_id: "",
  asset_id: "",
};

const CATEGORY_LABELS: Record<ProgramFormState["category"], string> = {
  scheduled: "Scheduled Maintenance",
  airworthiness_directive: "Airworthiness Directive",
  service_bulletin: "Service Bulletin",
};

const toNullableNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toProgramFormState = (program: MaintenanceProgram): ProgramFormState => ({
  name: program.name || "",
  category: program.category || "scheduled",
  reference_number: program.reference_number || "",
  description: program.description || "",
  applicability: program.applicability || "component",
  interval_type: program.interval_type || "hours",
  interval_hours:
    program.interval_hours !== null && program.interval_hours !== undefined
      ? String(program.interval_hours)
      : "",
  interval_cycles:
    program.interval_cycles !== null && program.interval_cycles !== undefined
      ? String(program.interval_cycles)
      : "",
  interval_months:
    program.interval_months !== null && program.interval_months !== undefined
      ? String(program.interval_months)
      : "",
  ata_chapter_id:
    program.ata_chapter_id !== null && program.ata_chapter_id !== undefined
      ? String(program.ata_chapter_id)
      : "",
  asset_id:
    program.asset_id !== null && program.asset_id !== undefined
      ? String(program.asset_id)
      : "",
});

export const MaintenanceProgramsCrudPage = () => {
  const navigate = useNavigate();

  const { data: programs = [], isLoading: isProgramsLoading } = useGetMaintenanceProgramsQuery();
  const { data: ataChapters = [] } = useGetAtaChaptersQuery();
  const { data: assets = [] } = useGetAssetsQuery({ type: "aircraft" });

  const [createMaintenanceProgram, { isLoading: isCreating }] =
    useCreateMaintenanceProgramMutation();
  const [updateMaintenanceProgram, { isLoading: isUpdating }] =
    useUpdateMaintenanceProgramMutation();
  const [deleteMaintenanceProgram, { isLoading: isDeleting }] =
    useDeleteMaintenanceProgramMutation();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProgramFormState>(initialFormState);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const isSaving = isCreating || isUpdating;

  const filteredPrograms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return programs;

    return programs.filter((program) => {
      return (
        program.name.toLowerCase().includes(query) ||
        (program.description || "").toLowerCase().includes(query) ||
        (program.applicability || "").toLowerCase().includes(query) ||
        (program.reference_number || "").toLowerCase().includes(query)
      );
    });
  }, [programs, search]);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialFormState);
  };

  const handleChange = <K extends keyof ProgramFormState>(key: K, value: ProgramFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (program: MaintenanceProgram) => {
    setFeedback(null);
    setEditingId(program.id);
    setForm(toProgramFormState(program));
  };

  const handleDelete = async (programId: number) => {
    setFeedback(null);
    const confirmed = window.confirm("Delete this maintenance program?");
    if (!confirmed) return;

    try {
      await deleteMaintenanceProgram(programId).unwrap();
      setFeedback({ type: "success", message: "Maintenance program deleted." });

      if (editingId === programId) {
        resetForm();
      }
    } catch {
      setFeedback({ type: "error", message: "Failed to delete maintenance program." });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!form.name.trim()) {
      setFeedback({ type: "error", message: "Program name is required." });
      return;
    }

    const ataChapterId = Number(form.ata_chapter_id);
    if (!ataChapterId || Number.isNaN(ataChapterId)) {
      setFeedback({ type: "error", message: "ATA Chapter is required." });
      return;
    }

    const payload = {
      ata_chapter_id: ataChapterId,
      name: form.name.trim(),
      category: form.category,
      reference_number: form.reference_number.trim() || null,
      description: form.description.trim() || null,
      asset_id: toNullableNumber(form.asset_id),
      interval_hours: toNullableNumber(form.interval_hours),
      interval_cycles: toNullableNumber(form.interval_cycles),
      interval_months: toNullableNumber(form.interval_months),
      applicability: form.applicability,
      interval_type: form.interval_type,
    };

    try {
      if (editingId) {
        await updateMaintenanceProgram({ id: editingId, ...payload }).unwrap();
        setFeedback({ type: "success", message: "Maintenance program updated." });
      } else {
        await createMaintenanceProgram(payload).unwrap();
        setFeedback({ type: "success", message: "Maintenance program created." });
      }
      resetForm();
    } catch {
      setFeedback({ type: "error", message: "Failed to save maintenance program." });
    }
  };

  return (
    <div className="min-h-screen bg-[#001219] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate("/dashboard/maintenance/planning")}
          className="flex items-center gap-2 text-[#7FD5FF] hover:text-white transition-colors"
        >
          <Icon icon="mdi:arrow-left" className="w-4 h-4" />
          Back to Maintenance Planning
        </button>

        {feedback ? (
          <div
            className={[
              "rounded-lg border px-4 py-3 text-sm",
              feedback.type === "success"
                ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-200"
                : "border-red-500/40 bg-red-900/20 text-red-200",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <section className="lg:col-span-3 bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h1 className="text-sm font-bold text-[#7FD5FF] uppercase">
                Maintenance Programs
              </h1>
              <input
                className="rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                placeholder="Search programs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isProgramsLoading ? (
              <div className="text-gray-400">Loading maintenance programs...</div>
            ) : filteredPrograms.length === 0 ? (
              <div className="text-gray-400">No maintenance programs found.</div>
            ) : (
              <div className="space-y-3">
                {filteredPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="rounded-lg border border-[#0A4D66]/30 bg-[#001825] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{program.name}</span>
                          {program.category && program.category !== "scheduled" && (
                            <span
                              className={
                                program.category === "airworthiness_directive"
                                  ? "rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300"
                                  : "rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                              }
                            >
                              {CATEGORY_LABELS[program.category]}
                              {program.reference_number ? ` · ${program.reference_number}` : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {program.description || "No description"}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          Applicability: <span className="capitalize">{program.applicability || "-"}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Interval: {program.interval_type || "-"}
                          {program.interval_hours ? `, ${program.interval_hours} hrs` : ""}
                          {program.interval_cycles ? `, ${program.interval_cycles} cycles` : ""}
                          {program.interval_months ? `, ${program.interval_months} months` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(program)}
                          className="rounded border border-[#7FD5FF]/50 px-3 py-1.5 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(program.id)}
                          disabled={isDeleting}
                          className="rounded border border-red-500/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/20 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-2 bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#7FD5FF] uppercase">
                {editingId ? "Edit Task Program" : "Add Task Program"}
              </h2>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-gray-300 hover:text-white"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <input
                className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                placeholder="Program name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  title="Category"
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  value={form.category}
                  onChange={(e) =>
                    handleChange("category", e.target.value as ProgramFormState["category"])
                  }
                >
                  <option value="scheduled">Scheduled Maintenance</option>
                  <option value="airworthiness_directive">Airworthiness Directive</option>
                  <option value="service_bulletin">Service Bulletin</option>
                </select>
                <input
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  placeholder="Reference # (e.g. AD 2024-12-05)"
                  value={form.reference_number}
                  onChange={(e) => handleChange("reference_number", e.target.value)}
                  disabled={form.category === "scheduled"}
                />
              </div>

              <textarea
                className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                rows={3}
                placeholder="Description"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />

              <select
                title="ATA Chapter"
                className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                value={form.ata_chapter_id}
                onChange={(e) => handleChange("ata_chapter_id", e.target.value)}
                required
              >
                <option value="">Select ATA chapter</option>
                {ataChapters.map((chapter) => (
                  <option key={chapter.id} value={String(chapter.id)}>
                    {chapter.chapter_number || chapter.name || `ATA ${chapter.id}`}
                  </option>
                ))}
              </select>

              <select
                title="Asset"
                className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                value={form.asset_id}
                onChange={(e) => handleChange("asset_id", e.target.value)}
              >
                <option value="">All assets (optional)</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={String(asset.id)}>
                    {asset.name || `Asset #${asset.id}`}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <select
                  title="Applicability"
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  value={form.applicability}
                  onChange={(e) =>
                    handleChange(
                      "applicability",
                      e.target.value as ProgramFormState["applicability"],
                    )
                  }
                >
                  <option value="component">Component</option>
                  <option value="engine">Engine</option>
                  <option value="avionics">Avionics</option>
                </select>

                <select
                  title="Interval Type"
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  value={form.interval_type}
                  onChange={(e) =>
                    handleChange(
                      "interval_type",
                      e.target.value as ProgramFormState["interval_type"],
                    )
                  }
                >
                  <option value="hours">Hours</option>
                  <option value="cycles">Cycles</option>
                  <option value="calendar">Calendar</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  placeholder="Interval hours"
                  value={form.interval_hours}
                  onChange={(e) => handleChange("interval_hours", e.target.value)}
                />
                <input
                  type="number"
                  min={0}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  placeholder="Interval cycles"
                  value={form.interval_cycles}
                  onChange={(e) => handleChange("interval_cycles", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded border border-[#0A4D66]/50 bg-[#001825] px-3 py-2 text-sm text-white"
                  placeholder="Interval months"
                  value={form.interval_months}
                  onChange={(e) => handleChange("interval_months", e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded border border-emerald-400 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-900/20 transition-colors disabled:opacity-60"
              >
                {isSaving
                  ? editingId
                    ? "Updating..."
                    : "Creating..."
                  : editingId
                    ? "Update Program"
                    : "Create Program"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceProgramsCrudPage;