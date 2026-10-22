import { useState } from "react";
import { Icon } from "@iconify/react";
import { DigitalSignatureModal } from "./DigitalSignatureModal";
import { useSignAfterActionReportMutation, type AfterActionReport } from "../api";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";

export interface SignerRowData {
  appointment: "Commanding officer" | "Pilot in Command" | "CO Pilot";
  roleKey: "commanding_officer" | "pilot_in_command" | "co_pilot";
  name: string;
  serviceNumber: string;
  rank: string;
  signature?: string | null;
  signedAt?: string | null;
  canSign?: boolean;
}

interface AARSignatureTableProps {
  report?: AfterActionReport | null;
  operationId: number;
  operationName?: string;
  isFormMode?: boolean;
  prefilledSigners?: {
    co?: { name: string; serviceNumber: string; rank: string; userId?: number | null; signature?: string | null };
    pic?: { name: string; serviceNumber: string; rank: string; personnelId?: number | null; signature?: string | null };
    copilot?: { name: string; serviceNumber: string; rank: string; personnelId?: number | null; signature?: string | null };
  };
  onSignSuccess?: () => void;
  // In form mode, allow updating pre-filled state
  onUpdateSigner?: (
    role: "co" | "pic" | "copilot",
    field: "name" | "serviceNumber" | "rank" | "signature",
    value: string
  ) => void;
}

