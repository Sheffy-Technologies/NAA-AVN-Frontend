import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type ResidenceStatus = "available" | "under_maintenance" | "condemned";
/** Derived on the server from active occupancies (or the residence's status when out of use). */
export type OccupancyStatus = "vacant" | "partly_occupied" | "occupied" | "under_maintenance" | "condemned";

/** Occupancy figures the API adds to categories and blocks. */
export type AccommodationFigures = {
  residences_count: number;
  occupants_count: number;
  occupied_count: number;
  vacant_count: number;
  out_of_use_count: number;
};

export type AccommodationCategory = AccommodationFigures & {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  blocks_count: number;
};

export type AccommodationBlock = AccommodationFigures & {
  id: number;
  accommodation_category_id: number;
  category?: { id: number; name: string } | null;
  name: string;
  location: string | null;
  description: string | null;
};

export type OccupantPersonnel = {
  id: number;
  firstname: string;
  lastname: string;
  othernames?: string | null;
  full_name?: string;
  service_number: string;
  phone_number?: string | null;
  email?: string | null;
  rank?: { id: number; name: string } | null;
  unit?: { id: number; name: string } | null;
};

export type Occupancy = {
  id: number;
  residence_id: number;
  personnel_id: number;
  status: "active" | "vacated";
  move_in_date: string;
  expected_move_out_date: string | null;
  move_out_date: string | null;
  allocation_reference: string | null;
  dependants: number | null;
  notes: string | null;
  vacate_remarks: string | null;
  /** Null when the person is in a unit outside the viewer's unit scope. */
  personnel: OccupantPersonnel | null;
  residence?: Pick<Residence, "id" | "name" | "accommodation_block_id" | "apartment_type" | "rooms" | "capacity" | "status"> & {
    block?: { id: number; name: string; accommodation_category_id: number; category?: { id: number; name: string } | null } | null;
  };
  allocator?: { id: number; firstname: string; lastname: string } | null;
  vacator?: { id: number; firstname: string; lastname: string } | null;
  created_at: string;
};

export type Residence = {
  id: number;
  accommodation_block_id: number;
  block?: { id: number; name: string; location?: string | null; accommodation_category_id: number; category?: { id: number; name: string } | null } | null;
  name: string;
  apartment_type: string;
  apartment_type_label: string;
  rooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  capacity: number;
  is_furnished: boolean;
  has_boys_quarters: boolean;
  status: ResidenceStatus;
  notes: string | null;
  active_occupancies_count: number;
  occupancy_status: OccupancyStatus;
  active_occupancies?: Occupancy[];
  /** Detail view only: every stay, active first. */
  occupancies?: Occupancy[];
};

export type ResidenceOptions = {
  apartment_types: Array<{ value: string; label: string }>;
  statuses: ResidenceStatus[];
};

export type CategoryPayload = Partial<Pick<AccommodationCategory, "name" | "description" | "sort_order">>;
export type BlockPayload = Partial<Pick<AccommodationBlock, "accommodation_category_id" | "name" | "location" | "description">>;
export type ResidencePayload = Partial<
  Pick<
    Residence,
    | "accommodation_block_id"
    | "name"
    | "apartment_type"
    | "rooms"
    | "bathrooms"
    | "floor"
    | "capacity"
    | "is_furnished"
    | "has_boys_quarters"
    | "status"
    | "notes"
  >
>;
export type OccupancyPayload = Partial<
  Pick<
    Occupancy,
    | "residence_id"
    | "personnel_id"
    | "move_in_date"
    | "expected_move_out_date"
    | "move_out_date"
    | "allocation_reference"
    | "dependants"
    | "notes"
    | "vacate_remarks"
  >
>;

type ListParams = Record<string, string | number | undefined>;

// Any change can move the occupancy figures shown on categories, blocks and residences.
const ALL = ["Categories", "Blocks", "Residences", "Occupancies"] as const;

