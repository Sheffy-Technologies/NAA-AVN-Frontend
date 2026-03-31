import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

type DataTableColumn = {
  key: string;
  header: ReactNode;
  className?: string;
};

type DataTableProps = {
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
  const colSpan = columns.length;

  return (
    <div
      className={cn(
        "bg-[#001219] rounded-xl border border-[#0A4D66]/40 overflow-visible",
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
                "bg-[#001825] text-xs uppercase text-gray-400 border-b border-[#0A4D66]/40",
                headRowClassName,
              )}
            >
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn("px-6 py-4 font-medium", column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={cn(
              "divide-y divide-[#0A4D66]/20 text-sm",
              bodyClassName,
            )}
          >
            {isLoading ? (
              <tr>
                <td
                  className="px-6 py-8 text-center text-gray-500"
                  colSpan={colSpan}
                >
                  {loadingText}
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td
                  className="px-6 py-8 text-center text-gray-500"
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
