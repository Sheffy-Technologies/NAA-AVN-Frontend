import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { BackButton } from "@/shared/ui/button/BackButton";
import { useDeleteVehicleMutation, useGetVehicleByIdQuery } from "@/features/assets/api";
import { fmtVehicleDate, vehicleRegisterRow, vehicleStatusLabel, vehicleStatusTone } from "@/features/assets/vehicleHelpers";

/** /dashboard/assets/vehicles/:id — one vehicle's register entry and where it has been used. */
export const VehicleDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const vehicleId = Number(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const permissions = useAppSelector((state) => state.auth.user?.permissions ?? []);
  const { data: vehicle, isLoading, isError } = useGetVehicleByIdQuery(vehicleId, { skip: !vehicleId });
  const [deleteVehicle, { isLoading: isDeleting }] = useDeleteVehicleMutation();

  if (!vehicleId) return <div className="p-10 text-center text-sm text-red-300">Invalid vehicle ID.</div>;
  if (isLoading) return <div className="p-10 text-center text-sm text-gray-400">Loading vehicle…</div>;
  if (isError || !vehicle) return <div className="p-10 text-center text-sm text-gray-400">Vehicle not found.</div>;

  const tone = vehicleStatusTone(vehicle.status);
  const register = vehicleRegisterRow(vehicle);
  const reports = vehicle.after_action_reports ?? [];
  const photo = vehicle.photo_url || vehicle.photo;

  const details: Array<[string, string]> = [
    ...(Object.entries(register).filter(([label]) => label !== "Status") as Array<[string, string]>),
    ["Unit", vehicle.unit?.name ?? "-"],
    ...(vehicle.serial_number && vehicle.serial_number !== vehicle.chassis_number
      ? ([["Serial Number", vehicle.serial_number]] as Array<[string, string]>)
      : []),
    ["Added", fmtVehicleDate(vehicle.created_at)],
  ];

  const remove = async () => {
    if (!window.confirm(`Delete ${vehicle.name} (${vehicle.registration_number})?`)) return;
    try {
      await deleteVehicle(vehicle.id).unwrap();
      dispatch(showToast({ type: "success", message: "Vehicle deleted." }));
      navigate("/dashboard/assets?tab=vehicle");
    } catch {
      dispatch(showToast({ type: "error", message: "The vehicle could not be deleted." }));
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton fallbackUrl="/dashboard/assets?tab=vehicle" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-white uppercase tracking-wide truncate">{vehicle.name}</h1>
            <div className="text-xs text-gray-400">{vehicle.registration_number}</div>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-[#0A4D66]/40 px-2.5 py-1 text-xs", tone.text)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot)} />
            {vehicleStatusLabel(vehicle.status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {permissions.includes("vehicles.update") && (
            <button
              type="button"
              onClick={() => navigate(`/dashboard/assets/vehicles/${vehicle.id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#0369A1] text-white hover:bg-[#0369A1]/90"
            >
              <Icon icon="mdi:pencil-outline" className="w-4 h-4" />
              Edit
            </button>
          )}
          {permissions.includes("vehicles.delete") && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void remove()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-red-500/50 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Icon icon="mdi:trash-can-outline" className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-4 sm:p-6 grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="h-48 md:h-full min-h-48 rounded-lg border border-[#0A4D66]/25 bg-[#001825] overflow-hidden flex items-center justify-center">
          {photo ? (
            <img src={photo} alt={vehicle.name} className="w-full h-full object-cover" />
          ) : (
            <Icon icon="mdi:car" className="w-16 h-16 text-[#7FD5FF]" />
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] uppercase text-gray-400">{label}</dt>
              <dd className="mt-0.5 text-sm text-white break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40">
          <h2 className="text-xs font-bold uppercase text-[#7FD5FF]">After Action Reports ({reports.length})</h2>
          <p className="text-[11px] text-gray-500">Operations this vehicle was reported on.</p>
        </div>
        {reports.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">Not on any after action report yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[#001825] text-xs uppercase text-gray-400">
                  <th className="px-4 sm:px-6 py-3 font-medium">Report Date</th>
                  <th className="px-4 py-3 font-medium">Task No</th>
                  <th className="px-4 py-3 font-medium">Operation</th>
                  <th className="px-4 py-3 font-medium">Report Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A4D66]/20">
                {reports.map((r) => (
                  <tr key={r.id} className="text-gray-300">
                    <td className="px-4 sm:px-6 py-3 whitespace-nowrap">{fmtVehicleDate(r.report_date)}</td>
                    <td className="px-4 py-3">{r.task_no || "-"}</td>
                    <td className="px-4 py-3">
                      {r.operation ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/operations/${r.operation!.id}`)}
                          className="text-[#7FD5FF] hover:underline text-left"
                        >
                          {r.operation.name}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{r.status ? r.status.replace(/_/g, " ") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
