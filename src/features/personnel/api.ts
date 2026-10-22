import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type PersonnelRank = {
  id: number;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
};

export type PersonnelBasicEntity = {
  id: number;
  name: string;
  description: string | null;
  branch_id?: number;
  created_at: string;
  updated_at: string;
};

export type PersonnelRating = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PersonnelRatingAssignment = {
  id: number;
  name: string;
  pivot?: {
    expiry_date?: string | null;
  };
};

export type PersonnelFlightExperience = {
  asset_id: number | null;
  flight_hours: number;
  notes?: string | null;
};

export type Deployment = {
  id: number;
  personnel_id: number;
  from_unit_id: number | null;
  to_unit_id: number | null;
  start_date: string;
  end_date: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  from_unit: PersonnelBasicEntity | null;
  to_unit: PersonnelBasicEntity | null;
};

export type LinkedUser = {
  id: number;
  firstname: string | null;
  lastname: string | null;
  username: string | null;
  email: string | null;
};

export type Personnel = {
  id: number;
  user_id: number | null;
  /** The login account linked to this record (personnel.user_id), on the details endpoint. */
  user?: LinkedUser | null;
  rank_id: number;
  unit_id: number;
  branch_id: number;
  specialty_id: number;
  corp_id: number;
  service_number: string;
  is_expatriate?: boolean;
  firstname: string;
  lastname: string;
  othernames: string;
  dob: string;
  email: string;
  phone_number: string;
  address: string;
  blood_group: string;
  call_sign: string;
  rating_type: string;
  status: string;
  image: string | null;
  // Pass fields
  last_pass_date: string | null;
  pass_duration: number;
  next_pass_date: string | null;
  pass_status: string | null;
  // Flight currency fields — personnel with a call sign are pilots and are
  // expected to fly at least once every flight_interval_weeks.
  is_pilot: boolean;
  last_flight_date: string | null;
  next_flight_due_date: string | null;
  flight_status: "no_flights" | "current" | "due_for_flight" | "overdue" | null;
  // Total logged flight hours (operation_asset.flight_hours as pilot or
  // co-pilot, plus flight_experiences) — see Personnel::getTotalFlightHoursAttribute.
  total_flight_hours: number;
  total_flight_hours_label: string;
  created_at: string;
  updated_at: string;
  rank: PersonnelRank;
  corp: PersonnelBasicEntity;
  branch: PersonnelBasicEntity;
  specialty: PersonnelBasicEntity;
  unit: PersonnelBasicEntity;
  latest_deployment: Deployment | null;
  deployments: Deployment[];
  ratings?: PersonnelRatingAssignment[];
  flight_experiences?: PersonnelFlightExperience[];
};

export type Aircraft = {
  id: number;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
};

export type PersonnelFilters = {
  branches: number[];
  units: number[];
  ranks: number[];
  corps: number[];
  specialties: number[];
  status: string[];
  is_expatriate?: boolean;
};

export type CreatePersonnelRequest = {
  service_number?: string | null;
  rank_id?: string | number | null;
  unit_id?: string | number | null;
  branch_id?: string | number | null;
  corp_id?: string | number | null;
  specialty_id?: string | number | null;
  firstname: string;
  lastname: string;
  is_expatriate?: boolean;
  othernames?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  blood_group?: string;
  call_sign?: string;
  status?: string;
  rating_type?: string;
  image?: string;
  ratings?: {
    rating_id: number;
    expiry_date: string | null;
  }[];
  flight_experiences?: {
    asset_id: number;
    flight_hours: number;
    notes: string;
  }[];
  deployments?: {
    from_unit_id?: string | number | null;
    to_unit_id?: string | number | null;
    start_date?: string | null;
    end_date?: string | null;
  }[];
};

export type UploadImageResponse = {
  message: string;
  data: string;
};

