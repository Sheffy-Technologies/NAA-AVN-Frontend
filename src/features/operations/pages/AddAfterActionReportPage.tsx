import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { AfterActionReportForm } from "@/features/operations/components/AfterActionReportForm";
import { useGetOperationByIdQuery } from "@/features/operations/api";

export const AddAfterActionReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: operation, isLoading } = useGetOperationByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#021019] text-[#7FD5FF]">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!operation || !id) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#021019] text-gray-400 gap-4">
        <p>Operation not found</p>
        <button
          onClick={() => navigate("/dashboard/operations")}
          className="text-[#7FD5FF] hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#021019] text-white px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/dashboard/operations/${id}`)}
            className="flex items-center gap-1 text-[#7FD5FF] hover:text-white transition-colors text-sm"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            Back to Operation
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">After Action Report</h1>
          <p className="text-gray-400 text-sm mt-1">
            Operation: <span className="text-[#7FD5FF]">{operation.name}</span>
          </p>
        </div>

        <div className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl p-6">
          <AfterActionReportForm
            operationId={Number(id)}
            operation={operation}
            onSuccess={() => navigate(`/dashboard/operations/${id}`)}
          />
        </div>
      </div>
    </div>
  );
};
