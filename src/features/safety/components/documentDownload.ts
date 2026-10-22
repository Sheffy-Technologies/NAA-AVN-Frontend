import axios from "axios";
import { store } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import type { SqRecord } from "../api";

const str = (r: SqRecord, key: string) => (r[key] === null || r[key] === undefined ? "" : String(r[key]));

/** Downloads go through the API (auth + access checks), never a public file URL. */
export const downloadControlledDocument = async (record: SqRecord) => {
  try {
    const token = store.getState().auth.token;
    const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/controlled-documents/${record.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${str(record, "document_number")} ${str(record, "title")}${str(record, "file_type") ? `.${str(record, "file_type").toLowerCase()}` : ""}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    store.dispatch(
      showToast({
        message: status === 403 ? "This document is restricted to authorised staff." : "The document could not be downloaded.",
        type: "error",
      }),
    );
  }
};
