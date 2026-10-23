import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { downloadCsvFile } from "@/shared/utils/csv";
import { PrimaryButton, SecondaryButton, SqPanel, SqStatus, SqTable, StatTile } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import {
  useGetAccommodationBlocksQuery,
  useGetOccupanciesQuery,
  useGetResidencesQuery,
  type AccommodationCategory,
  type Occupancy,
  type Residence,
} from "../api";
import { OCCUPANCY_STATUS, STAY_STATUS, fmtDate, personName } from "../accommodationHelpers";
import { ResidenceDetailModal, ResidentDetailModal } from "./DetailModals";
import { StayModals, type StayModal } from "./StayModals";

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Residents (and residences) of one accommodation category. */
export const CategoryResidents = ({ category }: { category: AccommodationCategory }) => {
  const { isDark } = useTheme();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const [view, setView] = useState<"residents" | "residences">("residents");
  const [q, setQ] = useState("");
  const [blockId, setBlockId] = useState("");
  const [stayStatus, setStayStatus] = useState("active");
  const [occupancy, setOccupancy] = useState("");
  const [openStay, setOpenStay] = useState<Occupancy | null>(null);
  const [openResidence, setOpenResidence] = useState<number | null>(null);
  const [stayModal, setStayModal] = useState<StayModal>(null);

  const { data: blocks = [] } = useGetAccommodationBlocksQuery({ accommodation_category_id: category.id });
  const { data: stays = [], isLoading: loadingStays } = useGetOccupanciesQuery(
    {
      accommodation_category_id: category.id,
      accommodation_block_id: blockId || undefined,
      status: stayStatus || undefined,
      q: q || undefined,
    },
    { skip: view !== "residents" },
  );
  const { data: residences = [], isLoading: loadingResidences } = useGetResidencesQuery(
    {
      accommodation_category_id: category.id,
      accommodation_block_id: blockId || undefined,
      occupancy_status: occupancy || undefined,
      q: q || undefined,
    },
    { skip: view !== "residences" },
  );

  const action = (m: StayModal) => {
    setOpenStay(null);
    setOpenResidence(null);
    setStayModal(m);
  };

  const exportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    if (view === "residents") {
      downloadCsvFile(`residents-${slug(category.name)}-${date}.csv`, [
        ["Rank", "Name", "Service number", "Unit", "Phone", "Block", "Residence", "Type", "Moved in", "Expected move-out", "Moved out", "Dependants", "Allocation ref.", "Status"],
        ...stays.map((s) => [
          s.personnel?.rank?.name ?? "",
          s.personnel ? `${s.personnel.firstname} ${s.personnel.lastname}` : "",
          s.personnel?.service_number ?? "",
          s.personnel?.unit?.name ?? "",
          s.personnel?.phone_number ?? "",
          s.residence?.block?.name ?? "",
          s.residence?.name ?? "",
          s.residence?.apartment_type ?? "",
          s.move_in_date.slice(0, 10),
          s.expected_move_out_date?.slice(0, 10) ?? "",
          s.move_out_date?.slice(0, 10) ?? "",
          s.dependants != null ? String(s.dependants) : "",
          s.allocation_reference ?? "",
          STAY_STATUS[s.status].label,
        ]),
      ]);
    } else {
      downloadCsvFile(`residences-${slug(category.name)}-${date}.csv`, [
        ["Block", "Residence", "Type", "Rooms", "Bathrooms", "Floor", "Capacity", "Occupants", "Current residents", "Furnished", "Boys' quarters", "Status"],
        ...residences.map((r) => [
          r.block?.name ?? "",
          r.name,
          r.apartment_type_label,
          r.rooms != null ? String(r.rooms) : "",
          r.bathrooms != null ? String(r.bathrooms) : "",
          r.floor ?? "",
          String(r.capacity),
          String(r.active_occupancies_count),
          (r.active_occupancies ?? []).map((s) => personName(s.personnel)).join("; "),
          r.is_furnished ? "Yes" : "No",
          r.has_boys_quarters ? "Yes" : "No",
          OCCUPANCY_STATUS[r.occupancy_status].label,
        ]),
      ]);
    }
  };

  const rows = view === "residents" ? stays.length : residences.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Residences" value={category.residences_count} sub={`In ${category.blocks_count} block${category.blocks_count === 1 ? "" : "s"}`} icon="mdi:home-city-outline" />
        <StatTile label="Residents" value={category.occupants_count} sub="Living here now" icon="mdi:account-group-outline" />
        <StatTile label="Vacant" value={category.vacant_count} sub="Ready to allocate" icon="mdi:home-outline" tone="emerald" />
        <StatTile label="Out of use" value={category.out_of_use_count} sub="Maintenance or condemned" icon="mdi:home-alert-outline" tone="amber" />
      </div>

      <SqPanel
        title={category.name}
        subtitle={category.description ?? "Click a resident or residence for details, to vacate, or to allocate."}
        action={
          <div className="flex flex-wrap gap-2">
            <SecondaryButton icon="mdi:file-delimited-outline" onClick={exportCsv} disabled={!rows}>
              Export CSV
            </SecondaryButton>
            {has("residence-occupancies.create") && (
              <PrimaryButton icon="mdi:key-plus" onClick={() => action({ kind: "allocate", categoryId: category.id })}>
                Allocate residence
              </PrimaryButton>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <div className={cn("flex items-center p-1 rounded-lg border", isDark ? "border-[#0A4D66]/40" : "border-slate-200")}>
            {(["residents", "residences"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold capitalize",
                  view === v ? "bg-[#0A4D66] text-white" : "text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white",
                )}
              >
                <Icon icon={v === "residents" ? "mdi:account-group-outline" : "mdi:home-city-outline"} className="w-4 h-4" />
                {v}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={view === "residents" ? "Search name, service number, residence or ref…" : "Search residence…"}
            className={cn(fieldClass, "flex-1 min-w-[200px]")}
          />
          <select value={blockId} onChange={(e) => setBlockId(e.target.value)} className={cn(fieldClass, "w-auto")}>
            <option value="">All blocks</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {view === "residents" ? (
            <select value={stayStatus} onChange={(e) => setStayStatus(e.target.value)} className={cn(fieldClass, "w-auto")}>
              <option value="active">Current residents</option>
              <option value="vacated">Past residents</option>
              <option value="">All residents</option>
            </select>
          ) : (
            <select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className={cn(fieldClass, "w-auto")}>
              <option value="">All occupancy</option>
              {Object.entries(OCCUPANCY_STATUS).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {view === "residents" ? (
          <SqTable<Occupancy>
            rows={stays}
            loading={loadingStays}
            rowKey={(s) => s.id}
            onRowClick={setOpenStay}
            empty={blocks.length ? "No residents match these filters." : "No blocks in this category yet. Add them under Manage."}
            columns={[
              {
                key: "who",
                label: "Resident",
                render: (s) => (
                  <div>
                    <div className="font-semibold">{personName(s.personnel)}</div>
                    <div className="text-[11px] opacity-70">{[s.personnel?.service_number, s.personnel?.unit?.name].filter(Boolean).join(" · ")}</div>
                  </div>
                ),
              },
              { key: "block", label: "Block", render: (s) => s.residence?.block?.name ?? "–" },
              { key: "res", label: "Residence", render: (s) => s.residence?.name ?? "–" },
              { key: "in", label: "Moved in", render: (s) => fmtDate(s.move_in_date) },
              {
                key: "out",
                label: stayStatus === "active" ? "Expected out" : "Moved out",
                render: (s) => fmtDate(s.status === "vacated" ? s.move_out_date : s.expected_move_out_date),
              },
              { key: "dep", label: "Dependants", render: (s) => s.dependants ?? "–" },
              { key: "phone", label: "Phone", render: (s) => s.personnel?.phone_number ?? "–" },
              { key: "status", label: "Status", align: "right", render: (s) => <SqStatus value={STAY_STATUS[s.status].tone} label={STAY_STATUS[s.status].label} /> },
            ]}
          />
        ) : (
          <SqTable<Residence>
            rows={residences}
            loading={loadingResidences}
            rowKey={(r) => r.id}
            onRowClick={(r) => setOpenResidence(r.id)}
            empty={blocks.length ? "No residences match these filters." : "No blocks in this category yet. Add them under Manage."}
            columns={[
              {
                key: "name",
                label: "Residence",
                render: (r) => (
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[11px] opacity-70">{r.block?.name}</div>
                  </div>
                ),
              },
              { key: "type", label: "Type", render: (r) => r.apartment_type_label },
              { key: "rooms", label: "Rooms", render: (r) => r.rooms ?? "–" },
              {
                key: "who",
                label: "Current residents",
                render: (r) => (r.active_occupancies?.length ? r.active_occupancies.map((s) => personName(s.personnel)).join(", ") : "–"),
              },
              { key: "cap", label: "Occupancy", render: (r) => `${r.active_occupancies_count} / ${r.capacity}` },
              {
                key: "status",
                label: "Status",
                align: "right",
                render: (r) => <SqStatus value={OCCUPANCY_STATUS[r.occupancy_status].tone} label={OCCUPANCY_STATUS[r.occupancy_status].label} />,
              },
            ]}
          />
        )}
      </SqPanel>

      {openStay && <ResidentDetailModal stay={openStay} onClose={() => setOpenStay(null)} onAction={action} />}
      {openResidence !== null && (
        <ResidenceDetailModal
          residenceId={openResidence}
          onClose={() => setOpenResidence(null)}
          onAction={action}
          onOpenStay={(s) => {
            setOpenResidence(null);
            setOpenStay(s);
          }}
        />
      )}
      <StayModals modal={stayModal} onClose={() => setStayModal(null)} />
    </div>
  );
};