export const personnelApi = createApi({
  reducerPath: "personnelApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Personnel", "MyPersonnel"],
  endpoints: (builder) => ({
    getPersonnel: builder.query<Personnel[], PersonnelFilters>({
      query: (filters) => ({
        url: "/personnel",
        method: "GET",
        params: filters,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Personnel" as const, id })),
              { type: "Personnel", id: "LIST" },
            ]
          : [{ type: "Personnel", id: "LIST" }],
    }),
    createPersonnel: builder.mutation<Personnel, CreatePersonnelRequest>({
      query: (body) => ({
        url: "/personnel",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Personnel", id: "LIST" }],
    }),
    uploadPersonnelImage: builder.mutation<UploadImageResponse, FormData>({
      query: (body) => ({
        url: "/personnel/image",
        method: "POST",
        data: body,
      }),
    }),
    updatePersonnel: builder.mutation<
      Personnel,
      {
        id: string | number;
        data: Partial<CreatePersonnelRequest> | { status: string };
      }
    >({
      query: ({ id, data }) => ({
        url: `/personnel/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Personnel", id },
        { type: "Personnel", id: "LIST" },
      ],
    }),
    /** Admin: link (or unlink with null) the login account for a personnel record. */
    linkPersonnelUser: builder.mutation<Personnel, { id: number; user_id: number | null }>({
      query: ({ id, user_id }) => ({ url: `/personnel/${id}/user`, method: "PUT", data: { user_id } }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Personnel", id }, { type: "Personnel", id: "LIST" }, "MyPersonnel"],
    }),
    /** Self-service: the logged-in user's own linked record. */
    getMyPersonnel: builder.query<MyPersonnelResponse, void>({
      query: () => ({ url: "/auth/me/personnel", method: "GET" }),
      providesTags: ["MyPersonnel"],
    }),
    updateMyPersonnel: builder.mutation<MyPersonnelResponse, Partial<Record<MyPersonnelField, string | null>>>({
      query: (data) => ({ url: "/auth/me/personnel", method: "PUT", data }),
      invalidatesTags: ["MyPersonnel", { type: "Personnel", id: "LIST" }],
    }),
    uploadMyPersonnelImage: builder.mutation<MyPersonnelResponse, File>({
      query: (file) => {
        const data = new FormData();
        data.append("image", file);
        return { url: "/auth/me/personnel/image", method: "POST", data };
      },
      invalidatesTags: ["MyPersonnel"],
    }),
    getPersonnelById: builder.query<Personnel, string | number>({
      query: (id) => ({
        url: `/personnel/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Personnel", id }],
    }),
    deletePersonnel: builder.mutation<void, string | number>({
      query: (id) => ({
        url: `/personnel/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Personnel", id },
        { type: "Personnel", id: "LIST" },
      ],
    }),
    getPersonnelRanks: builder.query<PersonnelRank[], void>({
      query: () => ({
        url: "/ranks",
        method: "GET",
      }),
    }),
    getPersonnelSpecialties: builder.query<PersonnelBasicEntity[], void>({
      query: () => ({
        url: "/specialties",
        method: "GET",
      }),
    }),
    getPersonnelBranches: builder.query<PersonnelBasicEntity[], void>({
      query: () => ({
        url: "/branches",
        method: "GET",
      }),
    }),
    getPersonnelCorps: builder.query<PersonnelBasicEntity[], void>({
      query: () => ({
        url: "/corps",
        method: "GET",
      }),
    }),
    getPersonnelRatings: builder.query<PersonnelRating[], void>({
      query: () => ({
        url: "/ratings",
        method: "GET",
      }),
    }),
    getAircrafts: builder.query<Aircraft[], void>({
      query: () => ({
        url: "/aircraft",
        method: "GET",
      }),
    }),
  }),
});

/** Fields a user may edit on their own record (MyPersonnelController::EDITABLE_FIELDS). */
export type MyPersonnelField = "othernames" | "dob" | "email" | "phone_number" | "address" | "blood_group" | "qualifications";

export type MyPersonnelResponse = {
  personnel: Personnel & {
    rank?: { id: number; name: string } | null;
    unit?: { id: number; name: string } | null;
    branch?: { id: number; name: string } | null;
    corp?: { id: number; name: string } | null;
    specialty?: { id: number; name: string } | null;
    qualifications?: string | null;
  };
  editable_fields: string[];
};

export const {
  useLinkPersonnelUserMutation,
  useGetMyPersonnelQuery,
  useUpdateMyPersonnelMutation,
  useUploadMyPersonnelImageMutation,
  useGetPersonnelQuery,
  useGetPersonnelByIdQuery,
  useGetPersonnelRanksQuery,
  useGetPersonnelSpecialtiesQuery,
  useGetPersonnelBranchesQuery,
  useGetPersonnelCorpsQuery,
  useGetPersonnelRatingsQuery,
  useGetAircraftsQuery,
  useCreatePersonnelMutation,
  useUploadPersonnelImageMutation,
  useUpdatePersonnelMutation,
  useDeletePersonnelMutation,
} = personnelApi;
