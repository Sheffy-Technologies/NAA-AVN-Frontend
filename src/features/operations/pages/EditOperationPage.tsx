import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { OperationForm } from "../components/OperationForm";
import {
  useGetOperationByIdQuery,
  useUpdateOperationMutation,
  type CreateOperationRequest,
} from "../api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

export const EditOperationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: operation, isLoading } = useGetOperationByIdQuery(id || "", {
    skip: !id,
  });
  const [updateOperation, { isLoading: isSubmitting }] =
    useUpdateOperationMutation();

  const handleSubmit = async (payload: CreateOperationRequest) => {
    if (!id) return;

    try {
      const saved = await updateOperation({ id, data: payload }).unwrap();
      if (saved.airworthiness_warning) {
        dispatch(showToast({ message: saved.airworthiness_warning.message, type: "warning" }));
      }
      navigate(`/dashboard/operations/${id}`);
    } catch (error) {
      console.error("Failed to update operation:", error);
      const err = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      const firstFieldError = err?.data?.errors
        ? Object.values(err.data.errors)[0]?.[0]
        : undefined;
      const message =
        firstFieldError ||
        err?.data?.message ||
        "Failed to update operation. Please try again.";
      dispatch(showToast({ message, type: "error" }));
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#001219] text-[#7FD5FF]">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#001219] text-gray-400 gap-4">
        <p>Operation not found</p>
        <button
          onClick={() => navigate("/dashboard/operations")}
          className="text-[#7FD5FF] hover:underline"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <OperationForm
      key={operation.id}
      mode="edit"
      initialOperation={operation}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  );
};