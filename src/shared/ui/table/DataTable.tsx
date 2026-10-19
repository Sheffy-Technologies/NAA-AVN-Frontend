import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";

export type DataTableColumn = {
  key: string;
  header: ReactNode;
  className?: string;
};

export type DataTableProps = {
  columns: readonly DataTableColumn[];
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  loadingText?: string;
  emptyText?: string;
  minWidthClassName?: string;
  containerClassName?: string;
  tableClassName?: string;
  headRowClassName?: string;
  bodyClassName?: string;
};

export const DataTable = ({
  columns,
  children,
  isLoading = false,
  isEmpty = false,
  loadingText = "Loading...",
  emptyText = "No records found.",
  minWidthClassName = "min-w-[1000px]",
  containerClassName,
  tableClassName,
  headRowClassName,
  bodyClassName,
}: DataTableProps) => {
  const { isDark } = useTheme();
  const colSpan = columns.length;

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-colors",
        isDark
          ? "bg-[#001219] border-[#0A4D66]/40 text-white"
          : "bg-white border-slate-200 text-slate-800 shadow-sm",
        containerClassName,
      )}
    >
      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full text-left border-collapse",
            minWidthClassName,
            tableClassName,
          )}
        >
          <thead>
            <tr
              className={cn(
                "text-[11px] font-bold uppercase tracking-wider border-b transition-colors",
                isDark
                  ? "bg-[#001825] text-gray-400 border-[#0A4D66]/40"
                  : "bg-slate-100 text-slate-600 border-slate-200",
                headRowClassName,
              )}
            >
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn("px-4 py-3 font-semibold", column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-y text-xs transition-colors",
              isDark ? "divide-[#0A4D66]/20" : "divide-slate-100",
              bodyClassName,
            )}
          >
            {isLoading ? (
              <tr>
                <td
                  className={cn(
                    "px-6 py-8 text-center text-xs",
                    isDark ? "text-gray-400" : "text-slate-500",
                  )}
                  colSpan={colSpan}
                >
                  <div className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <span>{loadingText}</span>
                  </div>
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td
                  className={cn(
                    "px-6 py-8 text-center text-xs",
                    isDark ? "text-gray-400" : "text-slate-500",
                  )}
                  colSpan={colSpan}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
