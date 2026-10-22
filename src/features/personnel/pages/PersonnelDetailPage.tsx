import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetPersonnelByIdQuery, useDeletePersonnelMutation } from "@/features/personnel/api";
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
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const { data: apiPerson, isLoading: isPersonLoading } =
    useGetPersonnelByIdQuery(id ?? "", {
      skip: !id,
    });
  const [deletePersonnel, { isLoading: isDeleting }] = useDeletePersonnelMutation();
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
        backgroundColor: "#001219",
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
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#001219]">
          <div className="flex items-center justify-between gap-3">
            <BackButton fallbackUrl="/dashboard/personnel" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf || !person}
                className="px-3 py-1.5 rounded border border-[#0A4D66]/60 text-xs text-white hover:bg-red-900/30 disabled:opacity-50"
              >
                {isDownloadingPdf ? "Downloading..." : "Download"}
              </button>
              <button
                type="button"
                onClick={handleDeletePersonnel}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded border border-red-700/60 text-xs text-red-300 hover:bg-red-900/30 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-[#0A4D66]/60 text-xs text-gray-200 hover:bg-[#0A4D66]/30"
              >
                Update status
              </button>
              <button
                type="button"
                onClick={() => navigate(`/dashboard/personnel/${id}/edit`)}
                className="px-3 py-1.5 rounded border border-[#0A4D66]/60 text-xs text-gray-200 hover:bg-[#0A4D66]/30"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#0A4D66]/40 dark:border-[#0A4D66]/40 border-slate-300">
            <AppTabs
              tabs={[
                { id: "bio", label: "Personnel bio data", icon: "mdi:shield-account-outline" },
                { id: "activity", label: "Activity Log", icon: "mdi:clock-outline" },
                { id: "pass", label: "Pass", icon: "mdi:calendar-check-outline" },
                { id: "course", label: "Course", icon: "mdi:school-outline" },
                { id: "attendance", label: "Attendance", icon: "mdi:clipboard-check-outline" },
              ]}
              activeTab={activeTab}
              onChange={(tab) => setActiveTab(tab as typeof activeTab)}
              size="sm"
              containerClassName="border-b-0"
            />

            {activeTab === "activity" && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#001219] p-1">
                  <button
                    type="button"
                    onClick={() => setActivityView("table")}
                    aria-label="Switch to table view"
                    title="Table view"
                    className={cn(
                      "px-2 py-1 rounded-sm flex items-center justify-center",
                      activityView === "table"
                        ? "bg-[#0A4D66] text-white"
                        : "text-gray-400",
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
                      "px-2 py-1 rounded-sm flex items-center justify-center",
                      activityView === "grid"
                        ? "bg-[#0A4D66] text-white"
                        : "text-gray-400",
                    )}
                  >
                    <Icon icon="mdi:view-grid-outline" className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200"
                >
                  {mockActivityLog.length}
                </button>
                <button
                  type="button"
                  className="hidden md:inline-flex px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#001219] text-xs text-gray-200 whitespace-nowrap"
                >
                  Period
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf || !person}
                  aria-label="Download personnel details"
                  title="Download personnel details"
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[#0A4D66]/40 bg-[#001219] text-gray-300"
                >
                  <Icon
                    icon={isDownloadingPdf ? "mdi:loading" : "mdi:download-outline"}
                    className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

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
              <div className="grid gap-4 lg:grid-cols-[260px,1.5fr,1.2fr]">
                <div className="space-y-4">
                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 flex flex-col items-center gap-3">
                    {person.image ? (
                      <img
                        src={person.image}
                        alt={`${person.firstName} ${person.lastName}`}
                        className="w-28 h-28 rounded-lg object-cover bg-[#0A4D66]"
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-lg bg-[#0A4D66] flex items-center justify-center text-2xl font-semibold text-white">
                        {person.firstName[0]}
                        {person.lastName[0]}
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-sm font-semibold text-white">
                        {person.firstName} {person.lastName}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Service No. {person.serviceNo}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 grid gap-2 text-xs sm:text-sm text-gray-200 lg:grid-cols-2">
                    <div className="grid grid-cols-[110px,1fr] items-start gap-2">
                      <span className="text-gray-400 whitespace-nowrap">
                        Rank:
                      </span>
                      <span>{person.rank}</span>
                    </div>
                    <div className="grid grid-cols-[110px,1fr] items-start gap-2">
                      <span className="text-gray-400 whitespace-nowrap">
                        Blood Group:
                      </span>
                      <span>{person.bloodGroup}</span>
                    </div>
                    <div className="grid grid-cols-[110px,1fr] items-start gap-2">
                      <span className="text-gray-400 whitespace-nowrap">
                        Call Sign:
                      </span>
                      <span>{person.callSign}</span>
                    </div>
                    <div className="grid grid-cols-[110px,1fr] items-start gap-2">
                      <span className="text-gray-400 whitespace-nowrap">
                        Rating:
                      </span>
                      {person.ratings.length > 0 ? (
                        <span className="flex flex-wrap gap-2">
                          {person.ratings.map((rating) => (
                            <span
                              key={`${rating.name}-${rating.expiryDate ?? "none"}`}
                              className="inline-flex items-center rounded-full border border-[#7FD5FF]/30 bg-[#0A4D66]/20 px-2 py-0.5 text-[11px] text-[#B7E6FF]"
                            >
                              {rating.name}
                              {rating.isLifetime
                                ? " (Lifetime)"
                                : rating.expiryDate
                                ? ` (${rating.expiryDate})`
                                : ""}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 space-y-3 text-xs sm:text-sm text-gray-200">
                    <div className="text-gray-400 text-[11px] uppercase">
                      Last Deployment
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Icon
                        icon="mdi:calendar-blank-outline"
                        className="w-4 h-4 text-gray-400"
                      />
                      <span>{person.lastDeploymentDate}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Icon
                        icon="mdi:office-building"
                        className="w-4 h-4 text-gray-400"
                      />
                      {(() => {
                        const sortedDeps = [...(apiPerson?.deployments ?? [])].sort(
                          (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
                        );
                        const lastUnitId = sortedDeps[0]?.to_unit_id;
                        return lastUnitId ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/units/${lastUnitId}`)}
                            className="text-left text-[#7FD5FF] hover:underline"
                          >
                            {person.lastDeploymentUnit}
                          </button>
                        ) : (
                          <span>{person.lastDeploymentUnit}</span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-3">
                      Personnel Identification
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400">Service No.:</span>
                        <span className="font-semibold">
                          {person.serviceNo}
                        </span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400">First Name:</span>
                        <span className="font-semibold">
                          {person.firstName}
                        </span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400">Last Name:</span>
                        <span className="font-semibold">{person.lastName}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400">Middle Name:</span>
                        <span className="font-semibold">
                          {person.middleName || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-2">
                      Dialogue Box
                    </div>
                    <p className="text-white">{person.dialogue}</p>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-2">
                      Unit
                    </div>
                    {apiPerson?.unit?.id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/units/${apiPerson.unit.id}`)}
                        className="text-left text-[#7FD5FF] hover:underline font-medium"
                      >
                        {person.currentDeploymentUnit}
                      </button>
                    ) : (
                      <p className="text-white">
                        {person.currentDeploymentUnit}
                      </p>
                    )}
                  </div>

                  {person.isPilot && (
                    <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                      <div className="text-[11px] uppercase text-gray-400 mb-2">
                        Type Rating (Platform)
                      </div>
                      <p className="text-white font-medium">{person.aircraftRatedOn}</p>
                    </div>
                  )}

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-2">
                      Current Deployment
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Icon
                        icon="mdi:calendar-blank-outline"
                        className="w-4 h-4 text-gray-400"
                      />
                      <span>{person.currentDeploymentDate}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Icon
                        icon="mdi:office-building"
                        className="w-4 h-4 text-gray-400"
                      />
                      {apiPerson?.latest_deployment?.to_unit_id ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/units/${apiPerson.latest_deployment!.to_unit_id}`)}
                          className="text-left text-[#7FD5FF] hover:underline"
                        >
                          {person.currentDeploymentUnit}
                        </button>
                      ) : (
                        <span>{person.currentDeploymentUnit}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-3">
                      Service Details
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400 whitespace-nowrap">
                          Branch:
                        </span>
                        <span>{person.branch}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400 whitespace-nowrap">
                          Corps:
                        </span>
                        <span>{person.corpsName}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0 lg:col-span-2">
                        <span className="text-gray-400 whitespace-nowrap">
                          Corps Details:
                        </span>
                        <span>{person.corpsDescription}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400 whitespace-nowrap">
                          Specialty:
                        </span>
                        <span>{person.specialty}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400 whitespace-nowrap">
                          Status:
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-emerald-400">
                            {person.status}
                          </span>
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              statusDotColor[person.status],
                            )}
                          />
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-3">
                      Contact Information
                    </div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400 whitespace-nowrap">
                          Email:
                        </span>
                        <span className="truncate">{person.email}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0">
                        <span className="text-gray-400 whitespace-nowrap">
                          Phone No.:
                        </span>
                        <span>{person.phone}</span>
                      </div>
                      <div className="grid grid-cols-[110px,1fr] gap-2 min-w-0 lg:col-span-2">
                        <span className="text-gray-400 whitespace-nowrap">
                          Address:
                        </span>
                        <span>{person.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pilot Flight Hours Breakdown Card - Rendered ONLY if personnel is a Pilot */}
                  {person.isPilot && (
                    <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div className="text-[11px] uppercase text-gray-400 font-semibold">
                          Total Flight Hours
                        </div>
                        <div className="text-base font-bold text-white tracking-wide">
                          {person.totalFlightTimeHours} <span className="text-xs text-cyan-400 font-normal">HRS</span>
                        </div>
                      </div>

                      {/* Operational vs Training Dual Breakdown */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded bg-[#001219]/70 border border-cyan-500/20 p-2.5">
                          <span className="text-gray-400 text-[10px] uppercase block tracking-wider">
                            Operational Hours
                          </span>
                          <span className="text-sm font-semibold text-cyan-300 mt-0.5 block">
                            {person.totalOperationalHours} <span className="text-[10px] text-gray-400">HRS</span>
                          </span>
                        </div>
                        <div className="rounded bg-[#001219]/70 border border-cyan-500/20 p-2.5">
                          <span className="text-gray-400 text-[10px] uppercase block tracking-wider">
                            Training Hours
                          </span>
                          <span className="text-sm font-semibold text-cyan-300 mt-0.5 block">
                            {person.totalTrainingHours} <span className="text-[10px] text-gray-400">HRS</span>
                          </span>
                        </div>
                      </div>

                      {/* Platform Flight Experience List */}
                      {person.aircraftHours.length > 0 && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <div className="text-[10px] uppercase text-gray-400 font-semibold mb-1">
                            Platform Hours Breakdown
                          </div>
                          {person.aircraftHours.map((aircraft) => (
                            <div
                              key={aircraft.name}
                              className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 text-xs"
                            >
                              <span className="text-[#7FD5FF] font-medium truncate max-w-[140px]">
                                {aircraft.name}
                              </span>
                              <div className="flex items-center gap-2.5 text-[11px]">
                                <span className="text-gray-400">
                                  Op: <span className="text-gray-200 font-medium">{aircraft.operationalHours ?? aircraft.hours}h</span>
                                </span>
                                <span className="text-gray-400">
                                  Tr: <span className="text-gray-200 font-medium">{aircraft.trainingHours ?? 0}h</span>
                                </span>
                                <span className="font-semibold text-white pl-1">
                                  {aircraft.hours}h
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Career Experience & Credentials Card (Non-Pilot Personnel: Engineers, Technicians, Logistics, Admin) */}
                  {!person.isPilot && (
                    <div className="bg-[#001825] border border-emerald-500/30 rounded-lg p-4 text-xs sm:text-sm text-gray-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                        <div className="text-[11px] uppercase text-emerald-400 font-semibold flex items-center gap-1.5">
                          <Icon
                            icon={person.isEngineer ? "mdi:wrench-clock" : "mdi:briefcase-clock-outline"}
                            className="w-4 h-4 text-emerald-400"
                          />
                          <span>
                            {person.isEngineer
                              ? "Years of Engineering Experience"
                              : "Years of Professional Experience"}
                          </span>
                        </div>
                        <div className="text-base font-bold text-white tracking-wide">
                          {person.yearsOfExperience || "Active Duty"}
                        </div>
                      </div>

                      {/* Discipline & Verified Credentials Dual Summary */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded bg-[#001219]/70 border border-emerald-500/20 p-2.5">
                          <span className="text-gray-400 text-[10px] uppercase block tracking-wider">
                            Specialty Track
                          </span>
                          <span className="text-xs font-semibold text-emerald-300 mt-0.5 block truncate" title={person.specialty}>
                            {person.specialty || person.branch || "General Service"}
                          </span>
                        </div>
                        <div className="rounded bg-[#001219]/70 border border-emerald-500/20 p-2.5">
                          <span className="text-gray-400 text-[10px] uppercase block tracking-wider">
                            Active Credentials
                          </span>
                          <span className="text-xs font-semibold text-emerald-300 mt-0.5 block">
                            {person.ratings.length} {person.ratings.length === 1 ? "Certification" : "Certifications"}
                          </span>
                        </div>
                      </div>

                      {/* Credentials & Licensure Breakdown */}
                      <div className="pt-2 border-t border-white/5 space-y-2">
                        <div className="text-[10px] uppercase text-gray-400 font-semibold flex items-center justify-between">
                          <span>Certifications &amp; Licenses</span>
                          {person.ratings.length > 0 && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              {person.ratings.length} on file
                            </span>
                          )}
                        </div>

                        {person.ratings.length > 0 ? (
                          <div className="space-y-1.5">
                            {person.ratings.map((rating) => (
                              <div
                                key={rating.name}
                                className="rounded bg-[#001219]/70 border border-emerald-500/20 p-2 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-white text-xs truncate max-w-[180px]" title={rating.name}>
                                    {rating.name}
                                  </span>
                                  {rating.isLifetime ? (
                                    <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                      Lifetime
                                    </span>
                                  ) : rating.expiryDate ? (
                                    <span className="text-[10px] text-gray-400">
                                      Exp: {rating.expiryDate}
                                    </span>
                                  ) : null}
                                </div>

                                {rating.issueDate && (
                                  <div className="text-[10px] text-gray-400 flex items-center justify-between pt-0.5">
                                    <span>Issued: {rating.issueDate}</span>
                                    {rating.derivedExperience && (
                                      <span className="text-emerald-300 font-medium">
                                        {rating.derivedExperience} Exp
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-400 text-xs italic">
                            No specialized licenses logged. Service duration recorded from enlistment.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {person.isPilot && (
                    <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[11px] uppercase text-gray-400">
                          Flight Currency
                        </div>
                        {person.flightStatus && (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              FLIGHT_STATUS_COLORS[person.flightStatus],
                            )}
                          >
                            {FLIGHT_STATUS_LABELS[person.flightStatus]}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-gray-500 mb-0.5">Last Flight</span>
                          <span className="text-white">
                            {person.lastFlightDate
                              ? new Date(person.lastFlightDate).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 mb-0.5">Due By</span>
                          <span className="text-white">
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {mockActivityLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg px-4 py-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">
                        {entry.action}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-primary-med hover:text-primary-med/80"
                      >
                        {entry.ip}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-300">
                      <div className="flex items-center gap-1">
                        <Icon
                          icon="mdi:calendar-blank-outline"
                          className="w-4 h-4 text-gray-400"
                        />
                        <span>{entry.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon
                          icon="mdi:clock-outline"
                          className="w-4 h-4 text-gray-400"
                        />
                        <span>{entry.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Icon
                          icon="mdi:monitor"
                          className="w-4 h-4 text-gray-400"
                        />
                        <span>{entry.device}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activityView === "table" && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm text-gray-200">
                  <thead>
                    <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
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
                          "border-t border-[#0A4D66]/40",
                          index % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                        )}
                      >
                        <td className="px-4 sm:px-6 py-3 text-white">
                          {entry.date}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {entry.time}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {entry.action}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {entry.oldRecord}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {entry.newRecord}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {entry.device}
                        </td>
                        <td className="px-4 py-3 text-white">{entry.ip}</td>
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
          <div className="p-4 sm:p-6">
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
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
                  className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-wide">
                    <Icon icon={card.icon} className="w-3.5 h-3.5" />
                    {card.label}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {card.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Initiate Pass */}
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowInitiatePassModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                Initiate Pass
              </button>
            </div>

            {/* Pass History Table */}
            {isPassLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                Loading pass history...
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-[#0A4D66]/40">
                <table className="min-w-full text-xs text-gray-200 whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
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
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                          No pass records yet.
                        </td>
                      </tr>
                    ) : (
                      (passData?.personnel?.passes ?? []).map((pass, i) => (
                        <tr
                          key={pass.id}
                          className={cn(
                            "border-t border-[#0A4D66]/40",
                            i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 py-3 text-white">
                            {new Date(pass.start_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-white">
                            {new Date(pass.end_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-white">{pass.duration}d</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-medium capitalize",
                                {
                                  pending: "text-amber-400",
                                  approved: "text-blue-400",
                                  active: "text-emerald-400",
                                  completed: "text-gray-400",
                                  rejected: "text-red-400",
                                }[pass.status] ?? "text-gray-400",
                              )}
                            >
                              {pass.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                            {pass.remarks ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-white">
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
          <div className="p-4 sm:p-6">
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
                  className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-wide">
                    <Icon icon={card.icon} className="w-3.5 h-3.5" />
                    {card.label}
                  </div>
                  <span className="text-sm font-semibold text-white">{card.value}</span>
                </div>
              ))}
            </div>

            {/* Register Course */}
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowRegisterCourseModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0369A1] text-xs text-white font-medium hover:bg-[#0369A1]/90"
              >
                <Icon icon="mdi:plus" className="w-4 h-4" />
                Register Course
              </button>
            </div>

            {/* Course History Table */}
            {isCoursesLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-400 text-sm gap-2">
                <span className="h-4 w-4 border-2 border-[#0A4D66]/60 border-t-transparent rounded-full animate-spin" />
                Loading course history...
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-[#0A4D66]/40">
                <table className="min-w-full text-xs text-gray-200 whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
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
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                          No course records yet.
                        </td>
                      </tr>
                    ) : (
                      courses.map((course, i) => (
                        <tr
                          key={course.id}
                          className={cn(
                            "border-t border-[#0A4D66]/40",
                            i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]",
                          )}
                        >
                          <td className="px-4 py-3 text-white">{course.title}</td>
                          <td className="px-4 py-3 text-white">
                            {course.institution ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-white">
                            {new Date(course.start_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-white">
                            {new Date(course.end_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "text-xs font-medium capitalize",
                                COURSE_STATUS_COLORS[course.status],
                              )}
                            >
                              {course.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                            {course.remarks ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setEditingCourse(course)}
                              title="Edit course"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#0A4D66]/40 text-[10px] text-gray-300 hover:bg-[#0A4D66]/30"
                            >
                              <Icon icon="mdi:pencil-outline" className="w-3 h-3" />
                              Edit
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
          <div className="p-4 sm:p-6">
            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
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
                  color: attendanceStats.daysTillNextLeave !== null && attendanceStats.daysTillNextLeave < 0 ? "text-red-400" : "text-white",
                },
              ].map((card) => (
                <div key={card.label} className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-wide">
                    <Icon icon={card.icon} className="w-3.5 h-3.5" />
                    {card.label}
                  </div>
                  <span className={cn("text-sm font-semibold", card.color)}>
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
              <div className="overflow-x-auto rounded border border-[#0A4D66]/40">
                <table className="min-w-full text-xs text-gray-200 whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#001219] border-b border-[#0A4D66]/40 text-[11px] text-gray-400 uppercase tracking-wide">
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
                        <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
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
                          present: "text-emerald-400",
                          late: "text-amber-400",
                          absent: "text-red-400",
                          half_day: "text-blue-400",
                        };
                        return (
                          <tr
                            key={log.id}
                            className={cn("border-t border-[#0A4D66]/40", i % 2 === 0 ? "bg-[#001219]" : "bg-[#001825]")}
                          >
                            <td className="px-4 py-3 text-white">
                              {new Date(log.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 text-emerald-400">{formatTime(log.clock_in)}</td>
                            <td className="px-4 py-3 text-red-400">{formatTime(log.clock_out)}</td>
                            <td className="px-4 py-3">{durationLabel(log.duration_minutes)}</td>
                            <td className="px-4 py-3">
                              <span className={cn("font-medium capitalize", statusColors[log.status] ?? "text-gray-400")}>
                                {log.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {log.is_within_range ? (
                                <Icon icon="mdi:check-circle-outline" className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Icon icon="mdi:map-marker-off-outline" className="w-4 h-4 text-amber-400" />
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
