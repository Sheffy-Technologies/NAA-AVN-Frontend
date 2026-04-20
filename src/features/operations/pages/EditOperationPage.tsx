import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { OperationForm } from "../components/OperationForm";
import {
  useGetOperationByIdQuery,
  useUpdateOperationMutation,
  type CreateOperationRequest,
} from "../api";

export const EditOperationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: operation, isLoading } = useGetOperationByIdQuery(id || "", {
    skip: !id,
  });
  const [updateOperation, { isLoading: isSubmitting }] =
    useUpdateOperationMutation();

  const handleSubmit = async (payload: CreateOperationRequest) => {
    if (!id) return;

    try {
      await updateOperation({ id, data: payload }).unwrap();
      navigate(`/dashboard/operations/${id}`);
    } catch (error) {
      console.error("Failed to update operation:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#021019] text-[#7FD5FF]">
        <Icon icon="mdi:loading" className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#021019] text-gray-400 gap-4">
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