export const accommodationApi = createApi({
  reducerPath: "accommodationApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ALL,
  endpoints: (builder) => ({
    getAccommodationCategories: builder.query<AccommodationCategory[], void>({
      query: () => ({ url: "/accommodation-categories", method: "GET" }),
      providesTags: ["Categories"],
    }),
    saveAccommodationCategory: builder.mutation<AccommodationCategory, { id?: number; data: CategoryPayload }>({
      query: ({ id, data }) =>
        id ? { url: `/accommodation-categories/${id}`, method: "PUT", data } : { url: "/accommodation-categories", method: "POST", data },
      invalidatesTags: [...ALL],
    }),
    deleteAccommodationCategory: builder.mutation<void, number>({
      query: (id) => ({ url: `/accommodation-categories/${id}`, method: "DELETE" }),
      invalidatesTags: [...ALL],
    }),
    getAccommodationBlocks: builder.query<AccommodationBlock[], ListParams | void>({
      query: (params) => ({ url: "/accommodation-blocks", method: "GET", params: params ?? undefined }),
      providesTags: ["Blocks"],
    }),
    saveAccommodationBlock: builder.mutation<AccommodationBlock, { id?: number; data: BlockPayload }>({
      query: ({ id, data }) =>
        id ? { url: `/accommodation-blocks/${id}`, method: "PUT", data } : { url: "/accommodation-blocks", method: "POST", data },
      invalidatesTags: [...ALL],
    }),
    deleteAccommodationBlock: builder.mutation<void, number>({
      query: (id) => ({ url: `/accommodation-blocks/${id}`, method: "DELETE" }),
      invalidatesTags: [...ALL],
    }),
    getResidenceOptions: builder.query<ResidenceOptions, void>({
      query: () => ({ url: "/residences/options", method: "GET" }),
    }),
    getResidences: builder.query<Residence[], ListParams | void>({
      query: (params) => ({ url: "/residences", method: "GET", params: params ?? undefined }),
      providesTags: ["Residences"],
    }),
    getResidence: builder.query<Residence, number>({
      query: (id) => ({ url: `/residences/${id}`, method: "GET" }),
      providesTags: ["Residences", "Occupancies"],
    }),
    saveResidence: builder.mutation<Residence, { id?: number; data: ResidencePayload }>({
      query: ({ id, data }) => (id ? { url: `/residences/${id}`, method: "PUT", data } : { url: "/residences", method: "POST", data }),
      invalidatesTags: [...ALL],
    }),
    deleteResidence: builder.mutation<void, number>({
      query: (id) => ({ url: `/residences/${id}`, method: "DELETE" }),
      invalidatesTags: [...ALL],
    }),
    getOccupancies: builder.query<Occupancy[], ListParams | void>({
      query: (params) => ({ url: "/residence-occupancies", method: "GET", params: params ?? undefined }),
      providesTags: ["Occupancies"],
    }),
    saveOccupancy: builder.mutation<Occupancy, { id?: number; data: OccupancyPayload }>({
      query: ({ id, data }) =>
        id ? { url: `/residence-occupancies/${id}`, method: "PUT", data } : { url: "/residence-occupancies", method: "POST", data },
      invalidatesTags: [...ALL],
    }),
    vacateOccupancy: builder.mutation<Occupancy, { id: number; move_out_date: string; vacate_remarks?: string | null }>({
      query: ({ id, ...data }) => ({ url: `/residence-occupancies/${id}/vacate`, method: "POST", data }),
      invalidatesTags: [...ALL],
    }),
    deleteOccupancy: builder.mutation<void, number>({
      query: (id) => ({ url: `/residence-occupancies/${id}`, method: "DELETE" }),
      invalidatesTags: [...ALL],
    }),
  }),
});

export const {
  useGetAccommodationCategoriesQuery,
  useSaveAccommodationCategoryMutation,
  useDeleteAccommodationCategoryMutation,
  useGetAccommodationBlocksQuery,
  useSaveAccommodationBlockMutation,
  useDeleteAccommodationBlockMutation,
  useGetResidenceOptionsQuery,
  useGetResidencesQuery,
  useGetResidenceQuery,
  useSaveResidenceMutation,
  useDeleteResidenceMutation,
  useGetOccupanciesQuery,
  useSaveOccupancyMutation,
  useVacateOccupancyMutation,
  useDeleteOccupancyMutation,
} = accommodationApi;
