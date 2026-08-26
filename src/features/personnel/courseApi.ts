import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";
import type { Personnel } from "./api";
import type { Pass, PassUser } from "./passApi";

export type CourseStatus = "scheduled" | "ongoing" | "completed" | "cancelled";

export type Course = {
  id: number;
  personnel_id: number;
  title: string;
  institution: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: CourseStatus;
  remarks: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  personnel?: Personnel;
  created_by_user?: PassUser | null;
  pass?: Pass | null;
};

export type CourseFilters = {
  personnel_id?: number;
  status?: CourseStatus;
  date_from?: string;
  date_to?: string;
  unit_id?: number;
  rank_id?: number;
};

export type RegisterCourseRequest = {
  personnel_id: number;
  title: string;
  institution?: string | null;
  location?: string | null;
  start_date: string;
  end_date: string;
  status?: CourseStatus;
  remarks?: string | null;
};

export type UpdateCourseRequest = {
  title?: string;
  institution?: string | null;
  location?: string | null;
  start_date?: string;
  end_date?: string;
  status?: CourseStatus;
  remarks?: string | null;
};

export const courseApi = createApi({
  reducerPath: "courseApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Course"],
  endpoints: (builder) => ({
    getCourses: builder.query<Course[], CourseFilters>({
      query: (params) => ({ url: "/courses", method: "GET", params }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Course" as const, id })),
              { type: "Course", id: "LIST" },
            ]
          : [{ type: "Course", id: "LIST" }],
    }),

    registerCourse: builder.mutation<Course, RegisterCourseRequest>({
      query: (body) => ({ url: "/courses", method: "POST", data: body }),
      invalidatesTags: [{ type: "Course", id: "LIST" }],
    }),

    updateCourse: builder.mutation<Course, { id: number; data: UpdateCourseRequest }>({
      query: ({ id, data }) => ({ url: `/courses/${id}`, method: "PUT", data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Course", id },
        { type: "Course", id: "LIST" },
      ],
    }),

    deleteCourse: builder.mutation<void, number>({
      query: (id) => ({ url: `/courses/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Course", id },
        { type: "Course", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetCoursesQuery,
  useRegisterCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
} = courseApi;
