import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { useGetMeQuery } from "@/features/security/api";
import { useUpdateMeMutation } from "@/features/users/api";
import { updateCurrentUser } from "@/features/auth/authSlice";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import { BackButton } from "@/shared/ui/button";
import { useTheme } from "@/context/ThemeContext";

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
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const authUser = useAppSelector((state) => state.auth.user);
  // Refetch on open so a newly linked personnel record shows without a re-login.
  const { data: me, isLoading } = useGetMeQuery(undefined, { refetchOnMountOrArgChange: true });
  const [updateMe, { isLoading: isUpdating }] = useUpdateMeMutation();

  const [values, setValues] = useState<FormValues>(emptyValues);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const selectedUser = useMemo(() => {
    if (me) return me;
    return authUser ?? null;
  }, [authUser, me]);

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
      const updatedUser = await updateMe({
        firstname: values.firstname.trim(),
        lastname: values.lastname.trim(),
        username: values.username.trim(),
        email: values.email.trim(),
        phone_number: values.phone_number.trim(),
        ...(values.password.trim()
          ? { password: values.password.trim() }
          : {}),
      }).unwrap();
      dispatch(
        updateCurrentUser({
          id: String(updatedUser.id),
          firstname: updatedUser.firstname ?? undefined,
          lastname: updatedUser.lastname ?? undefined,
          username: updatedUser.username ?? undefined,
          email: updatedUser.email ?? undefined,
          phone_number: updatedUser.phone_number ?? undefined,
          roles: (updatedUser.roles ?? [])
            .filter((role) => Boolean(role?.name))
            .map((role) => ({
              id: role.id,
              name: role.name as string,
              guard_name: role.guard_name ?? undefined,
            })),
          role_names: updatedUser.role_names,
          permissions: updatedUser.permissions,
        }),
      );
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
    <div className={cn("space-y-6 max-w-5xl", isDark ? "text-slate-100" : "text-slate-800")}>
      {/* Executive Command Header */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all duration-200 shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <BackButton fallbackUrl="/dashboard/users" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  Account Credentials • IAM
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active Identity
                </span>
              </div>
              <h1 className={cn("text-2xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                {selectedUser ? `${selectedUser.firstname || ""} ${selectedUser.lastname || ""}`.trim() || selectedUser.username : "User Settings"}
              </h1>
              <p className={cn("text-xs mt-1 flex flex-wrap items-center gap-3", isDark ? "text-slate-400" : "text-slate-500")}>
                <span>Username: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>@{selectedUser?.username || "user"}</strong></span>
                <span>•</span>
                <span>Role: <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{selectedUser?.roles?.map((r) => r.name).join(", ") || "User"}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || isLoading || !selectedUser}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm disabled:opacity-50",
                isDark
                  ? "bg-[#001825] hover:bg-slate-800 border-[#0A4D66]/50 text-slate-200"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700"
              )}
            >
              <Icon
                icon={isDownloadingPdf ? "mdi:loading" : "mdi:file-pdf-box"}
                className={cn("w-4 h-4 text-red-500", isDownloadingPdf && "animate-spin")}
              />
              <span>{isDownloadingPdf ? "Exporting..." : "Export PDF"}</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUpdating || isLoading || !selectedUser}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-900/30 transition-all disabled:opacity-50"
            >
              <Icon icon={isUpdating ? "mdi:loading" : "mdi:content-save-outline"} className={cn("w-4 h-4", isUpdating && "animate-spin")} />
              <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>

      {submitMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
          <Icon icon="mdi:check-circle-outline" className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{submitMessage}</span>
        </div>
      )}

      {submitError && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
          <Icon icon="mdi:alert-circle-outline" className="w-4 h-4 shrink-0 text-red-400" />
          <span>{submitError}</span>
        </div>
      )}

      {/* 4-Column Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Security Role
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Icon icon="mdi:shield-account" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("text-base font-bold truncate capitalize", isDark ? "text-white" : "text-slate-900")}>
              {selectedUser?.roles?.[0]?.name || "Standard User"}
            </span>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              System Username
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Icon icon="mdi:account-badge-outline" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={cn("text-base font-bold font-mono", isDark ? "text-white" : "text-slate-900")}>
              @{selectedUser?.username || "—"}
            </span>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Email Address
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Icon icon="mdi:email-outline" className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={cn("text-xs font-medium truncate", isDark ? "text-slate-200" : "text-slate-700")}>
              {selectedUser?.email || "No email registered"}
            </div>
          </div>
        </div>

        <div className={cn(
          "p-4 rounded-2xl border transition-all",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-slate-400" : "text-slate-500")}>
              Personnel Record
            </span>
            <div className={cn("p-2 rounded-xl", me?.personnel_id ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
              <Icon icon={me?.personnel_id ? "mdi:check-decagram" : "mdi:link-variant-off"} className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", me?.personnel_id ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30")}>
              {me?.personnel_id ? `Linked (ID #${me.personnel_id})` : "Unlinked Login"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Profile Form Card */}
      <section
        ref={contentRef}
        className={cn(
          "rounded-2xl border overflow-hidden transition-all shadow-sm",
          isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
        )}
      >
        <div className={cn("px-6 py-4 border-b flex items-center gap-2", isDark ? "border-[#0A4D66]/30 bg-[#001825]/50" : "border-slate-200 bg-slate-50/50")}>
          <Icon icon="mdi:account-box-outline" className="w-5 h-5 text-sky-500" />
          <h2 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
            Personal & Credential Details
          </h2>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className={cn("text-sm py-8 text-center", isDark ? "text-slate-400" : "text-slate-500")}>
              <Icon icon="mdi:loading" className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
              Loading user credentials...
            </div>
          ) : !selectedUser ? (
            <div className={cn("text-sm py-8 text-center", isDark ? "text-slate-400" : "text-slate-500")}>
              No user details located.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  First Name
                </label>
                <input
                  type="text"
                  value={values.firstname}
                  onChange={handleChange("firstname")}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="First name"
                />
              </div>

              <div className="space-y-1.5">
                <label className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={values.lastname}
                  onChange={handleChange("lastname")}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="Last name"
                />
              </div>

              <div className="space-y-1.5">
                <label className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Username
                </label>
                <input
                  type="text"
                  value={values.username}
                  onChange={handleChange("username")}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-xs font-mono font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="Username"
                />
              </div>

              <div className="space-y-1.5">
                <label className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={values.email}
                  onChange={handleChange("email")}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="Email"
                />
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <label className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Phone Number
                </label>
                <input
                  type="text"
                  value={values.phone_number}
                  onChange={handleChange("phone_number")}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="+234..."
                />
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <label className={cn("text-xs font-semibold", isDark ? "text-slate-300" : "text-slate-700")}>
                  Password Reset <span className={cn("text-[11px] font-normal", isDark ? "text-slate-400" : "text-slate-500")}>(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={values.password}
                  onChange={handleChange("password")}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                    isDark
                      ? "bg-[#001825] border-[#0A4D66]/50 text-white placeholder-slate-600"
                      : "bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400"
                  )}
                  placeholder="Enter new password"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Self-service link to the personnel record */}
      <section className={cn(
        "rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm",
        isDark ? "bg-[#001219]/90 border-[#0A4D66]/40" : "bg-white border-slate-200"
      )}>
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
            <Icon icon="mdi:card-account-details-outline" className="w-6 h-6" />
          </div>
          <div>
            <h2 className={cn("text-sm font-bold uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
              My Military Personnel Record
            </h2>
            <p className={cn("text-xs mt-1 leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
              {me?.personnel_id
                ? "View your official service record, medical certifications, and contact dossier."
                : "Your login isn't linked to a personnel record yet. Ask an administrator to link it from your personnel details page."}
            </p>
          </div>
        </div>
        {me?.personnel_id ? (
          <Link
            to="/dashboard/users/my-personnel"
            state={{ from: "/dashboard/users", fromLabel: "User settings" }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all whitespace-nowrap shrink-0"
          >
            <Icon icon="mdi:account-edit-outline" className="w-4 h-4" />
            <span>Update Personnel Dossier</span>
          </Link>
        ) : null}
      </section>
    </div>
  );
};
