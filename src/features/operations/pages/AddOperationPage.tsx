import { useNavigate } from "react-router-dom";
import { OperationForm } from "../components/OperationForm";
import {
  useCreateOperationMutation,
  type CreateOperationRequest,
} from "../api";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";

export const AddOperationPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [createOperation, { isLoading: isSubmitting }] =
    useCreateOperationMutation();

  const handleSubmit = async (payload: CreateOperationRequest) => {
    try {
      const saved = await createOperation(payload).unwrap();
      if (saved.airworthiness_warning) {
        dispatch(showToast({ message: saved.airworthiness_warning.message, type: "warning" }));
      }
      navigate("/dashboard/operations");
    } catch (error) {
      console.error("Failed to create operation:", error);
      const err = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      const firstFieldError = err?.data?.errors
        ? Object.values(err.data.errors)[0]?.[0]
        : undefined;
      const message =
        firstFieldError ||
        err?.data?.message ||
        "Failed to create operation. Please try again.";
      dispatch(showToast({ message, type: "error" }));
    }
  };

  return (
    <OperationForm
      mode="create"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  );
};
