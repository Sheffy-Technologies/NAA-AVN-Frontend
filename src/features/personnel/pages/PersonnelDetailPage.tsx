import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetPersonnelByIdQuery } from "@/features/personnel/api";

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
  rating: string;
  image: string | null;
  currentDeploymentDate: string;
  currentDeploymentUnit: string;
  lastDeploymentDate: string;
  lastDeploymentUnit: string;
  branch: string;
  corps: string;
  specialty: string;
  status: PersonnelStatus;
  email: string;
  phone: string;
  address: string;
  dialogue: string;
  aircraftRatedOn: string;
  totalFlightTimeHours: number;
  aircraftHours: {
    name: string;
    hours: number;
  }[];
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

export const PersonnelDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: apiPerson, isLoading: isPersonLoading } =
    useGetPersonnelByIdQuery(id ?? "", {
      skip: !id,
    });
  const [activeTab, setActiveTab] = useState<"bio" | "activity">("bio");
  const [activityView, setActivityView] = useState<"grid" | "table">("grid");

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

    const sortedDeployments = [...apiPerson.deployments].sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime(),
    );
    const lastDeployment =
      sortedDeployments.length > 0 ? sortedDeployments[0] : null;

    return {
      id: String(apiPerson.id),
      serviceNo: apiPerson.service_number,
      firstName: apiPerson.firstname,
      lastName: apiPerson.lastname,
      middleName: apiPerson.othernames || undefined,
      rank: apiPerson.rank.name,
      bloodGroup: apiPerson.blood_group,
      callSign: apiPerson.call_sign,
      rating: apiPerson.rating_type,
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
      corps: apiPerson.corp.name,
      specialty: apiPerson.specialty.name,
      status: mapStatus(apiPerson.status),
      email: apiPerson.email,
      phone: apiPerson.phone_number,
      address: apiPerson.address,
      dialogue: "",
      aircraftRatedOn: "",
      totalFlightTimeHours: 0,
      aircraftHours: [],
    };
  }, [apiPerson]);

  const handleBack = () => {
    navigate("/dashboard/personnel");
  };

  return (
    <div className="px-2 sm:px-0">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-3 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-red-700/60 text-xs text-red-300 hover:bg-red-900/30"
              >
                Delete
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

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setActiveTab("bio")}
                className={cn(
                  "inline-flex items-center gap-2 pb-1 border-b-2",
                  activeTab === "bio"
                    ? "border-[#7FD5FF] text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200",
                )}
              >
                <Icon
                  icon="mdi:shield-account-outline"
                  className="w-4 h-4 text-gray-400"
                />
                <span>Personnel bio data</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "inline-flex items-center gap-2 pb-1 border-b-2",
                  activeTab === "activity"
                    ? "border-[#7FD5FF] text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200",
                )}
              >
                <Icon
                  icon="mdi:clock-outline"
                  className="w-4 h-4 text-gray-400"
                />
                <span>Activity Log</span>
              </button>
            </div>

            {activeTab === "activity" && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 rounded-md border border-[#0A4D66]/40 bg-[#021a27] p-1">
                  <button
                    type="button"
                    onClick={() => setActivityView("table")}
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
                  className="px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200"
                >
                  {mockActivityLog.length}
                </button>
                <button
                  type="button"
                  className="hidden md:inline-flex px-3 py-1.5 rounded border border-[#0A4D66]/40 bg-[#021a27] text-xs text-gray-200 whitespace-nowrap"
                >
                  Period
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-8 h-8 rounded border border-[#0A4D66]/40 bg-[#021a27] text-gray-300"
                >
                  <Icon icon="mdi:download-outline" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {activeTab === "bio" && (
          <div className="p-4 sm:p-6">
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

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 space-y-2 text-xs sm:text-sm text-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rank:</span>
                      <span>{person.rank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Blood Group:</span>
                      <span>{person.bloodGroup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Call Sign:</span>
                      <span>{person.callSign}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type of Rating:</span>
                      <span className="text-right">{person.rating}</span>
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
                      <span>{person.lastDeploymentUnit}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-3">
                      Personnel Identification
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Service No.:</span>
                        <span className="font-semibold">
                          {person.serviceNo}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">First Name:</span>
                        <span className="font-semibold">
                          {person.firstName}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Last Name:</span>
                        <span className="font-semibold">{person.lastName}</span>
                      </div>
                      <div className="flex justify-between gap-2">
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
                    <p className="text-gray-100">{person.dialogue}</p>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-2">
                      Unit
                    </div>
                    <p className="text-gray-100">
                      {person.currentDeploymentUnit}
                    </p>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-2">
                      Aircraft Rated On
                    </div>
                    <p className="text-gray-100">{person.aircraftRatedOn}</p>
                  </div>

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
                      <span>{person.currentDeploymentUnit}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="text-[11px] uppercase text-gray-400 mb-3">
                      Service Details
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Branch:</span>
                        <span>{person.branch}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Corps:</span>
                        <span>{person.corps}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Specialty:</span>
                        <span>{person.specialty}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-400">Status:</span>
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
                    <div className="space-y-2">
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Email:</span>
                        <span className="truncate">{person.email}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Phone No.:</span>
                        <span>{person.phone}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-400">Address:</span>
                        <span className="text-right">{person.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#001825] border border-[#0A4D66]/40 rounded-lg p-4 text-xs sm:text-sm text-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] uppercase text-gray-400">
                        Total Flight Time
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {person.totalFlightTimeHours} HRS
                      </div>
                    </div>
                    <div className="space-y-1">
                      {person.aircraftHours.map((aircraft) => (
                        <div
                          key={aircraft.name}
                          className="flex items-center justify-between"
                        >
                          <button
                            type="button"
                            className="text-xs text-[#7FD5FF] hover:text-[#b3e6ff]"
                          >
                            {aircraft.name}
                          </button>
                          <span>{aircraft.hours} HRS</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="p-4 sm:p-6">
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
                    <tr className="bg-[#000f18] border-b border-[#0A4D66]/40 text-[11px] sm:text-xs text-gray-400 uppercase tracking-wide">
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
                        <td className="px-4 sm:px-6 py-3 text-gray-100">
                          {entry.date}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {entry.time}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {entry.action}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {entry.oldRecord}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {entry.newRecord}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {entry.device}
                        </td>
                        <td className="px-4 py-3 text-gray-100">{entry.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
