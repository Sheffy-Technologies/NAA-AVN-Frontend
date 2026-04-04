import { useNavigate } from "react-router-dom";
import { OperationForm } from "../components/OperationForm";
import {
  useCreateOperationMutation,
  type CreateOperationRequest,
} from "../api";

export const AddOperationPage = () => {
  const navigate = useNavigate();
  const [createOperation, { isLoading: isSubmitting }] =
    useCreateOperationMutation();

  const handleSubmit = async (payload: CreateOperationRequest) => {
    try {
      await createOperation(payload).unwrap();
      navigate("/dashboard/operations");
    } catch (error) {
      console.error("Failed to create operation:", error);
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
