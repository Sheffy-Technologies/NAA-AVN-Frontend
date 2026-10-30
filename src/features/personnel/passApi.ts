import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import type { Personnel, PersonnelRank, PersonnelBasicEntity } from "./api";

export type PassStatus =
  | "upcoming"
  | "due_for_pass"
  | "pending_approval"
  | "on_pass"
  | "overdue";

export type PassRecordStatus =
  | "pending"
  | "approved"
  | "active"
  | "completed"
  | "rejected";

export type PassUser = {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string;
};

/** Item 6 of NA FORM/00001/07. */
export type PassType = "normal" | "weekend" | "annual";

export const PASS_TYPES: { value: PassType; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "weekend", label: "Weekend" },
  { value: "annual", label: "Annual" },
];

/** The form's three signatures. */
export type PassSigner = "applicant" | "recommending_officer" | "approving_officer";

/** NA FORM/00001/07 fields beyond the person and the dates (items 4–7, 10, 12–15). */
export type PassApplicationFields = {
  place_of_deployment?: string | null;
  appointment?: string | null;
  pass_type?: PassType | null;
  request_through?: string | null;
  request_to?: string | null;
  reason?: string | null;
  travel_destination?: string | null;
  contact_address?: string | null;
  contact_phone?: string | null;
  recommending_officer_comment?: string | null;
  recommending_officer_name?: string | null;
  recommending_officer_appointment?: string | null;
  recommending_officer_date?: string | null;
  approving_officer_comment?: string | null;
  approving_officer_name?: string | null;
  approving_officer_appointment?: string | null;
  approving_officer_date?: string | null;
};

/** Drawn signatures to save: a PNG data URL, or null to remove one. */
export type PassSignaturePayload = Partial<Record<`${PassSigner}_signature`, string | null>>;

/** Item 14 or 15 as shown: from the approval workflow's stage, or as typed on the form. */
export type PassSignOffOfficer = {
  action: "approved" | "rejected" | null;
  comment: string | null;
  name: string | null;
  appointment: string | null;
  date: string | null;
  has_signature: boolean;
};

export type PassSignOff = {
  source: "workflow" | "form";
  request_status?: string;
  recommending_officer: PassSignOffOfficer | null;
  approving_officer: PassSignOffOfficer | null;
};

export type Pass = PassApplicationFields & {
  id: number;
  /** On the single-pass endpoints only. */
  sign_off?: PassSignOff;
  /** Items 14–15 are signed through Approvals, not typed. */
  officers_via_workflow?: boolean;
  personnel_id: number;
  has_attachment?: boolean;
  attachment_name?: string | null;
  signatures?: Record<PassSigner, boolean>;
  start_date: string;
  end_date: string;
  duration: number;
  status: PassRecordStatus;
  remarks: string | null;
  created_by: number | null;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
  personnel?: Personnel;
  created_by_user?: PassUser | null;
  approved_by_user?: PassUser | null;
};

export type PersonnelWithPass = {
  id: number;
  service_number: string;
  firstname: string;
  lastname: string;
  image: string | null;
  pass_status: PassStatus | null;
  last_pass_date: string | null;
  next_pass_date: string | null;
  pass_duration: number;
  rank: PersonnelRank;
  unit: PersonnelBasicEntity;
  latest_pass?: Pass | null;
  pending_pass?: Pass | null;
};

export type PersonnelPassDetail = {
  personnel: PersonnelWithPass & {
    passes: Pass[];
  };
  total_passes: number;
};

export type PassFilters = {
  personnel_id?: number;
  status?: PassRecordStatus;
  date_from?: string;
  date_to?: string;
  unit_id?: number;
  rank_id?: number;
};

export type PersonnelPassFilters = {
  unit_id?: number;
  rank_id?: number;
  pass_status?: PassStatus;
  branch_id?: number;
  specialty_id?: number;
};

export type InitiatePassRequest = PassApplicationFields & PassSignaturePayload & {
  personnel_id: number;
  start_date: string;
  end_date: string;
  duration?: number;
  status?: PassRecordStatus;
  remarks?: string | null;
};

