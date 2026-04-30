import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetUnitsQuery, useDeleteUnitMutation, type Unit } from "@/shared/api/units";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

type UnitRow = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export const UnitsPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetUnitsQuery();
  const [deleteUnit] = useDeleteUnitMutation();
  
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useClickOutside(
    actionsRef, 
    () => setActiveActionId(null), 
    activeActionId !== null
  );

  const units: UnitRow[] = useMemo(() => {
    if (!data) return [];

    return data.map((unit: Unit) => ({
      id: unit.id,
      name: unit.name,
      description: unit.description ?? "",
      createdAt: new Date(unit.created_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      updatedAt: new Date(unit.updated_at).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    }));
  }, [data]);

  const handleAddUnit = () => {
    navigate("/dashboard/units/add");
  };

  const handleActionClick = (id: number) => {
    setActiveActionId(activeActionId === id ? null : id);
  };

  const handleView = (id: number) => {
    navigate(`/dashboard/units/${id}`);
    setActiveActionId(null);
  };

  const handleEdit = (id: number) => {
    navigate(`/dashboard/units/${id}/edit`);
    setActiveActionId(null);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this unit?")) {
      await deleteUnit(id);
    }
    setActiveActionId(null);
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden min-h-[360px]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="flex items-center gap-3">
            <Icon
              icon="mdi:office-building"
              className="w-4 h-4 text-cyan-300"
            />
            <h1 className="text-sm sm:text-base font-semibold text-white uppercase tracking-wide">
              Units
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-300">
              <span className="px-2 py-1 rounded-full bg-[#001219] border border-[#0A4D66]/40">
                {units.length}
              </span>
              <span>Units</span>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded bg-[#0369A1] text-black text-xs sm:text-sm font-medium hover:bg-[#0369A1]/90 transition-colors"
              onClick={handleAddUnit}
            >
              <Icon icon="mdi:plus" className="w-4 h-4" />
              <span>Add Unit</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="min-w-full text-xs sm:text-sm text-gray-200">
            <thead>
              <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 sm:px-6 py-3 text-left">Unit Name</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && units.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 sm:px-6 py-6 text-center text-gray-400"
                  >
                    <div className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                      <span>Loading units...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 sm:px-6 py-6 text-center text-gray-400"
                  >
                    {isError ? "Failed to load units." : "No units available."}
                  </td>
                </tr>
              ) : (
                units.map((unit, index) => (
                  <tr
                    key={unit.id}
                    className={cn(
                      "border-t border-[#0A4D66]/40",
                      index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                    )}
                  >
                    <td className="px-4 sm:px-6 py-3 align-middle text-white">
                      {unit.name}
                    </td>
                    <td className="px-4 py-3 align-middle text-white">
                      {unit.description || "—"}
                    </td>
                    <td className="px-4 py-3 align-middle text-white">
                      {unit.createdAt}
                    </td>
                    <td className="px-4 py-3 align-middle text-white">
                      {unit.updatedAt}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-white">Active</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 align-middle text-right relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(unit.id);
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#0A4D66]/40 text-gray-300"
                      >
                        <Icon
                          icon="mdi:dots-vertical"
                          className="w-5 h-5"
                        />
                      </button>
                      {activeActionId === unit.id && (
                        <div
                          ref={actionsRef}
                          className="absolute right-8 top-0 w-32 bg-[#001825] border border-[#0A4D66] rounded-md shadow-lg z-10 overflow-hidden"
                        >
                          <button
                            onClick={() => handleView(unit.id)}
                            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#0A4D66]/40 flex items-center gap-2"
                          >
                            <Icon icon="mdi:eye" className="w-4 h-4" /> View
                          </button>
                          <button
                            onClick={() => handleEdit(unit.id)}
                            className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#0A4D66]/40 flex items-center gap-2"
                          >
                            <Icon icon="mdi:pencil" className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(unit.id)}
                            className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#0A4D66]/40 flex items-center gap-2"
                          >
                            <Icon icon="mdi:trash-can" className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

