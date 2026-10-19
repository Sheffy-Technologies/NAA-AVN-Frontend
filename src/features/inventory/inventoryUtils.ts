export const formatDateShort = (isoString: string | null | undefined): string => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatTimeShort = (isoString: string | null | undefined): string => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export const downloadCsv = (filename: string, rows: (string | number | null | undefined)[][]): void => {
  const content = rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export type RequisitionStatusLabel =
  | "Approved"
  | "Under Review"
  | "Rejected"
  | "Received"
  | "Pending"
  | "Unknown";

export const normalizeRequisitionStatus = (
  rawStatus: string | null | undefined,
): RequisitionStatusLabel => {
  if (!rawStatus) return "Pending";
  const normalized = rawStatus.toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "under_review" || normalized === "under review")
    return "Under Review";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "received") return "Received";
  if (normalized === "pending") return "Pending";
  return "Unknown";
};

export {
  onInteractiveRowClick,
  onInteractiveRowKeyDown,
  isInteractiveTarget,
} from "@/shared/utils/onInteractiveRowClick";

export const formatCategoryName = (name: string | null | undefined): string => {
  if (!name) return "Uncategorized";
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === "general(qm stores)" ||
    lower === "general (qm stores)" ||
    lower === "qm stores" ||
    lower === "general"
  ) {
    return "General (QM Stores)";
  }
  if (
    lower === "uncategorized" ||
    lower === "others" ||
    lower === "other" ||
    lower === "unknown" ||
    lower === "-" ||
    lower === "n/a"
  ) {
    return "Uncategorized";
  }
  return trimmed;
};

export const isUncategorizedCategory = (name: string | null | undefined): boolean => {
  if (!name) return true;
  const lower = name.trim().toLowerCase();
  return (
    lower === "uncategorized" ||
    lower === "others" ||
    lower === "other" ||
    lower === "unknown" ||
    lower === "-" ||
    lower === "n/a"
  );
};

export const isCategoryMatch = (
  itemCategory: string | null | undefined,
  targetCategory: string,
): boolean => {
  const target = targetCategory.trim().toLowerCase();
  if (target === "all") return true;

  if (target === "uncategorized" || target === "others" || target === "other") {
    return isUncategorizedCategory(itemCategory);
  }

  const itemCat = (itemCategory || "").trim().toLowerCase();

  if (
    target === "general (qm stores)" ||
    target === "general(qm stores)" ||
    target === "qm stores"
  ) {
    return itemCat.includes("general") || itemCat.includes("qm");
  }

  if (target === "ground support") {
    return itemCat.includes("ground");
  }

  if (target === "aircraft spares") {
    return itemCat.includes("aircraft") || itemCat.includes("spare");
  }

  if (target === "consumables") {
    return itemCat.includes("consumable");
  }

  return itemCat === target || itemCat.includes(target);
};