export type UpdatePassRequest = PassApplicationFields & PassSignaturePayload & {
  start_date?: string;
  end_date?: string;
  duration?: number;
  status?: PassRecordStatus;
  remarks?: string | null;
  approved_by?: number | null;
};

export const passApi = createApi({
  reducerPath: "passApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Pass", "PersonnelPass"],
  endpoints: (builder) => ({
    // All pass records (history)
    getPasses: builder.query<Pass[], PassFilters>({
      query: (params) => ({ url: "/passes", method: "GET", params }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Pass" as const, id })),
              { type: "Pass", id: "LIST" },
            ]
          : [{ type: "Pass", id: "LIST" }],
    }),

    // All personnel with their pass summary
    getPersonnelPass: builder.query<PersonnelWithPass[], PersonnelPassFilters>({
      query: (params) => ({ url: "/personnel/pass", method: "GET", params }),
      providesTags: [{ type: "PersonnelPass", id: "LIST" }],
    }),

    // Single personnel's pass detail + history
    getPersonnelPassById: builder.query<PersonnelPassDetail, string | number>({
      query: (id) => ({ url: `/personnel/${id}/pass`, method: "GET" }),
      providesTags: (_result, _error, id) => [{ type: "PersonnelPass", id }],
    }),

    // Initiate a pass
    initiatePass: builder.mutation<Pass, InitiatePassRequest>({
      query: (body) => ({ url: "/passes", method: "POST", data: body }),
      invalidatesTags: [
        { type: "Pass", id: "LIST" },
        { type: "PersonnelPass", id: "LIST" },
      ],
    }),

    // Update a pass
    updatePass: builder.mutation<Pass, { id: number; data: UpdatePassRequest }>({
      query: ({ id, data }) => ({
        url: `/passes/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Pass", id },
        { type: "Pass", id: "LIST" },
        { type: "PersonnelPass", id: "LIST" },
      ],
    }),

    getPassFormOptions: builder.query<{ types: { value: string; label: string }[]; officers_via_workflow: boolean }, void>({
      query: () => ({ url: "/passes/form-options", method: "GET" }),
      providesTags: [{ type: "Pass", id: "OPTIONS" }],
    }),
    getPass: builder.query<Pass, number>({
      query: (id) => ({ url: `/passes/${id}`, method: "GET" }),
      providesTags: (_result, _error, id) => [{ type: "Pass", id }],
    }),

    // Item 11: one attachment per application, replaced on re-upload
    uploadPassAttachment: builder.mutation<Pass, { id: number; file: File }>({
      query: ({ id, file }) => {
        const data = new FormData();
        data.append("file", file);
        return { url: `/passes/${id}/attachment`, method: "POST", data, headers: { "Content-Type": "multipart/form-data" } };
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: "Pass", id }, { type: "Pass", id: "LIST" }],
    }),
    deletePassAttachment: builder.mutation<Pass, number>({
      query: (id) => ({ url: `/passes/${id}/attachment`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Pass", id }, { type: "Pass", id: "LIST" }],
    }),

    // Delete a pass
    deletePass: builder.mutation<void, number>({
      query: (id) => ({ url: `/passes/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Pass", id },
        { type: "Pass", id: "LIST" },
        { type: "PersonnelPass", id: "LIST" },
      ],
    }),

    // Recompute last/next pass date + status for every personnel with a pass
    recomputePassStatuses: builder.mutation<
      { message: string; personnel_count: number },
      void
    >({
      query: () => ({ url: "/passes/recompute", method: "POST" }),
      invalidatesTags: [{ type: "PersonnelPass", id: "LIST" }],
    }),
  }),
});

export const {
  useGetPassesQuery,
  useGetPersonnelPassQuery,
  useGetPersonnelPassByIdQuery,
  useInitiatePassMutation,
  useUpdatePassMutation,
  useDeletePassMutation,
  useGetPassQuery,
  useGetPassFormOptionsQuery,
  useUploadPassAttachmentMutation,
  useDeletePassAttachmentMutation,
  useRecomputePassStatusesMutation,
} = passApi;
