import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/shared/api/baseQuery";

export type UserRecord = {
  id: number;
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
  roles?: Array<{
    id?: number;
    name?: string | null;
    guard_name?: string | null;
  }>;
  units?: Array<{
    id: number;
    name: string;
  }>;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SelfUserRecord = UserRecord & {
  role_names?: string[];
  permissions?: string[];
};

type UsersApiResponse =
  | UserRecord[]
  | {
      data?: UserRecord[];
      results?: UserRecord[];
      users?: UserRecord[];
    };

type UpdateUserPayload = {
  id: number;
  data: Partial<
    Pick<
      UserRecord,
      "firstname" | "lastname" | "username" | "email" | "phone_number"
    > & {
      password: string;
    }
  >;
};

export const usersApi = createApi({
  reducerPath: "usersApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getUsers: builder.query<UserRecord[], void>({
      query: () => ({
        url: "/users",
        method: "GET",
      }),
      transformResponse: (response: UsersApiResponse) => {
        if (Array.isArray(response)) return response;
        return response.data || response.results || response.users || [];
      },
    }),
    updateUser: builder.mutation<UserRecord, UpdateUserPayload>({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: "PUT",
        data,
      }),
    }),
    updateMe: builder.mutation<
      SelfUserRecord,
      Partial<
        Pick<
          UserRecord,
          "firstname" | "lastname" | "username" | "email" | "phone_number"
        > & {
          password: string;
        }
      >
    >({
      query: (data) => ({
        url: "/auth/me",
        method: "PUT",
        data,
      }),
    }),
    createUser: builder.mutation<UserRecord, {
      firstname?: string | null;
      lastname?: string | null;
      username?: string | null;
      phone_number?: string | null;
      email?: string | null;
      password: string;
    }>({
      query: (data) => ({
        url: "/users",
        method: "POST",
        data,
      }),
    }),
  }),
});

export const {
  useGetUsersQuery,
  useUpdateUserMutation,
  useUpdateMeMutation,
  useCreateUserMutation,
} = usersApi;