export const AARSignatureTable = ({
  report,
  operationId,
  operationName,
  isFormMode = false,
  prefilledSigners,
  onSignSuccess,
  onUpdateSigner,
}: AARSignatureTableProps) => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [signReport, { isLoading: isSigning }] = useSignAfterActionReportMutation();

  const [activeModalRole, setActiveModalRole] = useState<SignerRowData | null>(null);

  // Check roles of current user
  const userRoles = (currentUser?.roles || []).map((r) =>
    (typeof r === "string" ? r : r.name || "").toLowerCase()
  );
  const roleNames = (currentUser?.role_names || []).map((r) => r.toLowerCase());
  const allRoles = [...userRoles, ...roleNames];

  const isCommandingOfficerUser =
    allRoles.includes("commanding-officer") ||
    allRoles.includes("officer-commanding") ||
    allRoles.includes("commanding officer") ||
    allRoles.includes("super-admin") ||
    allRoles.includes("admin") ||
    (report?.co_user_id ? String(report.co_user_id) === String(currentUser?.id) : false) ||
    (prefilledSigners?.co?.userId ? String(prefilledSigners.co.userId) === String(currentUser?.id) : false);

  // Signer data resolution
  const coName = report?.co_name || prefilledSigners?.co?.name || "";
  const coServiceNo = report?.co_service_number || prefilledSigners?.co?.serviceNumber || "";
  const coRank = report?.co_rank || prefilledSigners?.co?.rank || "";
  const coSignature = report?.co_signature || prefilledSigners?.co?.signature || null;
  const coSignedAt = report?.co_signed_at || null;

  const picName = report?.pic_name || prefilledSigners?.pic?.name || "";
  const picServiceNo = report?.pic_service_number || prefilledSigners?.pic?.serviceNumber || "";
  const picRank = report?.pic_rank || prefilledSigners?.pic?.rank || "";
  const picSignature = report?.pic_signature || prefilledSigners?.pic?.signature || null;
  const picSignedAt = report?.pic_signed_at || null;

  const copilotName = report?.copilot_name || prefilledSigners?.copilot?.name || "";
  const copilotServiceNo = report?.copilot_service_number || prefilledSigners?.copilot?.serviceNumber || "";
  const copilotRank = report?.copilot_rank || prefilledSigners?.copilot?.rank || "";
  const copilotSignature = report?.copilot_signature || prefilledSigners?.copilot?.signature || null;
  const copilotSignedAt = report?.copilot_signed_at || null;

  // Permissions for PIC and Co-Pilot:
  const isPicUser =
    allRoles.includes("super-admin") ||
    (currentUser?.name && picName && currentUser.name.toLowerCase().includes(picName.toLowerCase())) ||
    (currentUser?.username && picName && picName.toLowerCase().includes(currentUser.username.toLowerCase())) ||
    (currentUser?.email && (report?.pilotPersonnel as { email?: string })?.email === currentUser.email);

  const isCopilotUser =
    allRoles.includes("super-admin") ||
    (currentUser?.name && copilotName && currentUser.name.toLowerCase().includes(copilotName.toLowerCase())) ||
    (currentUser?.username && copilotName && copilotName.toLowerCase().includes(currentUser.username.toLowerCase())) ||
    (currentUser?.email && (report?.copilotPersonnel as { email?: string })?.email === currentUser.email);

  const rows: SignerRowData[] = [
    {
      appointment: "Commanding officer",
      roleKey: "commanding_officer",
      name: coName,
      serviceNumber: coServiceNo,
      rank: coRank,
      signature: coSignature,
      signedAt: coSignedAt,
      canSign: isCommandingOfficerUser && !coSignature,
    },
    {
      appointment: "Pilot in Command",
      roleKey: "pilot_in_command",
      name: picName,
      serviceNumber: picServiceNo,
      rank: picRank,
      signature: picSignature,
      signedAt: picSignedAt,
      canSign: (isPicUser || isCommandingOfficerUser) && !picSignature,
    },
    {
      appointment: "CO Pilot",
      roleKey: "co_pilot",
      name: copilotName,
      serviceNumber: copilotServiceNo,
      rank: copilotRank,
      signature: copilotSignature,
      signedAt: copilotSignedAt,
      canSign: (isCopilotUser || isCommandingOfficerUser) && !copilotSignature,
    },
  ];

  const handleOpenSignModal = (row: SignerRowData) => {
    setActiveModalRole(row);
  };

  const handleConfirmSignature = async (signatureDataUrl: string) => {
    if (!activeModalRole) return;

    if (isFormMode) {
      // In form mode, update local state before form submission
      const mapRoleKey =
        activeModalRole.roleKey === "commanding_officer"
          ? "co"
          : activeModalRole.roleKey === "pilot_in_command"
          ? "pic"
          : "copilot";
      onUpdateSigner?.(mapRoleKey, "signature", signatureDataUrl);
      dispatch(
        showToast({
          message: `Signature affixed for ${activeModalRole.appointment}`,
          type: "success",
        })
      );
      setActiveModalRole(null);
      return;
    }

    if (!report?.id) {
      dispatch(showToast({ message: "No active report found to sign", type: "error" }));
      return;
    }

    try {
      await signReport({
        id: report.id,
        operation_id: operationId,
        role: activeModalRole.roleKey,
        signature: signatureDataUrl,
        name: activeModalRole.name,
        service_number: activeModalRole.serviceNumber,
        rank: activeModalRole.rank,
      }).unwrap();

      dispatch(
        showToast({
          message: `Document successfully signed as ${activeModalRole.appointment}`,
          type: "success",
        })
      );
      setActiveModalRole(null);
      onSignSuccess?.();
    } catch {
      dispatch(
        showToast({
          message: "Failed to submit signature. Please try again.",
          type: "error",
        })
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Table Title and Status header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
            <Icon icon="mdi:certificate-outline" className="w-4 h-4 text-[#7FD5FF]" />
            AAR Authentication & Signatures
          </h4>
          <p className="text-[11px] text-gray-400">
            Sign-off by the Commanding Officer, Pilot in Command, and Co-Pilot.
          </p>
        </div>

        {report && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Approval Status:</span>
            <span
              className={`px-2.5 py-1 rounded-full font-semibold uppercase text-[10px] tracking-wide border ${
                report.status === "approved" || Boolean(report.co_signature)
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : report.status === "partially_signed" ||
                    Boolean(report.pic_signature) ||
                    Boolean(report.copilot_signature)
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-blue-500/10 text-[#7FD5FF] border-[#7FD5FF]/30"
              }`}
            >
              {report.status === "approved" || Boolean(report.co_signature)
                ? "Fully Approved (CO Signed)"
                : report.status === "partially_signed" ||
                  Boolean(report.pic_signature) ||
                  Boolean(report.copilot_signature)
                ? "Partially Signed"
                : "Awaiting Signatures"}
            </span>
          </div>
        )}
      </div>

      {/* Military Specification Table */}
      <div className="overflow-x-auto rounded-xl border-2 border-[#374151] bg-[#001219] shadow-lg">
        <table className="w-full border-collapse text-left text-xs text-white">
          <thead>
            <tr className="bg-[#9CA3AF] text-black font-extrabold uppercase border-b-2 border-black tracking-wider text-center sm:text-xs text-[11px]">
              <th className="border-r-2 border-black py-3 px-4 w-[34%]">
                NAME AND SERVICE NUMBER
              </th>
              <th className="border-r-2 border-black py-3 px-3 w-[18%]">
                RANK
              </th>
              <th className="border-r-2 border-black py-3 px-4 w-[24%]">
                APPOINTMENT
              </th>
              <th className="py-3 px-4 w-[24%]">
                SIGNATURE
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#374151]">
            {rows.map((row, index) => {
              const hasSigned = Boolean(row.signature);

              return (
                <tr
                  key={row.appointment}
                  className={`transition-colors ${
                    index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]"
                  } hover:bg-[#002433]`}
                >
                  {/* Column 1: NAME AND SERVICE NUMBER */}
                  <td className="border-r-2 border-[#374151] px-4 py-3 font-semibold text-gray-200">
                    {isFormMode ? (
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={row.name}
                          placeholder="Full Name"
                          onChange={(e) => {
                            const mapRole =
                              row.roleKey === "commanding_officer"
                                ? "co"
                                : row.roleKey === "pilot_in_command"
                                ? "pic"
                                : "copilot";
                            onUpdateSigner?.(mapRole, "name", e.target.value);
                          }}
                          className="w-full bg-[#001219] border border-[#0A4D66]/60 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                        />
                        <input
                          type="text"
                          value={row.serviceNumber}
                          placeholder="Service Number (e.g. NA/12345)"
                          onChange={(e) => {
                            const mapRole =
                              row.roleKey === "commanding_officer"
                                ? "co"
                                : row.roleKey === "pilot_in_command"
                                ? "pic"
                                : "copilot";
                            onUpdateSigner?.(mapRole, "serviceNumber", e.target.value);
                          }}
                          className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded px-2.5 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-[#7FD5FF] font-mono"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-100">
                          {row.name || "-"}
                        </span>
                        {row.serviceNumber && (
                          <span className="text-[11px] font-mono text-[#7FD5FF]">
                            {row.serviceNumber}
                          </span>
                        )}
                        {!row.name && !row.serviceNumber && (
                          <span className="text-gray-500 italic">Not specified</span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Column 2: RANK */}
                  <td className="border-r-2 border-[#374151] px-3 py-3 text-gray-300 font-medium">
                    {isFormMode ? (
                      <input
                        type="text"
                        value={row.rank}
                        placeholder="e.g. Major"
                        onChange={(e) => {
                          const mapRole =
                            row.roleKey === "commanding_officer"
                              ? "co"
                              : row.roleKey === "pilot_in_command"
                              ? "pic"
                              : "copilot";
                          onUpdateSigner?.(mapRole, "rank", e.target.value);
                        }}
                        className="w-full bg-[#001219] border border-[#0A4D66]/60 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#7FD5FF]"
                      />
                    ) : (
                      <span>{row.rank || "-"}</span>
                    )}
                  </td>

                  {/* Column 3: APPOINTMENT */}
                  <td className="border-r-2 border-[#374151] px-4 py-3 font-semibold text-gray-200">
                    <div className="flex items-center gap-1.5">
                      {row.appointment === "Commanding officer" && (
                        <Icon icon="mdi:shield-star" className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      {row.appointment === "Pilot in Command" && (
                        <Icon icon="mdi:airplane" className="w-4 h-4 text-[#7FD5FF] shrink-0" />
                      )}
                      {row.appointment === "CO Pilot" && (
                        <Icon icon="mdi:account-pilot" className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm">{row.appointment}</span>
                    </div>
                  </td>

                  {/* Column 4: SIGNATURE / CTA */}
                  <td className="px-4 py-3 align-middle">
                    {hasSigned ? (
                      <div className="space-y-1.5">
                        <div className="bg-white rounded-lg p-1.5 border border-gray-400 shadow-sm max-w-[180px]">
                          <img
                            src={row.signature || ""}
                            alt={`${row.appointment} Signature`}
                            className="h-10 w-full object-contain mx-auto"
                          />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <Icon icon="mdi:check-decagram" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            Signed
                            {row.signedAt
                              ? ` ${new Date(row.signedAt).toLocaleDateString()}`
                              : ""}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {row.canSign ? (
                          <button
                            type="button"
                            onClick={() => handleOpenSignModal(row)}
                            disabled={isSigning}
                            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 ${
                              row.roleKey === "commanding_officer"
                                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30 ring-1 ring-amber-400/50 animate-pulse"
                                : "bg-[#0A4D66] hover:bg-[#083c50] text-white shadow-cyan-900/30"
                            }`}
                          >
                            <Icon icon="mdi:draw-pen" className="w-4 h-4" />
                            <span>
                              {row.roleKey === "commanding_officer"
                                ? "Sign as CO"
                                : `Sign as ${row.appointment}`}
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 text-gray-500 text-xs italic">
                            <Icon icon="mdi:clock-outline" className="w-4 h-4 text-gray-500" />
                            <span>
                              {isFormMode
                                ? "Pending sign-off"
                                : "Awaiting signature"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signature Modal */}
      {activeModalRole && (
        <DigitalSignatureModal
          isOpen={Boolean(activeModalRole)}
          onClose={() => setActiveModalRole(null)}
          onConfirm={handleConfirmSignature}
          appointment={activeModalRole.appointment}
          signerName={activeModalRole.name}
          signerRank={activeModalRole.rank}
          signerServiceNumber={activeModalRole.serviceNumber}
          operationName={operationName}
          isSubmitting={isSigning}
        />
      )}
    </div>
  );
};
