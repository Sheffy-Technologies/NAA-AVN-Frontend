import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/shared/utils/cn";
import { PrimaryButton, SqPanel, SqStatus, SqTable } from "@/features/safety/components/sqUi";
import { useFieldClass, useSqPermissions } from "@/features/safety/components/sqHelpers";
import { useGetStockIssuesQuery, type StockIssue } from "../api";
import { ISSUE_STATUS_LABEL, ISSUE_STATUS_TONE, formatIssueDate } from "../stockIssueHelpers";

/** "Issues" tab of the Inventory page: vouchers sending stock between units. */
export const StockIssuesTab = () => {
  const navigate = useNavigate();
  const fieldClass = useFieldClass();
  const { has } = useSqPermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { data: issues = [], isLoading } = useGetStockIssuesQuery({ q: q || undefined, status: status || undefined });
  const open = (id: number) => navigate(`/dashboard/inventory/issues/${id}`, { state: { from: "/dashboard/inventory?tab=issues", fromLabel: "Issues" } });

  return (
    <SqPanel
      title="Issue vouchers"
      subtitle="Inventory sent from one unit to another. Stock leaves the sending unit when issued and is added to the receiving unit when they confirm receipt."
      action={
        has("stock-issues.create") ? (
          <PrimaryButton onClick={() => navigate("/dashboard/inventory/issues/new", { state: { from: "/dashboard/inventory?tab=issues", fromLabel: "Issues" } })}>
            New issue voucher
          </PrimaryButton>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reference, description or part number…"
          className={cn(fieldClass, "flex-1 min-w-[200px]")}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(fieldClass, "w-auto")}>
          <option value="">All statuses</option>
          {Object.entries(ISSUE_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <SqTable<StockIssue>
        rows={issues}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => open(r.id)}
        empty="No issue vouchers yet."
        columns={[
          {
            key: "item",
            label: "Voucher / item",
            render: (r) => (
              <div>
                <div className="font-semibold">{r.description}</div>
                <div className="text-[11px] opacity-70 font-mono">
                  {r.reference}
                  {r.part_number ? ` · P/N ${r.part_number}` : ""}
                </div>
              </div>
            ),
          },
          { key: "qty", label: "Qty", render: (r) => `${r.quantity}${r.unit_of_issue ? ` ${r.unit_of_issue}` : ""}` },
          { key: "route", label: "From → to", render: (r) => `${r.unit?.name ?? "-"} → ${r.receiving_unit?.name ?? "-"}` },
          { key: "date", label: "Date of issue", render: (r) => formatIssueDate(r.issue_date) },
          { key: "docs", label: "Docs", render: (r) => String(r.documents.length) },
          { key: "status", label: "Status", align: "right", render: (r) => <SqStatus value={ISSUE_STATUS_TONE[r.status]} label={ISSUE_STATUS_LABEL[r.status]} /> },
        ]}
      />
    </SqPanel>
  );
};
