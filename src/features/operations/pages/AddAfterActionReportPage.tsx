import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { BackButton } from "@/shared/ui/button";
import { AfterActionReportForm } from "@/features/operations/components/AfterActionReportForm";
import { useGetOperationByIdQuery } from "@/features/operations/api";

export const AddAfterActionReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const { data: operation, isLoading } = useGetOperationByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) {
    return (
      <div className={cn("min-h-screen w-full flex items-center justify-center py-24", isDark ? "text-slate-400" : "text-slate-500")}>
        <div className="animate-spin h-8 w-8 border-2 border-sky-500 border-t-transparent rounded-full mr-3" />
        <span className="text-sm font-medium">Loading operation debrief parameters...</span>
      </div>
    );
  }

  if (!operation || !id) {
    return (
      <div className={cn("min-h-screen w-full flex flex-col items-center justify-center py-24 gap-4", isDark ? "text-slate-400" : "text-slate-500")}>
        <div className={cn("p-4 rounded-2xl border", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-slate-500" : "bg-white border-slate-200 text-slate-400")}>
          <Icon icon="mdi:target-off" className="w-12 h-12" />
        </div>
        <p className={cn("text-lg font-semibold", isDark ? "text-white" : "text-slate-900")}>Operation Record Not Found</p>
        <BackButton fallbackUrl="/dashboard/operations" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 max-w-5xl mx-auto", isDark ? "text-slate-100" : "text-slate-800")}>
      {/* Executive Header */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all duration-200 shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex items-start gap-4">
          <BackButton fallbackUrl={`/dashboard/operations/${id}`} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                Mission Debrief • AAR Entry
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                OP-{operation.id}
              </span>
            </div>
            <h1 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              Record After Action Report
            </h1>
            <p className={cn("text-xs mt-1 flex flex-wrap items-center gap-3", isDark ? "text-slate-400" : "text-slate-500")}>
              <span>Operation: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{operation.name}</strong></span>
              <span>•</span>
              <span>Theater: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{operation.operation_category?.name || "General"}</strong></span>
              <span>•</span>
              <span>Unit: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{operation.unit?.name || "Unassigned"}</strong></span>
            </p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <AfterActionReportForm
        operationId={Number(id)}
        operation={operation}
        onSuccess={() => navigate(`/dashboard/operations/${id}`)}
      />
    </div>
  );
};
