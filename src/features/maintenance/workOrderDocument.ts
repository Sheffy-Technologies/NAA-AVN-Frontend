import { toCalendarDate, type NaavnDocument } from "@/shared/documents/naavnDocument";
import type { WorkOrderResponse, WorkOrderTask, WorkOrderTaskPersonnel } from "./api";

// No paper template exists for work orders yet; set these once a form number is assigned.
const WORK_ORDER_DOC_REF: string | null = null;
const WORK_ORDER_REVISION_NO: string | null = null;
const WORK_ORDER_REVISION_DATE: string | null = null;

export const formatReporter = (reporter: WorkOrderResponse["reported_by"]) => {
  if (reporter == null) return "-";
  if (typeof reporter === "number") return String(reporter);

  const fullName = reporter.full_name?.trim();
  if (fullName) return fullName;

  const name = [reporter.firstname, reporter.lastname]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();
  if (name) return name;

  if (reporter.service_number?.trim()) return reporter.service_number;
  if (reporter.email?.trim()) return reporter.email;
  if (reporter.id) return `Personnel #${reporter.id}`;

  return "-";
};

export const formatPersonnelName = (
  person: Partial<Omit<WorkOrderTaskPersonnel, "rank">> & {
    rank?: { abbreviation?: string | null; name?: string | null } | null;
  },
) => {
  const fullName = person.full_name?.trim();
  const baseName =
    fullName ||
    [person.firstname, person.othernames, person.lastname]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ")
      .trim();

  const rankLabel = person.rank?.abbreviation?.trim() || person.rank?.name?.trim() || "";
  const label = [rankLabel, baseName || person.service_number || person.call_sign || ""]
    .filter((value) => value.length > 0)
    .join(" ")
    .trim();

  if (label) return label;
  if (person.id) return `Personnel #${person.id}`;

  return "Unassigned";
};

export const getTaskAssignedPersonnel = (task: WorkOrderTask) =>
  task.assignedPersonnel ?? task.assigned_personnel ?? [];

type TaskWithInventories = WorkOrderTask & {
  maintenance_inventories?: WorkOrderTask["maintenanceInventories"];
};

export const getTaskMaintenanceInventories = (task: TaskWithInventories) =>
  task.maintenanceInventories ?? task.maintenance_inventories ?? [];

const taskSummary = (task: WorkOrderTask) =>
  [task.program?.name, task.defect?.title, task.description]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");

export const buildWorkOrderDocument = (workOrder: WorkOrderResponse): NaavnDocument => {
  const tasks = workOrder.tasks ?? [];
  const reporter = formatReporter(workOrder.reported_by);

  return {
    title: "WORK ORDER",
    docRef: WORK_ORDER_DOC_REF,
    revisionNo: WORK_ORDER_REVISION_NO,
    revisionDate: WORK_ORDER_REVISION_DATE,
    sheetName: `WO ${workOrder.id}`,
    columnWidths: [8.3, 16, 18, 24, 22, 15, 16],
    layout: {
      leftLabel: [0, 1],
      leftValue: [2, 2],
      rightLabel: [4, 4],
      rightValue: [5, 6],
      shipTo: [1, 4],
    },
    leftFields: [
      { label: "DATE:", value: toCalendarDate(workOrder.created_at) },
      { label: "ISSUED BY:", value: reporter === "-" ? "" : reporter.toUpperCase() },
      { label: "W/O NUMBER:", value: workOrder.id },
    ],
    rightFields: [
      { label: "AIRCRAFT / ASSET:", value: workOrder.asset?.name, bold: true },
      { label: "TAIL NUMBER:", value: workOrder.asset?.tail_number },
      { label: "MODEL:", value: workOrder.asset?.model },
    ],
    addressLabel: "TITLE",
    shipTo: [workOrder.title || `Work Order #${workOrder.id}`],
    tables: [
      {
        heading: "TASKS",
        columns: [
          { header: "ITEM", span: [0, 0], align: "center" },
          { header: "TASK TYPE", span: [1, 1], align: "center" },
          { header: "DESCRIPTION", span: [2, 3] },
          { header: "ASSIGNED PERSONNEL", span: [4, 4] },
          { header: "STATUS", span: [5, 5], align: "center" },
          { header: "LABOUR HOURS", span: [6, 6], format: "decimal" },
        ],
        rows: tasks.map((task, index) => [
          index + 1,
          (task.task_type || "routine").toUpperCase(),
          taskSummary(task),
          getTaskAssignedPersonnel(task).map(formatPersonnelName).join("\n"),
          (task.status || "pending").toUpperCase(),
          task.actual_labour_hours ?? "",
        ]),
        emptyText: "No tasks on this work order",
      },
      {
        heading: "PARTS",
        columns: [
          { header: "ITEM", span: [0, 0], align: "center" },
          { header: "PART NUMBER", span: [1, 1] },
          { header: "SERIAL NUMBER", span: [2, 2] },
          { header: "TASK", span: [3, 4] },
          { header: "QUANTITY", span: [5, 5], format: "integer" },
          { header: "DISPOSITION", span: [6, 6], align: "center" },
        ],
        rows: tasks.flatMap((task, taskIndex) =>
          getTaskMaintenanceInventories(task).map((item) => [
            0,
            item.inventory?.part_number || `Inventory #${item.inventory_id}`,
            item.inventory?.serial_number || "",
            `${taskIndex + 1}. ${taskSummary(task).split("\n")[0] || `Task #${task.id}`}`,
            item.quantity,
            item.disposition.toUpperCase(),
          ]),
        ).map((row, index) => [index + 1, ...row.slice(1)]),
        emptyText: "No parts issued against this work order",
      },
    ],
    approval: true,
  };
};
