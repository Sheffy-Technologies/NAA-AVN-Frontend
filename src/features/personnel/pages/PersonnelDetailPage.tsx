import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useGetPersonnelByIdQuery, useDeletePersonnelMutation, useUpdatePersonnelMutation } from "@/features/personnel/api";
import { useGetPersonnelPassByIdQuery } from "@/features/personnel/passApi";
import { useGetAttendanceQuery } from "@/features/personnel/attendanceApi";
import { useGetCoursesQuery, type Course, type CourseStatus } from "@/features/personnel/courseApi";
import { InitiatePassModal } from "../components/InitiatePassModal";
import { RegisterCourseModal } from "../components/RegisterCourseModal";
import { EditCourseModal } from "../components/EditCourseModal";
import { useAppDispatch } from "@/app/store";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";
import { AppTabs } from "@/shared/ui/tabs/AppTabs";
import { BackButton } from "@/shared/ui/button/BackButton";
import { LinkedAccountCard } from "../components/LinkedAccountCard";

type PersonnelStatus = "Active" | "Grounded" | "Medical";

type PersonnelDetail = {
  id: string;
  serviceNo: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  rank: string;
  bloodGroup: string;
  callSign: string;
  ratings: {
    name: string;
    expiryDate: string | null;
    isLifetime?: boolean;
    issueDate?: string | null;
    derivedExperience?: string | null;
  }[];
  image: string | null;
  currentDeploymentDate: string;
  currentDeploymentUnit: string;
  lastDeploymentDate: string;
  lastDeploymentUnit: string;
  branch: string;
  corpsName: string;
  corpsDescription: string;
  specialty: string;
  status: PersonnelStatus;
  email: string;
  phone: string;
  address: string;
  dialogue: string;
  aircraftRatedOn: string;
  totalFlightTimeHours: number;
  totalOperationalHours: number;
  totalTrainingHours: number;
  aircraftHours: {
    name: string;
    hours: number;
    operationalHours?: number;
    trainingHours?: number;
  }[];
  isPilot: boolean;
  isEngineer: boolean;
  yearsOfExperience?: string;
  lastFlightDate: string | null;
  nextFlightDueDate: string | null;
  flightStatus: "no_flights" | "current" | "due_for_flight" | "overdue" | null;
};

type ActivityLogEntry = {
  id: string;
  date: string;
  time: string;
  action: string;
  oldRecord: string;
  newRecord: string;
  device: string;
  ip: string;
};

// const mockPersonnel: PersonnelDetail = {
//   id: "1",
//   serviceNo: "N/12345",
//   firstName: "Thomas",
//   lastName: "Okafor",
//   middleName: "Okafor",
//   rank: "Captain",
//   bloodGroup: "0+",
//   callSign: "Dragon",
//   rating: "PPL,CPL,INSTR",
//   currentDeploymentDate: "26 Jan 2026",
//   currentDeploymentUnit: "601 AVN BN – Jaji",
//   lastDeploymentDate: "26 Jan 2026",
//   lastDeploymentUnit: "601 AVN BN – Jaji",
//   branch: "Pilot",
//   corps: "N/12345",
//   specialty: "Rotary",
//   status: "Active",
//   email: "thomaokafor@gmail.com",
//   phone: "08123483762",
//   address: "maitama abuja",
//   dialogue: "Text for dialogue box",
//   aircraftRatedOn: "BELL UH/1H, MD530F,MAGNUS,",
//   totalFlightTimeHours: 180,
//   aircraftHours: [
//     { name: "BELL UH:", hours: 60 },
//     { name: "MD530F:", hours: 100 },
//     { name: "MAGNUS:", hours: 20 },
//   ],
// };

const mockActivityLog: ActivityLogEntry[] = [
  {
    id: "1",
    date: "26 Jan 2026",
    time: "14:30 Z",
    action: "Login",
    oldRecord: "Patrol",
    newRecord: "Patrol",
    device: "Desktop",
    ip: "197.210.12.45",
  },
  {
    id: "2",
    date: "26 Jan 2026",
    time: "14:30 Z",
    action: "Viewed Record",
    oldRecord: "Logistics",
    newRecord: "Logistics",
    device: "Phone",
    ip: "197.210.12.45",
  },
  {
    id: "3",
    date: "26 Jan 2026",
    time: "14:30 Z",
    action: "Downloaded Document",
    oldRecord: "Escort",
    newRecord: "Escort",
    device: "Desktop",
    ip: "197.210.12.45",
  },
  {
    id: "4",
    date: "26 Jan 2026",
    time: "14:30 Z",
    action: "Updated Record",
    oldRecord: "Reconnaissance",
    newRecord: "Reconnaissance",
    device: "Desktop",
    ip: "197.210.12.45",
  },
  {
    id: "5",
    date: "26 Jan 2026",
    time: "14:30 Z",
    action: "Failed Login Attempt",
    oldRecord: "Emergency",
    newRecord: "Emergency",
    device: "Phone",
    ip: "197.210.12.45",
  },
  {
    id: "6",
    date: "26 Jan 2026",
    time: "14:30 Z",
    action: "Role Changed",
    oldRecord: "Emergency",
    newRecord: "Emergency",
    device: "Desktop",
    ip: "197.210.12.45",
  },
];

const statusDotColor: Record<PersonnelStatus, string> = {
  Active: "bg-emerald-400",
  Grounded: "bg-red-400",
  Medical: "bg-amber-300",
};

type FlightStatus = "no_flights" | "current" | "due_for_flight" | "overdue";

const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  no_flights: "No Flights Logged",
  current: "Current",
  due_for_flight: "Due for Flight",
  overdue: "Overdue for Flight",
};

const FLIGHT_STATUS_COLORS: Record<FlightStatus, string> = {
  no_flights: "text-gray-400",
  current: "text-emerald-400",
  due_for_flight: "text-amber-400",
  overdue: "text-red-400",
};

const COURSE_STATUS_COLORS: Record<CourseStatus, string> = {
  scheduled: "text-blue-400",
  ongoing: "text-emerald-400",
  completed: "text-gray-400",
  cancelled: "text-red-400",
};

