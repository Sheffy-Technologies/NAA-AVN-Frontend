import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { useGetUsersQuery, useUpdateUserMutation } from "@/features/users/api";
import { AUTH_STORAGE_KEY } from "@/features/auth/authSlice";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";

type FormValues = {
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  phone_number: string;
  password: string;
};

const emptyValues: FormValues = {
  firstname: "",
  lastname: "",
  username: "",
  email: "",
  phone_number: "",
  password: "",
};

export const UserDetailsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const { data: users = [], isLoading } = useGetUsersQuery();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

  const [values, setValues] = useState<FormValues>(emptyValues);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const persistedAuthUserId = useMemo(() => {
    if (typeof window === "undefined") return null;

    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as { user?: { id?: string | number } };
      const rawId = parsed.user?.id;
      const id = rawId != null ? Number(rawId) : NaN;

      return Number.isFinite(id) ? id : null;
    } catch {
      return null;
    }
  }, []);

  const selectedUser = useMemo(() => {
    if (!users.length) return null;

    const authUserId =
      persistedAuthUserId ?? (authUser?.id ? Number(authUser.id) : null);
    if (authUserId) {
      const matchedUser = users.find((user) => user.id === authUserId);
      if (matchedUser) return matchedUser;
    }

    return users[0] || null;
  }, [users, authUser, persistedAuthUserId]);

  useEffect(() => {
    if (!selectedUser) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues({
      firstname: selectedUser.firstname || "",
      lastname: selectedUser.lastname || "",
      username: selectedUser.username || "",
      email: selectedUser.email || "",
      phone_number: selectedUser.phone_number || "",
      password: "",
    });
  }, [selectedUser]);

  const handleChange =
    (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
      setSubmitError(null);
      setSubmitMessage(null);
    };

  const handleSubmit = async () => {
    if (!selectedUser) return;

    try {
      await updateUser({
        id: selectedUser.id,
        data: {
          firstname: values.firstname.trim(),
          lastname: values.lastname.trim(),
          username: values.username.trim(),
          email: values.email.trim(),
          phone_number: values.phone_number.trim(),
          ...(values.password.trim()
            ? { password: values.password.trim() }
            : {}),
        },
      }).unwrap();
      setSubmitMessage("User details updated successfully.");
    } catch {
      setSubmitError("Failed to update user details. Please try again.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !selectedUser || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${selectedUser.firstname || "user"}-${selectedUser.lastname || "details"}-${selectedUser.id}`,
        backgroundColor: "#001219",
      });
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div ref={contentRef} className="px-2 sm:px-0 space-y-4">
      <section className="flex items-center justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-gray-400 hover:text-gray-200"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            <span>Back</span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-white">
            Edit User Details
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || isLoading || !selectedUser}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors bg-[#001825] border border-[#0A4D66]/40 text-[#7FD5FF] hover:bg-[#0A4D66]/20 disabled:opacity-60"
          >
            <Icon
              icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
              className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
            />
            <span>{isDownloadingPdf ? "Downloading..." : "Download"}</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUpdating || isLoading || !selectedUser}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors",
              isUpdating || isLoading || !selectedUser
                ? "bg-[#7FD5FF]/50 text-black cursor-not-allowed"
                : "bg-[#7FD5FF] text-black hover:bg-[#7FD5FF]/90",
            )}
          >
            <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
            <Icon icon="mdi:content-save-outline" className="w-4 h-4" />
          </button>
        </div>
      </section>

      {submitMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-400">
          {submitMessage}
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          {submitError}
        </div>
      )}

      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <h2 className="text-sm sm:text-base font-semibold text-white uppercase tracking-wide">
            User Information
          </h2>
        </div>

        <div className="px-4 sm:px-6 py-6">
          {isLoading ? (
            <div className="text-sm text-gray-400">Loading user details...</div>
          ) : !selectedUser ? (
            <div className="text-sm text-gray-400">No user found.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] uppercase text-gray-400">First Name</label>
                <input
                  type="text"
                  value={values.firstname}
                  onChange={handleChange("firstname")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                  placeholder="First name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase text-gray-400">Last Name</label>
                <input
                  type="text"
                  value={values.lastname}
                  onChange={handleChange("lastname")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                  placeholder="Last name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase text-gray-400">Username</label>
                <input
                  type="text"
                  value={values.username}
                  onChange={handleChange("username")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                  placeholder="Username"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase text-gray-400">Email</label>
                <input
                  type="email"
                  value={values.email}
                  onChange={handleChange("email")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                  placeholder="Email"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-[11px] uppercase text-gray-400">Phone Number</label>
                <input
                  type="text"
                  value={values.phone_number}
                  onChange={handleChange("phone_number")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-[11px] uppercase text-gray-400">Password</label>
                <input
                  type="password"
                  value={values.password}
                  onChange={handleChange("password")}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#7FD5FF]/40 transition-colors"
                  placeholder="Enter new password"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