export const PersonnelDetailPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const { data: apiPerson, isLoading: isPersonLoading } =
    useGetPersonnelByIdQuery(id ?? "", {
      skip: !id,
    });
  const [deletePersonnel, { isLoading: isDeleting }] = useDeletePersonnelMutation();
  const [updatePersonnel, { isLoading: isUpdatingStatus }] = useUpdatePersonnelMutation();
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"bio" | "activity" | "pass" | "course" | "attendance">("bio");
  const [activityView, setActivityView] = useState<"grid" | "table">("grid");
  const [showInitiatePassModal, setShowInitiatePassModal] = useState(false);
  const [showRegisterCourseModal, setShowRegisterCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const { data: passData, isLoading: isPassLoading } = useGetPersonnelPassByIdQuery(
    id ?? "",
    { skip: !id || activeTab !== "pass" },
  );

  const { data: courses = [], isLoading: isCoursesLoading } = useGetCoursesQuery(
    { personnel_id: id ? Number(id) : undefined },
    { skip: !id || activeTab !== "course" },
  );

  const { data: attendanceLogs = [], isLoading: isAttendanceLoading } = useGetAttendanceQuery(
    { personnel_id: id ? Number(id) : undefined },
    { skip: !id || activeTab !== "attendance" },
  );

  const attendanceStats = useMemo(() => {
    if (!attendanceLogs.length) return { present: 0, absent: 0, late: 0, rate: 0, daysTillNextLeave: null };
    const present = attendanceLogs.filter((l) => l.status === "present" || l.status === "late").length;
    const absent = attendanceLogs.filter((l) => l.status === "absent").length;
    const total = attendanceLogs.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    // Next leave every 4 months from last_pass_date or today
    let daysTillNextLeave: number | null = null;
    if (apiPerson?.next_pass_date) {
      const diff = Math.ceil((new Date(apiPerson.next_pass_date).getTime() - Date.now()) / 86400000);
      daysTillNextLeave = diff;
    }
    return { present, absent, late: attendanceLogs.filter((l) => l.status === "late").length, rate, daysTillNextLeave };
  }, [attendanceLogs, apiPerson]);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const handleDeletePersonnel = async () => {
    if (!id || isDeleting) return;
    const name = apiPerson ? `${apiPerson.firstname} ${apiPerson.lastname}` : "this personnel";
    if (!window.confirm(`Delete ${name}? This action cannot be undone.`)) return;
    try {
      await deletePersonnel(id).unwrap();
      dispatch(showToast({ message: "Personnel deleted successfully", type: "success" }));
      navigate("/dashboard/personnel");
    } catch {
      dispatch(showToast({ message: "Failed to delete personnel", type: "error" }));
    }
  };

  const handleChangeStatus = async (newStatus: PersonnelStatus) => {
    if (!id) return;
    try {
      await updatePersonnel({
        id,
        data: { status: newStatus },
      }).unwrap();
      dispatch(showToast({ message: `Status updated to ${newStatus}`, type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to update status", type: "error" }));
    } finally {
      setIsStatusMenuOpen(false);
    }
  };

  const person: PersonnelDetail | null = useMemo(() => {
    if (!apiPerson) {
      return null;
    }

    const mapStatus = (status: string): PersonnelStatus => {
      const normalized = status.toLowerCase();
      if (normalized === "active") return "Active";
      if (normalized === "grounded") return "Grounded";
      return "Medical";
    };

    const formatDate = (dateString: string) => {
      if (!dateString) return "N/A";
      return new Date(dateString).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    const isEngineerRole =
      (apiPerson.specialty?.name || "").toLowerCase().includes("engineer") ||
      (apiPerson.specialty?.name || "").toLowerCase().includes("technician") ||
      (apiPerson.specialty?.name || "").toLowerCase().includes("maintenance") ||
      (apiPerson.specialty?.name || "").toLowerCase().includes("avionics") ||
      (apiPerson.specialty?.name || "").toLowerCase().includes("airframe") ||
      (apiPerson.specialty?.name || "").toLowerCase().includes("powerplant");

    const calculateExperienceFromDate = (dateStr?: string | null) => {
      if (!dateStr) return null;
      const issue = new Date(dateStr);
      if (isNaN(issue.getTime())) return null;
      const now = new Date();
      let years = now.getFullYear() - issue.getFullYear();
      let months = now.getMonth() - issue.getMonth();
      if (now.getDate() < issue.getDate()) {
        months--;
      }
      if (months < 0) {
        years--;
        months += 12;
      }
      if (years < 0) return "0 Months";
      const parts: string[] = [];
      if (years > 0) parts.push(`${years} Year${years > 1 ? "s" : ""}`);
      if (months > 0 || parts.length === 0)
        parts.push(`${months} Month${months !== 1 ? "s" : ""}`);
      return parts.join(", ");
    };

    const mappedRatings = Array.isArray(apiPerson.ratings)
      ? apiPerson.ratings
          .filter((rating) => typeof rating.name === "string" && rating.name.trim().length > 0)
          .map((rating) => ({
            name: rating.name,
            expiryDate: rating.pivot?.is_lifetime
              ? "Lifetime"
              : rating.pivot?.expiry_date
              ? formatDate(rating.pivot.expiry_date)
              : null,
            isLifetime: Boolean(
              rating.pivot?.is_lifetime ||
                (!rating.pivot?.expiry_date && rating.pivot?.issue_date),
            ),
            issueDate: rating.pivot?.issue_date
              ? formatDate(rating.pivot.issue_date)
              : null,
            derivedExperience: calculateExperienceFromDate(rating.pivot?.issue_date),
          }))
      : [];

    const fallbackRatings = apiPerson.rating_type
      ? apiPerson.rating_type
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((name) => ({ name, expiryDate: null }))
      : [];

    // Parse baseline platform flight experiences
    const parsedPlatforms: {
      name: string;
      hours: number;
      operationalHours: number;
      trainingHours: number;
    }[] = [];

    let baselineOperational = 0;
    let baselineTraining = 0;

    if (Array.isArray(apiPerson.flight_experiences)) {
      apiPerson.flight_experiences.forEach((exp) => {
        let opVal = 0;
        let trVal = 0;
        let platformName = exp.platform_name || "";

        if (exp.notes && exp.notes.startsWith("{")) {
          try {
            const parsed = JSON.parse(exp.notes);
            if (parsed.operational_hours !== undefined)
              opVal = Number(parsed.operational_hours) || 0;
            if (parsed.training_hours !== undefined)
              trVal = Number(parsed.training_hours) || 0;
            if (parsed.platform) platformName = parsed.platform;
          } catch {
            // ignore JSON error
          }
        }
        if (!opVal && !trVal) {
          opVal = Number(exp.operational_hours ?? exp.flight_hours ?? 0) || 0;
          trVal = Number(exp.training_hours ?? 0) || 0;
        }

        const platform = platformName || (exp.asset_id ? `Asset #${exp.asset_id}` : "Fleet Aircraft");
        baselineOperational += opVal;
        baselineTraining += trVal;

        parsedPlatforms.push({
          name: platform,
          hours: Number((opVal + trVal).toFixed(1)),
          operationalHours: Number(opVal.toFixed(1)),
          trainingHours: Number(trVal.toFixed(1)),
        });
      });
    }

    const baselineTotal = baselineOperational + baselineTraining;
    const totalFlightTimeHours = Number(apiPerson.total_flight_hours ?? baselineTotal) || 0;
    const loggedOperationsDifference = Math.max(0, totalFlightTimeHours - baselineTotal);

    const totalOperationalHours = Number((baselineOperational + loggedOperationsDifference).toFixed(1));
    const totalTrainingHours = Number(baselineTraining.toFixed(1));

    const sortedDeployments = [...apiPerson.deployments].sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );
    const lastDeployment =
      sortedDeployments.length > 0 ? sortedDeployments[0] : null;

    const branchName = (apiPerson.branch?.name || "").toLowerCase();
    const specName = (apiPerson.specialty?.name || "").toLowerCase();

    const isExplicitNonPilot =
      isEngineerRole ||
      branchName.includes("engineer") ||
      branchName.includes("technician") ||
      branchName.includes("maintenance") ||
      branchName.includes("admin") ||
      branchName.includes("logistics") ||
      branchName.includes("medical") ||
      branchName.includes("supply") ||
      specName.includes("engineer") ||
      specName.includes("technician") ||
      specName.includes("maintenance");

    const hasPilotIndicator =
      apiPerson.is_pilot === true ||
      branchName.includes("pilot") ||
      branchName.includes("flight") ||
      branchName.includes("aircrew") ||
      branchName.includes("flying") ||
      specName.includes("pilot");

    const isPilot = hasPilotIndicator && !isExplicitNonPilot;

    // Derive overall years of experience for non-pilot personnel
    let earliestDate: string | null = null;
    if (Array.isArray(apiPerson.ratings)) {
      const validDates = apiPerson.ratings
        .map((r) => r.pivot?.issue_date)
        .filter((d): d is string => Boolean(d && !isNaN(new Date(d).getTime())));
      if (validDates.length > 0) {
        validDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        earliestDate = validDates[0];
      }
    }

    if (!earliestDate && apiPerson.date_taken) {
      earliestDate = apiPerson.date_taken;
    }

    if (!earliestDate && apiPerson.created_at) {
      earliestDate = apiPerson.created_at;
    }

    const yearsOfExperience = calculateExperienceFromDate(earliestDate) || "Active Service";

    return {
      id: String(apiPerson.id),
      serviceNo: apiPerson.service_number,
      firstName: apiPerson.firstname,
      lastName: apiPerson.lastname,
      middleName: apiPerson.othernames || undefined,
      rank: apiPerson.rank.name,
      bloodGroup: apiPerson.blood_group,
      callSign: apiPerson.call_sign,
      ratings: mappedRatings.length > 0 ? mappedRatings : fallbackRatings,
      image: apiPerson.image,
      currentDeploymentDate: apiPerson.latest_deployment
        ? formatDate(apiPerson.latest_deployment.start_date)
        : "N/A",
      currentDeploymentUnit:
        apiPerson.latest_deployment?.to_unit?.name || apiPerson.unit.name,
      lastDeploymentDate: lastDeployment
        ? formatDate(lastDeployment.end_date || lastDeployment.start_date)
        : "N/A",
      lastDeploymentUnit: lastDeployment?.to_unit?.name || "N/A",
      branch: apiPerson.branch.name,
      corpsName: apiPerson.corp?.name || "N/A",
      corpsDescription: apiPerson.corp?.description || "No corps details available",
      specialty: apiPerson.specialty.name,
      status: mapStatus(apiPerson.status),
      email: apiPerson.email,
      phone: apiPerson.phone_number,
      address: apiPerson.address,
      dialogue: "",
      aircraftRatedOn: apiPerson.rating_type || "N/A",
      totalFlightTimeHours,
      totalOperationalHours,
      totalTrainingHours,
      aircraftHours: parsedPlatforms,
      isPilot,
      isEngineer: isEngineerRole,
      yearsOfExperience,
      lastFlightDate: apiPerson.last_flight_date,
      nextFlightDueDate: apiPerson.next_flight_due_date,
      flightStatus: apiPerson.flight_status,
    };
  }, [apiPerson]);

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !person || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${person.firstName}-${person.lastName}-${person.id}`,
        backgroundColor: isDark ? "#001219" : "#ffffff",
      });
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch (error) {
      console.error("Failed to download personnel PDF", {
        personnelId: person.id,
        fileName: `${person.firstName}-${person.lastName}-${person.id}`,
        error,
      });
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Executive Header Card ────────────────────────────── */}
      <div
        className={cn(
          "rounded-2xl border p-5 sm:p-6 transition-all shadow-sm",
          isDark
            ? "bg-[#001219]/90 border-[#0A4D66]/50 backdrop-blur-md"
            : "bg-white border-slate-200 shadow-slate-100",
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <BackButton fallbackUrl="/dashboard/personnel" />

            {/* Personnel Identity & Avatar */}
            <div className="flex items-center gap-3.5">
              {person?.image ? (
                <img
                  src={person.image}
                  alt={`${person.firstName} ${person.lastName}`}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-cyan-500/30"
                />
              ) : (
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-inner",
                    isDark
                      ? "bg-gradient-to-br from-cyan-950 to-[#0A4D66] text-cyan-200 border border-cyan-500/30"
                      : "bg-gradient-to-br from-sky-100 to-sky-200 text-sky-800 border border-sky-300",
                  )}
                >
                  {person?.firstName?.[0] || "P"}{person?.lastName?.[0] || "N"}
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1
                    className={cn(
                      "text-xl sm:text-2xl font-bold tracking-tight",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    {person ? `${person.rank} ${person.firstName} ${person.lastName}` : "Personnel Dossier"}
                  </h1>

                  {/* Status Pill */}
                  {person && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border",
                        person.status === "Active"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : person.status === "Grounded"
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                          : "bg-rose-500/15 border-rose-500/40 text-rose-400",
                      )}
                    >
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          statusDotColor[person.status] || "bg-emerald-400",
                          person.status === "Active" ? "animate-pulse" : "",
                        )}
                      />
                      {person.status}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm mt-1">
                  <span className={cn("font-mono font-medium", isDark ? "text-cyan-400" : "text-sky-600")}>
                    SVC: {person?.serviceNo || "—"}
                  </span>
                  <span className={isDark ? "text-gray-500" : "text-slate-300"}>•</span>
                  <span className={isDark ? "text-gray-300" : "text-slate-600"}>
                    {person?.branch || "Armed Forces"}
                  </span>
                  <span className={isDark ? "text-gray-500" : "text-slate-300"}>•</span>
                  <span className={isDark ? "text-gray-400" : "text-slate-500"}>
                    {person?.specialty || "General Duty"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || !person}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors shadow-sm disabled:opacity-50",
                isDark
                  ? "bg-[#0A4D66]/30 border-[#0A4D66]/70 text-cyan-200 hover:bg-[#0A4D66]/50"
                  : "bg-white border-[#0A4D66]/60 text-slate-800 hover:bg-slate-50",
              )}
            >
              <Icon
                icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
                className={cn("w-3.5 h-3.5 text-sky-500", isDownloadingPdf && "animate-spin")}
              />
              <span>{isDownloadingPdf ? "Downloading..." : "Download"}</span>
            </button>

            <button
              type="button"
              onClick={handleDeletePersonnel}
              disabled={isDeleting}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors shadow-sm disabled:opacity-50",
                isDark
                  ? "border-red-700/60 text-red-300 hover:bg-red-900/30"
                  : "border-red-300 bg-white text-red-600 hover:bg-red-50",
              )}
            >
              <Icon icon="mdi:trash-can-outline" className="w-3.5 h-3.5 text-red-500" />
              <span>{isDeleting ? "Deleting..." : "Delete"}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                disabled={isUpdatingStatus}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors shadow-sm disabled:opacity-50",
                  isDark
                    ? "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <span>Update status</span>
                <Icon icon="mdi:chevron-down" className="w-3 h-3 opacity-60" />
              </button>

              {isStatusMenuOpen && !isUpdatingStatus && (
                <div
                  className={cn(
                    "absolute right-0 mt-1 w-32 rounded-md border shadow-lg z-30 overflow-hidden py-1",
                    isDark ? "bg-[#001219] border-[#0A4D66]/50 text-white" : "bg-white border-slate-200 text-slate-800",
                  )}
                >
                  {(["Active", "Grounded", "Medical"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleChangeStatus(status)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors",
                        isDark ? "hover:bg-[#0A4D66]/40" : "hover:bg-slate-100",
                      )}
                    >
                      <span>{status}</span>
                      {person?.status === status && (
                        <Icon icon="mdi:check" className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(`/dashboard/personnel/${id}/edit`)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors shadow-sm",
                isDark
                  ? "border-[#0A4D66]/60 text-gray-200 hover:bg-[#0A4D66]/30"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <span>Edit</span>
            </button>
          </div>
        </div>

        {/* ── 4-Card Executive KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5 mt-5 border-t border-inherit">
          <div
            className={cn(
              "p-3.5 rounded-xl border flex flex-col gap-1 transition-all",
              isDark ? "bg-[#001825]/60 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200/80",
            )}
          >
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
              Operational Role
            </span>
            <span className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              {person?.isPilot ? "Flight Aircrew" : person?.isEngineer ? "Maintenance Engineer" : "Specialist"}
            </span>
            <span className={cn("text-[11px] font-mono", isDark ? "text-cyan-400" : "text-sky-600")}>
              Callsign: {person?.callSign || "—"}
            </span>
          </div>

          <div
            className={cn(
              "p-3.5 rounded-xl border flex flex-col gap-1 transition-all",
              isDark ? "bg-[#001825]/60 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200/80",
            )}
          >
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
              Tasked Assignment
            </span>
            <span className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
              {person?.currentDeploymentUnit || "Unassigned"}
            </span>
            <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>
              Since: {person?.currentDeploymentDate || "—"}
            </span>
          </div>

          <div
            className={cn(
              "p-3.5 rounded-xl border flex flex-col gap-1 transition-all",
              isDark ? "bg-[#001825]/60 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200/80",
            )}
          >
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
              {person?.isPilot ? "Logbook Hours" : "Service Record"}
            </span>
            <span className={cn("text-sm font-bold truncate", isDark ? "text-cyan-300" : "text-sky-700")}>
              {person?.isPilot ? `${person.totalFlightTimeHours} Flight Hours` : person?.yearsOfExperience || "Active Duty"}
            </span>
            <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>
              {person?.ratings.length ?? 0} Certified Ratings
            </span>
          </div>

          <div
            className={cn(
              "p-3.5 rounded-xl border flex flex-col gap-1 transition-all",
              isDark ? "bg-[#001825]/60 border-[#0A4D66]/30" : "bg-slate-50 border-slate-200/80",
            )}
          >
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
              Medical &amp; Readiness
            </span>
            <span className={cn("text-sm font-bold truncate", isDark ? "text-emerald-400" : "text-emerald-600")}>
              Blood: {person?.bloodGroup || "—"}
            </span>
            <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>
              Readiness: {person?.status || "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Tabbed Content Section ──────────────────────── */}
      <section
        className={cn(
          "rounded-2xl border overflow-hidden shadow-sm transition-all",
          isDark
            ? "bg-[#001219]/90 border-[#0A4D66]/50 backdrop-blur-md"
            : "bg-white border-slate-200 shadow-slate-100",
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-2.5 border-b",
            isDark ? "border-[#0A4D66]/40 bg-[#001422]/60" : "border-slate-200 bg-slate-50/70",
          )}
        >
          <AppTabs
            tabs={[
              { id: "bio", label: "Personnel Bio Data", icon: "mdi:shield-account-outline" },
              { id: "activity", label: "Activity Log", icon: "mdi:clock-outline" },
              { id: "pass", label: "Pass Records", icon: "mdi:calendar-check-outline" },
              { id: "course", label: "Courses & Training", icon: "mdi:school-outline" },
              { id: "attendance", label: "Duty Attendance", icon: "mdi:clipboard-check-outline" },
            ]}
            activeTab={activeTab}
            onChange={(tab) => setActiveTab(tab as typeof activeTab)}
            size="sm"
            containerClassName="border-b-0"
          />

          {activeTab === "activity" && (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "hidden sm:flex items-center gap-1 rounded-lg border p-1",
                  isDark ? "border-[#0A4D66]/40 bg-[#001219]" : "border-slate-200 bg-slate-100",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActivityView("table")}
                  aria-label="Switch to table view"
                  title="Table view"
                  className={cn(
                    "px-2 py-1 rounded-md flex items-center justify-center transition-colors",
                    activityView === "table"
                      ? isDark
                        ? "bg-[#0A4D66] text-white"
                        : "bg-white text-slate-800 shadow-sm"
                      : isDark
                      ? "text-gray-400 hover:text-white"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Icon icon="mdi:view-list" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActivityView("grid")}
                  aria-label="Switch to grid view"
                  title="Grid view"
                  className={cn(
                    "px-2 py-1 rounded-md flex items-center justify-center transition-colors",
                    activityView === "grid"
                      ? isDark
                        ? "bg-[#0A4D66] text-white"
                        : "bg-white text-slate-800 shadow-sm"
                      : isDark
                      ? "text-gray-400 hover:text-white"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
                </button>
              </div>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-xs font-mono font-medium",
                  isDark ? "border-[#0A4D66]/40 bg-[#001219] text-gray-200" : "border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                {mockActivityLog.length} events
              </span>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf || !person}
                aria-label="Download personnel details"
                title="Download personnel details"
                className={cn(
                  "inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors",
                  isDark
                    ? "border-[#0A4D66]/40 bg-[#001219] text-gray-300 hover:bg-[#0A4D66]/30"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon
                  icon={isDownloadingPdf ? "mdi:loading" : "mdi:download-outline"}
                  className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
                />
              </button>
            </div>
          )}
        </div>

        {activeTab === "bio" && apiPerson && <LinkedAccountCard personnelId={apiPerson.id} user={apiPerson.user} />}
        {activeTab === "bio" && (
          <div ref={contentRef} className="p-4 sm:p-6">
            {isPersonLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="inline-flex items-center gap-2 text-gray-200">
                  <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                  <span>Loading personnel details...</span>
                </div>
              </div>
            ) : !person ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-gray-400">
                  No personnel details found.
                </span>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[280px,1.4fr,1.3fr]">
                {/* Left Column: Photo & Core Vitals */}
                <div className="space-y-4">
                  {/* Photo & Call Sign Badge */}
                  <div
                    className={cn(
                      "rounded-2xl border p-5 flex flex-col items-center gap-3.5 transition-all text-center",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40" : "bg-white border-slate-200 shadow-sm",
                    )}
                  >
                    {person.image ? (
                      <img
                        src={person.image}
                        alt={`${person.firstName} ${person.lastName}`}
                        className="w-32 h-32 rounded-2xl object-cover ring-2 ring-cyan-500/40 shadow-md"
                      />
                    ) : (
                      <div
                        className={cn(
                          "w-32 h-32 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner",
                          isDark
                            ? "bg-gradient-to-br from-cyan-950 to-[#0A4D66] text-cyan-200 border border-cyan-500/30"
                            : "bg-gradient-to-br from-sky-100 to-sky-200 text-sky-800 border border-sky-300",
                        )}
                      >
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </div>
                    )}
                    <div>
                      <div className={cn("text-base font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
                        {person.firstName} {person.lastName}
                      </div>
                      <div className={cn("text-xs font-mono font-medium mt-1", isDark ? "text-cyan-400" : "text-sky-600")}>
                        Service No: {person.serviceNo}
                      </div>
                      <span
                        className={cn(
                          "inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border",
                          isDark
                            ? "bg-[#0A4D66]/30 border-[#0A4D66]/60 text-cyan-300"
                            : "bg-slate-100 border-slate-200 text-slate-700",
                        )}
                      >
                        {person.rank}
                      </span>
                    </div>
                  </div>

                  {/* Core Military Vitals Card */}
                  <div
                    className={cn(
                      "rounded-2xl border p-4.5 space-y-3 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider pb-2 border-b", isDark ? "text-cyan-400 border-white/5" : "text-sky-700 border-slate-100")}>
                      Military Vitals
                    </div>
                    <div className="grid gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className={isDark ? "text-gray-400" : "text-slate-500"}>Blood Group:</span>
                        <span className={cn("font-bold px-2 py-0.5 rounded text-xs", isDark ? "bg-red-950/60 text-red-300 border border-red-800/40" : "bg-red-50 text-red-700 border border-red-200")}>
                          {person.bloodGroup || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={isDark ? "text-gray-400" : "text-slate-500"}>Call Sign:</span>
                        <span className={cn("font-mono font-bold", isDark ? "text-cyan-300" : "text-sky-700")}>
                          {person.callSign || "—"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-inherit">
                        <span className={cn("block text-[11px] mb-1.5", isDark ? "text-gray-400" : "text-slate-500")}>
                          Airframe &amp; System Ratings:
                        </span>
                        {person.ratings.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {person.ratings.map((rating) => (
                              <span
                                key={`${rating.name}-${rating.expiryDate ?? "none"}`}
                                className={cn(
                                  "inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                  isDark
                                    ? "border-cyan-500/30 bg-cyan-950/40 text-cyan-200"
                                    : "border-sky-200 bg-sky-50 text-sky-800",
                                )}
                              >
                                {rating.name}
                                {rating.isLifetime
                                  ? " (Lifetime)"
                                  : rating.expiryDate
                                  ? ` (${rating.expiryDate})`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className={isDark ? "text-gray-500 text-xs italic" : "text-slate-400 text-xs italic"}>None on record</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prior Deployment */}
                  <div
                    className={cn(
                      "rounded-2xl border p-4.5 space-y-2.5 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                      Previous Deployment
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:calendar-blank-outline" className={cn("w-4 h-4", isDark ? "text-cyan-400" : "text-sky-600")} />
                      <span className={isDark ? "text-white" : "text-slate-800"}>{person.lastDeploymentDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:office-building" className={cn("w-4 h-4", isDark ? "text-cyan-400" : "text-sky-600")} />
                      {(() => {
                        const sortedDeps = [...(apiPerson?.deployments ?? [])].sort(
                          (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
                        );
                        const lastUnitId = sortedDeps[0]?.to_unit_id;
                        return lastUnitId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/units/${lastUnitId}`)}
                            className={cn("text-left font-medium hover:underline", isDark ? "text-cyan-300" : "text-sky-600")}
                          >
                            {person.lastDeploymentUnit}
                          </button>
                        ) : (
                          <span className={isDark ? "text-white" : "text-slate-800"}>{person.lastDeploymentUnit}</span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Center Column: Identification & Duty Station */}
                <div className="space-y-4">
                  {/* Identification Card */}
                  <div
                    className={cn(
                      "rounded-2xl border p-5 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-3.5 pb-2 border-b", isDark ? "text-cyan-400 border-white/5" : "text-sky-700 border-slate-100")}>
                      Personnel Identification Records
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Service Number</span>
                        <span className={cn("font-mono font-bold text-sm", isDark ? "text-cyan-300" : "text-sky-700")}>
                          {person.serviceNo}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>First Name</span>
                        <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {person.firstName}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Last Name</span>
                        <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {person.lastName}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Middle Name</span>
                        <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {person.middleName || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Unit Card */}
                  <div
                    className={cn(
                      "rounded-2xl border p-5 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", isDark ? "text-gray-400" : "text-slate-500")}>
                      Assigned Formation &amp; Base
                    </div>
                    {apiPerson?.unit?.id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/units/${apiPerson.unit.id}`)}
                        className={cn("text-left font-bold text-base hover:underline flex items-center gap-1.5", isDark ? "text-cyan-300" : "text-sky-700")}
                      >
                        <Icon icon="mdi:shield-airplane-outline" className="w-5 h-5 shrink-0" />
                        <span>{person.currentDeploymentUnit}</span>
                      </button>
                    ) : (
                      <p className={cn("font-semibold text-base", isDark ? "text-white" : "text-slate-900")}>
                        {person.currentDeploymentUnit}
                      </p>
                    )}
                  </div>

                  {person.isPilot && (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 text-xs sm:text-sm transition-all",
                        isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                      )}
                    >
                      <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", isDark ? "text-gray-400" : "text-slate-500")}>
                        Type Rating (Authorized Platform)
                      </div>
                      <p className={cn("font-bold text-base", isDark ? "text-white" : "text-slate-900")}>
                        {person.aircraftRatedOn}
                      </p>
                    </div>
                  )}

                  {/* Current Active Deployment */}
                  <div
                    className={cn(
                      "rounded-2xl border p-5 space-y-2.5 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                      Current Active Tour of Duty
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:calendar-check-outline" className={cn("w-4 h-4", isDark ? "text-cyan-400" : "text-sky-600")} />
                      <span className={isDark ? "text-white font-medium" : "text-slate-800 font-medium"}>Effective: {person.currentDeploymentDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="mdi:crosshairs-gps" className={cn("w-4 h-4", isDark ? "text-cyan-400" : "text-sky-600")} />
                      {apiPerson?.latest_deployment?.to_unit_id ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/units/${apiPerson.latest_deployment!.to_unit_id}`)}
                          className={cn("text-left font-medium hover:underline", isDark ? "text-cyan-300" : "text-sky-600")}
                        >
                          {person.currentDeploymentUnit}
                        </button>
                      ) : (
                        <span className={isDark ? "text-white" : "text-slate-800"}>{person.currentDeploymentUnit}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Service Record, Specialization & Experience */}
                <div className="space-y-4">
                  {/* Service Details Card */}
                  <div
                    className={cn(
                      "rounded-2xl border p-5 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-3.5 pb-2 border-b", isDark ? "text-cyan-400 border-white/5" : "text-sky-700 border-slate-100")}>
                      Military Service Designation
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Branch of Service</span>
                        <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {person.branch}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Corps</span>
                        <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {person.corpsName}
                        </span>
                      </div>
                      <div className="sm:col-span-2 flex flex-col gap-0.5">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Specialty / Trade</span>
                        <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-slate-900")}>
                          {person.specialty}
                        </span>
                      </div>
                      <div className="sm:col-span-2 flex items-center justify-between pt-1">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Operational Status:</span>
                        <span className="flex items-center gap-1.5 font-bold text-xs">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              statusDotColor[person.status] || "bg-emerald-400",
                              person.status === "Active" ? "animate-pulse" : "",
                            )}
                          />
                          <span className={person.status === "Active" ? "text-emerald-400" : "text-amber-400"}>
                            {person.status}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Card */}
                  <div
                    className={cn(
                      "rounded-2xl border p-5 text-xs sm:text-sm transition-all",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                    )}
                  >
                    <div className={cn("text-[10px] font-bold uppercase tracking-wider mb-3.5 pb-2 border-b", isDark ? "text-cyan-400 border-white/5" : "text-sky-700 border-slate-100")}>
                      Official Contact Coordinates
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={isDark ? "text-gray-400" : "text-slate-500"}>Email:</span>
                        <span className={cn("font-mono truncate max-w-[200px]", isDark ? "text-cyan-300" : "text-sky-700")}>
                          {person.email || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={isDark ? "text-gray-400" : "text-slate-500"}>Phone:</span>
                        <span className={cn("font-mono font-medium", isDark ? "text-white" : "text-slate-800")}>
                          {person.phone || "—"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-inherit flex flex-col gap-1">
                        <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Residential / Base Address:</span>
                        <span className={cn("text-xs leading-relaxed", isDark ? "text-gray-300" : "text-slate-600")}>
                          {person.address || "Unspecified base accommodation"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pilot Flight Hours Breakdown Card */}
                  {person.isPilot && (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 text-xs sm:text-sm space-y-3.5 transition-all",
                        isDark ? "bg-[#001825]/80 border-cyan-500/30 text-gray-200" : "bg-white border-sky-200 text-slate-700 shadow-sm",
                      )}
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-inherit">
                        <div className={cn("text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5", isDark ? "text-cyan-400" : "text-sky-700")}>
                          <Icon icon="mdi:airplane-clock" className="w-4 h-4" />
                          <span>Logged Aircrew Flight Hours</span>
                        </div>
                        <div className={cn("text-base font-extrabold tracking-wide", isDark ? "text-white" : "text-slate-900")}>
                          {person.totalFlightTimeHours} <span className={cn("text-xs font-normal", isDark ? "text-cyan-400" : "text-sky-600")}>HRS</span>
                        </div>
                      </div>

                      {/* Operational vs Training Dual Breakdown */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className={cn("rounded-xl p-3 border", isDark ? "bg-[#001219]/70 border-cyan-500/20" : "bg-sky-50/60 border-sky-200")}>
                          <span className={cn("text-[10px] uppercase font-semibold block tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                            Operational
                          </span>
                          <span className={cn("text-base font-bold mt-0.5 block", isDark ? "text-cyan-300" : "text-sky-800")}>
                            {person.totalOperationalHours} <span className="text-xs font-normal text-inherit/70">h</span>
                          </span>
                        </div>
                        <div className={cn("rounded-xl p-3 border", isDark ? "bg-[#001219]/70 border-cyan-500/20" : "bg-sky-50/60 border-sky-200")}>
                          <span className={cn("text-[10px] uppercase font-semibold block tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                            Training
                          </span>
                          <span className={cn("text-base font-bold mt-0.5 block", isDark ? "text-cyan-300" : "text-sky-800")}>
                            {person.totalTrainingHours} <span className="text-xs font-normal text-inherit/70">h</span>
                          </span>
                        </div>
                      </div>

                      {/* Platform Breakdown */}
                      {person.aircraftHours.length > 0 && (
                        <div className="pt-2 border-t border-inherit space-y-2">
                          <div className={cn("text-[10px] uppercase font-semibold", isDark ? "text-gray-400" : "text-slate-500")}>
                            Platform Breakdown
                          </div>
                          {person.aircraftHours.map((aircraft) => (
                            <div
                              key={aircraft.name}
                              className="flex items-center justify-between py-1 border-b border-inherit last:border-0 text-xs"
                            >
                              <span className={cn("font-medium truncate max-w-[140px]", isDark ? "text-cyan-300" : "text-sky-700")}>
                                {aircraft.name}
                              </span>
                              <div className="flex items-center gap-2.5 text-[11px]">
                                <span className={isDark ? "text-gray-400" : "text-slate-500"}>
                                  Op: <span className={cn("font-medium", isDark ? "text-gray-200" : "text-slate-800")}>{aircraft.operationalHours ?? aircraft.hours}h</span>
                                </span>
                                <span className={isDark ? "text-gray-400" : "text-slate-500"}>
                                  Tr: <span className={cn("font-medium", isDark ? "text-gray-200" : "text-slate-800")}>{aircraft.trainingHours ?? 0}h</span>
                                </span>
                                <span className={cn("font-bold pl-1", isDark ? "text-white" : "text-slate-900")}>
                                  {aircraft.hours}h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Career Experience & Credentials Card (Non-Pilot Personnel) */}
                  {!person.isPilot && (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 text-xs sm:text-sm space-y-3.5 transition-all",
                        isDark ? "bg-[#001825]/80 border-emerald-500/30 text-gray-200" : "bg-white border-emerald-200 text-slate-700 shadow-sm",
                      )}
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-inherit">
                        <div className={cn("text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5", isDark ? "text-emerald-400" : "text-emerald-700")}>
                          <Icon
                            icon={person.isEngineer ? "mdi:wrench-clock" : "mdi:briefcase-clock-outline"}
                            className="w-4 h-4 text-emerald-500"
                          />
                          <span>
                            {person.isEngineer
                              ? "Engineering Experience"
                              : "Professional Track"}
                          </span>
                        </div>
                        <div className={cn("text-base font-extrabold tracking-wide", isDark ? "text-white" : "text-slate-900")}>
                          {person.yearsOfExperience || "Active Duty"}
                        </div>
                      </div>

                      {/* Discipline & Verified Credentials Dual Summary */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className={cn("rounded-xl p-3 border", isDark ? "bg-[#001219]/70 border-emerald-500/20" : "bg-emerald-50/60 border-emerald-200")}>
                          <span className={cn("text-[10px] uppercase font-semibold block tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                            Specialty
                          </span>
                          <span className={cn("text-xs font-semibold mt-0.5 block truncate", isDark ? "text-emerald-300" : "text-emerald-800")} title={person.specialty}>
                            {person.specialty || person.branch || "General Service"}
                          </span>
                        </div>
                        <div className={cn("rounded-xl p-3 border", isDark ? "bg-[#001219]/70 border-emerald-500/20" : "bg-emerald-50/60 border-emerald-200")}>
                          <span className={cn("text-[10px] uppercase font-semibold block tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                            Credentials
                          </span>
                          <span className={cn("text-xs font-semibold mt-0.5 block", isDark ? "text-emerald-300" : "text-emerald-800")}>
                            {person.ratings.length} {person.ratings.length === 1 ? "Certification" : "Certifications"}
                          </span>
                        </div>
                      </div>

                      {/* Credentials & Licensure Breakdown */}
                      <div className="pt-2 border-t border-inherit space-y-2">
                        <div className={cn("text-[10px] uppercase font-semibold flex items-center justify-between", isDark ? "text-gray-400" : "text-slate-500")}>
                          <span>Certifications &amp; Licenses</span>
                          {person.ratings.length > 0 && (
                            <span className={cn("font-mono font-medium", isDark ? "text-emerald-400" : "text-emerald-700")}>
                              {person.ratings.length} on file
                            </span>
                          )}
                        </div>

                        {person.ratings.length > 0 ? (
                          <div className="space-y-1.5">
                            {person.ratings.map((rating) => (
                              <div
                                key={rating.name}
                                className={cn("rounded-xl border p-2.5 text-xs space-y-1", isDark ? "bg-[#001219]/70 border-emerald-500/20" : "bg-slate-50 border-slate-200")}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn("font-medium text-xs truncate max-w-[180px]", isDark ? "text-white" : "text-slate-900")} title={rating.name}>
                                    {rating.name}
                                  </span>
                                  {rating.isLifetime ? (
                                    <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border", isDark ? "text-emerald-300 bg-emerald-950/80 border-emerald-500/30" : "text-emerald-800 bg-emerald-100 border-emerald-300")}>
                                      Lifetime
                                    </span>
                                  ) : rating.expiryDate ? (
                                    <span className={cn("text-[10px]", isDark ? "text-gray-400" : "text-slate-500")}>
                                      Exp: {rating.expiryDate}
                                    </span>
                                  ) : null}
                                </div>

                                {rating.issueDate && (
                                  <div className={cn("text-[10px] flex items-center justify-between pt-0.5", isDark ? "text-gray-400" : "text-slate-500")}>
                                    <span>Issued: {rating.issueDate}</span>
                                    {rating.derivedExperience && (
                                      <span className={cn("font-medium", isDark ? "text-emerald-300" : "text-emerald-700")}>
                                        {rating.derivedExperience} Exp
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={cn("text-xs italic", isDark ? "text-gray-500" : "text-slate-400")}>
                            No specialized licenses logged. Service duration recorded from enlistment.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Flight Currency Card */}
                  {person.isPilot && (
                    <div
                      className={cn(
                        "rounded-2xl border p-5 text-xs sm:text-sm space-y-3 transition-all",
                        isDark ? "bg-[#001825]/80 border-[#0A4D66]/40 text-gray-200" : "bg-white border-slate-200 text-slate-700 shadow-sm",
                      )}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-inherit">
                        <div className={cn("text-[10px] font-bold uppercase tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                          Flight Currency Status
                        </div>
                        {person.flightStatus && (
                          <span
                            className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded-full border",
                              FLIGHT_STATUS_COLORS[person.flightStatus],
                            )}
                          >
                            {FLIGHT_STATUS_LABELS[person.flightStatus]}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Last Logged Flight</span>
                          <span className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                            {person.lastFlightDate
                              ? new Date(person.lastFlightDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className={cn("text-[11px]", isDark ? "text-gray-400" : "text-slate-500")}>Recurrency Due By</span>
                          <span className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                            {person.nextFlightDueDate
                              ? new Date(person.nextFlightDueDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div ref={contentRef} className="p-4 sm:p-6">
            {activityView === "grid" && (
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mockActivityLog.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "border rounded-xl p-4 flex flex-col gap-2.5 transition-all shadow-sm",
                      isDark ? "bg-[#001825]/80 border-[#0A4D66]/40" : "bg-white border-slate-200",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn("text-sm font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
                        {entry.action}
                      </div>
                      <span className={cn("text-xs font-mono font-medium", isDark ? "text-cyan-400" : "text-sky-600")}>
                        {entry.ip}
                      </span>
                    </div>
                    <div className={cn("flex flex-wrap items-center gap-3 text-[11px]", isDark ? "text-gray-300" : "text-slate-600")}>
                      <div className="flex items-center gap-1">
                        <Icon icon="mdi:calendar-blank-outline" className={cn("w-3.5 h-3.5", isDark ? "text-gray-400" : "text-slate-400")} />
                        <span>{entry.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon icon="mdi:clock-outline" className={cn("w-3.5 h-3.5", isDark ? "text-gray-400" : "text-slate-400")} />
                        <span>{entry.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon icon="mdi:monitor" className={cn("w-3.5 h-3.5", isDark ? "text-gray-400" : "text-slate-400")} />
                        <span>{entry.device}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activityView === "table" && (
              <div className={cn("overflow-x-auto rounded-xl border shadow-sm", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className={cn("border-b text-[11px] uppercase tracking-wider font-semibold", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400" : "bg-slate-100 border-slate-200 text-slate-600")}>
                      <th className="px-4 sm:px-6 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Action Performed</th>
                      <th className="px-4 py-3 text-left">Old Record</th>
                      <th className="px-4 py-3 text-left">New Record</th>
                      <th className="px-4 py-3 text-left">Device</th>
                      <th className="px-4 py-3 text-left">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockActivityLog.map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={cn(
                          "border-t transition-colors",
                          isDark
                            ? index % 2 === 0
                              ? "bg-[#001219]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                              : "bg-[#001825]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                            : index % 2 === 0
                            ? "bg-white border-slate-100 hover:bg-slate-50"
                            : "bg-slate-50/60 border-slate-100 hover:bg-slate-50",
                        )}
                      >
                        <td className={cn("px-4 sm:px-6 py-3 font-medium", isDark ? "text-white" : "text-slate-900")}>
                          {entry.date}
                        </td>
                        <td className={cn("px-4 py-3", isDark ? "text-gray-300" : "text-slate-700")}>
                          {entry.time}
                        </td>
                        <td className={cn("px-4 py-3 font-medium", isDark ? "text-white" : "text-slate-900")}>
                          {entry.action}
                        </td>
                        <td className={cn("px-4 py-3", isDark ? "text-gray-400" : "text-slate-500")}>
                          {entry.oldRecord}
                        </td>
                        <td className={cn("px-4 py-3", isDark ? "text-gray-200" : "text-slate-800")}>
                          {entry.newRecord}
                        </td>
                        <td className={cn("px-4 py-3", isDark ? "text-gray-400" : "text-slate-500")}>
                          {entry.device}
                        </td>
                        <td className={cn("px-4 py-3 font-mono text-xs", isDark ? "text-cyan-400" : "text-sky-600")}>
                          {entry.ip}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Pass Tab ─────────────────────────────────────── */}
        {activeTab === "pass" && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {
                  label: "Last Pass",
                  value: passData?.personnel?.last_pass_date
                    ? new Date(passData.personnel.last_pass_date).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      )
                    : "—",
                  icon: "mdi:calendar-arrow-left",
                },
                {
                  label: "Next Pass",
                  value: passData?.personnel?.next_pass_date
                    ? new Date(passData.personnel.next_pass_date).toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      )
                    : "—",
                  icon: "mdi:calendar-arrow-right",
                },
                {
                  label: "Pass Due In",
                  value: passData?.personnel?.next_pass_date
                    ? (() => {
                        const diff = Math.ceil(
                          (new Date(passData.personnel.next_pass_date).getTime() -
                            Date.now()) /
                            86400000,
                        );
                        if (diff < 0) return `${Math.abs(diff)}d overdue`;
                        if (diff === 0) return "Today";
                        return `${diff} days`;
                      })()
                    : "—",
                  icon: "mdi:clock-fast",
                },
                {
                  label: "Total Passes",
                  value: passData?.total_passes ?? 0,
                  icon: "mdi:counter",
                },
                {
                  label: "Pass Status",
                  value:
                    ({
                      upcoming: "Upcoming",
                      due_for_pass: "Due for Pass",
                      pending_approval: "Pending Approval",
                      on_pass: "On Pass",
                      overdue: "Overdue",
                    } as Record<string, string>)[
                      passData?.personnel?.pass_status ?? ""
                    ] ??
                    passData?.personnel?.pass_status ??
                    "—",
                  icon: "mdi:information-outline",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "border rounded-xl p-3.5 flex flex-col gap-1 transition-all shadow-sm",
                    isDark ? "bg-[#001825]/80 border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
                  )}
                >
                  <div className={cn("flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                    <Icon icon={card.icon} className="w-3.5 h-3.5" />
                    <span>{card.label}</span>
                  </div>
                  <span className={cn("text-base font-bold truncate", isDark ? "text-white" : "text-slate-900")}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Initiate Pass Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowInitiatePassModal(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors shadow-sm",
                  isDark
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                    : "bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100",
                )}
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                <span>Initiate Pass</span>
              </button>
            </div>

            {/* Pass History Table */}
            {isPassLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                Loading pass history...
              </div>
            ) : (
              <div className={cn("overflow-x-auto rounded-xl border shadow-sm", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                <table className="min-w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className={cn("border-b text-[11px] uppercase tracking-wider font-semibold", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400" : "bg-slate-100 border-slate-200 text-slate-600")}>
                      <th className="px-4 py-3 text-left">Start Date</th>
                      <th className="px-4 py-3 text-left">End Date</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Remarks</th>
                      <th className="px-4 py-3 text-left">Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(passData?.personnel?.passes ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className={cn("px-4 py-6 text-center italic", isDark ? "text-gray-500" : "text-slate-400")}>
                          No pass records yet.
                        </td>
                      </tr>
                    ) : (
                      (passData?.personnel?.passes ?? []).map((pass, i) => (
                        <tr
                          key={pass.id}
                          className={cn(
                            "border-t transition-colors",
                            isDark
                              ? i % 2 === 0
                                ? "bg-[#001219]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                                : "bg-[#001825]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                              : i % 2 === 0
                              ? "bg-white border-slate-100 hover:bg-slate-50"
                              : "bg-slate-50/60 border-slate-100 hover:bg-slate-50",
                          )}
                        >
                          <td className={cn("px-4 py-3 font-medium", isDark ? "text-white" : "text-slate-900")}>
                            {new Date(pass.start_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className={cn("px-4 py-3 font-medium", isDark ? "text-white" : "text-slate-900")}>
                            {new Date(pass.end_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className={cn("px-4 py-3 font-mono", isDark ? "text-cyan-300" : "text-sky-700")}>{pass.duration}d</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-semibold capitalize px-2 py-0.5 rounded-full border",
                                {
                                  pending: "bg-amber-500/10 border-amber-500/30 text-amber-400",
                                  approved: "bg-blue-500/10 border-blue-500/30 text-blue-400",
                                  active: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                                  completed: "bg-slate-500/10 border-slate-500/30 text-slate-400",
                                  rejected: "bg-rose-500/10 border-rose-500/30 text-rose-400",
                                }[pass.status] ?? "bg-slate-500/10 border-slate-500/30 text-slate-400",
                              )}
                            >
                              {pass.status}
                            </span>
                          </td>
                          <td className={cn("px-4 py-3 max-w-xs truncate", isDark ? "text-gray-300" : "text-slate-600")}>
                            {pass.remarks ?? "—"}
                          </td>
                          <td className={cn("px-4 py-3 font-medium", isDark ? "text-white" : "text-slate-900")}>
                            {pass.created_by_user
                              ? `${pass.created_by_user.firstname ?? ""} ${pass.created_by_user.lastname ?? ""}`.trim()
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Course Tab ───────────────────────────────────── */}
        {activeTab === "course" && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Courses", value: courses.length, icon: "mdi:school-outline" },
                {
                  label: "Ongoing",
                  value: courses.filter((c) => c.status === "ongoing").length,
                  icon: "mdi:progress-clock",
                },
                {
                  label: "Completed",
                  value: courses.filter((c) => c.status === "completed").length,
                  icon: "mdi:check-circle-outline",
                },
                {
                  label: "Scheduled",
                  value: courses.filter((c) => c.status === "scheduled").length,
                  icon: "mdi:calendar-clock-outline",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "border rounded-xl p-3.5 flex flex-col gap-1 transition-all shadow-sm",
                    isDark ? "bg-[#001825]/80 border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
                  )}
                >
                  <div className={cn("flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                    <Icon icon={card.icon} className="w-3.5 h-3.5" />
                    <span>{card.label}</span>
                  </div>
                  <span className={cn("text-base font-bold truncate", isDark ? "text-white" : "text-slate-900")}>{card.value}</span>
                </div>
              ))}
            </div>

            {/* Register Course Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowRegisterCourseModal(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors shadow-sm",
                  isDark
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                    : "bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100",
                )}
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                <span>Register Course</span>
              </button>
            </div>

            {/* Course History Table */}
            {isCoursesLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                Loading course history...
              </div>
            ) : (
              <div className={cn("overflow-x-auto rounded-xl border shadow-sm", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                <table className="min-w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className={cn("border-b text-[11px] uppercase tracking-wider font-semibold", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400" : "bg-slate-100 border-slate-200 text-slate-600")}>
                      <th className="px-4 py-3 text-left">Course</th>
                      <th className="px-4 py-3 text-left">Institution</th>
                      <th className="px-4 py-3 text-left">Start Date</th>
                      <th className="px-4 py-3 text-left">End Date</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Remarks</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={cn("px-4 py-6 text-center italic", isDark ? "text-gray-500" : "text-slate-400")}>
                          No course records yet.
                        </td>
                      </tr>
                    ) : (
                      courses.map((course, i) => (
                        <tr
                          key={course.id}
                          className={cn(
                            "border-t transition-colors",
                            isDark
                              ? i % 2 === 0
                                ? "bg-[#001219]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                                : "bg-[#001825]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                              : i % 2 === 0
                              ? "bg-white border-slate-100 hover:bg-slate-50"
                              : "bg-slate-50/60 border-slate-100 hover:bg-slate-50",
                          )}
                        >
                          <td className={cn("px-4 py-3 font-semibold", isDark ? "text-white" : "text-slate-900")}>{course.title}</td>
                          <td className={cn("px-4 py-3", isDark ? "text-gray-300" : "text-slate-700")}>
                            {course.institution ?? "—"}
                          </td>
                          <td className={cn("px-4 py-3 font-medium", isDark ? "text-gray-300" : "text-slate-700")}>
                            {new Date(course.start_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className={cn("px-4 py-3 font-medium", isDark ? "text-gray-300" : "text-slate-700")}>
                            {new Date(course.end_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-semibold capitalize px-2 py-0.5 rounded-full border",
                                COURSE_STATUS_COLORS[course.status],
                              )}
                            >
                              {course.status}
                            </span>
                          </td>
                          <td className={cn("px-4 py-3 max-w-xs truncate", isDark ? "text-gray-400" : "text-slate-500")}>
                            {course.remarks ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setEditingCourse(course)}
                              title="Edit course"
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                                isDark
                                  ? "border-[#0A4D66]/60 text-cyan-300 hover:bg-[#0A4D66]/30"
                                  : "border-slate-200 text-slate-700 hover:bg-slate-100",
                              )}
                            >
                              <Icon icon="mdi:pencil-outline" className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Attendance Tab ───────────────────────────────── */}
        {activeTab === "attendance" && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Days Present", value: attendanceStats.present, icon: "mdi:check-circle-outline", color: "text-emerald-400" },
                { label: "Days Absent", value: attendanceStats.absent, icon: "mdi:close-circle-outline", color: "text-red-400" },
                { label: "Late Arrivals", value: attendanceStats.late, icon: "mdi:clock-alert-outline", color: "text-amber-400" },
                { label: "Attendance Rate", value: `${attendanceStats.rate}%`, icon: "mdi:percent-outline", color: "text-blue-400" },
                {
                  label: "Days Till Next Leave",
                  value: attendanceStats.daysTillNextLeave !== null
                    ? attendanceStats.daysTillNextLeave < 0
                      ? `${Math.abs(attendanceStats.daysTillNextLeave)}d overdue`
                      : `${attendanceStats.daysTillNextLeave}d`
                    : "—",
                  icon: "mdi:calendar-clock",
                  color: attendanceStats.daysTillNextLeave !== null && attendanceStats.daysTillNextLeave < 0 ? "text-red-400" : isDark ? "text-white" : "text-slate-900",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "border rounded-xl p-3.5 flex flex-col gap-1 transition-all shadow-sm",
                    isDark ? "bg-[#001825]/80 border-[#0A4D66]/40" : "bg-slate-50 border-slate-200",
                  )}
                >
                  <div className={cn("flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider", isDark ? "text-gray-400" : "text-slate-500")}>
                    <Icon icon={card.icon} className="w-3.5 h-3.5" />
                    <span>{card.label}</span>
                  </div>
                  <span className={cn("text-base font-bold", card.color)}>
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Attendance records table */}
            {isAttendanceLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                Loading attendance...
              </div>
            ) : (
              <div className={cn("overflow-x-auto rounded-xl border shadow-sm", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
                <table className="min-w-full text-xs whitespace-nowrap">
                  <thead>
                    <tr className={cn("border-b text-[11px] uppercase tracking-wider font-semibold", isDark ? "bg-[#001219] border-[#0A4D66]/40 text-gray-400" : "bg-slate-100 border-slate-200 text-slate-600")}>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Clock In</th>
                      <th className="px-4 py-3 text-left">Clock Out</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">In Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={cn("px-4 py-6 text-center italic", isDark ? "text-gray-500" : "text-slate-400")}>
                          No attendance records yet.
                        </td>
                      </tr>
                    ) : (
                      attendanceLogs.slice(0, 30).map((log, i) => {
                        const formatTime = (t: string | null) => {
                          if (!t) return "—";
                          return new Date(`1970-01-01T${t}`).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                        };
                        const durationLabel = (mins: number | null) => {
                          if (!mins) return "—";
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          return h > 0 ? `${h}h ${m}m` : `${m}m`;
                        };
                        const statusColors: Record<string, string> = {
                          present: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                          late: "bg-amber-500/10 border-amber-500/30 text-amber-400",
                          absent: "bg-rose-500/10 border-rose-500/30 text-rose-400",
                          half_day: "bg-blue-500/10 border-blue-500/30 text-blue-400",
                        };
                        return (
                          <tr
                            key={log.id}
                            className={cn(
                              "border-t transition-colors",
                              isDark
                                ? i % 2 === 0
                                  ? "bg-[#001219]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                                  : "bg-[#001825]/60 border-[#0A4D66]/30 hover:bg-[#0A4D66]/20"
                                : i % 2 === 0
                                ? "bg-white border-slate-100 hover:bg-slate-50"
                                : "bg-slate-50/60 border-slate-100 hover:bg-slate-50",
                            )}
                          >
                            <td className={cn("px-4 py-3 font-medium", isDark ? "text-white" : "text-slate-900")}>
                              {new Date(log.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 font-mono font-medium text-emerald-400">{formatTime(log.clock_in)}</td>
                            <td className="px-4 py-3 font-mono font-medium text-rose-400">{formatTime(log.clock_out)}</td>
                            <td className={cn("px-4 py-3 font-mono", isDark ? "text-gray-300" : "text-slate-700")}>{durationLabel(log.duration_minutes)}</td>
                            <td className="px-4 py-3">
                              <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold border capitalize", statusColors[log.status] ?? "text-gray-400")}>
                                {log.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {log.is_within_range ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                                  <Icon icon="mdi:check-circle-outline" className="w-4 h-4" />
                                  <span>Base Geofence</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-medium">
                                  <Icon icon="mdi:map-marker-off-outline" className="w-4 h-4" />
                                  <span>Out of Range</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <InitiatePassModal
        open={showInitiatePassModal}
        onClose={() => setShowInitiatePassModal(false)}
        personnelId={id ? Number(id) : undefined}
        personnelName={
          apiPerson ? `${apiPerson.firstname} ${apiPerson.lastname}` : undefined
        }
      />

      <RegisterCourseModal
        open={showRegisterCourseModal}
        onClose={() => setShowRegisterCourseModal(false)}
        personnelId={id ? Number(id) : undefined}
        personnelName={
          apiPerson ? `${apiPerson.firstname} ${apiPerson.lastname}` : undefined
        }
      />

      <EditCourseModal course={editingCourse} onClose={() => setEditingCourse(null)} />
    </div>
  );
};
