import { useMemo } from "react";
import {
  useGetReportLookupQuery,
  type ReportFilterOperator,
  type ReportForeignKey,
} from "@/features/reports/api";

interface FilterValueFieldProps {
  field: string;
  operator: ReportFilterOperator;
  value: string;
  onChange: (next: string) => void;
  foreignKeys: ReportForeignKey[];
}

const NO_VALUE_OPERATORS: ReportFilterOperator[] = ["null", "not_null"];
const MULTI_VALUE_OPERATORS: ReportFilterOperator[] = ["in", "not_in", "between"];

/**
 * Renders the appropriate value input for a filter row.
 *
 * - Foreign-key columns become a dropdown sourced from the referenced table.
 * - `in` / `not_in` on a foreign-key column become a multi-select via comma-joined values.
 * - Operators that take no value (`null`, `not_null`) render a disabled input.
 * - Everything else falls back to a plain text input.
 */
export const FilterValueField = ({
  field,
  operator,
  value,
  onChange,
  foreignKeys,
}: FilterValueFieldProps) => {
  const foreignKey = useMemo(
    () => foreignKeys.find((fk) => fk.column === field),
    [field, foreignKeys],
  );

  const { data: lookup, isFetching } = useGetReportLookupQuery(
    foreignKey ? { table: foreignKey.foreign_table, per_page: 200 } : { table: "" },
    { skip: !foreignKey },
  );

  if (NO_VALUE_OPERATORS.includes(operator)) {
    return (
      <input
        type="text"
        value=""
        disabled
        placeholder="(no value)"
        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500 disabled:opacity-40"
      />
    );
  }

  if (foreignKey && lookup?.data?.length) {
    const options = lookup.data;
    const isMulti = MULTI_VALUE_OPERATORS.includes(operator);

    if (isMulti) {
      const selected = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      return (
        <select
          aria-label={`${field} value`}
          multiple
          value={selected}
          onChange={(event) => {
            const next = Array.from(event.target.selectedOptions).map((option) => option.value);
            onChange(next.join(","));
          }}
          className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none min-h-[42px]"
        >
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label} ({String(option.value)})
            </option>
          ))}
        </select>
      );
    }

    return (
      <select
        aria-label={`${field} value`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none appearance-none"
      >
        <option value="">{isFetching ? "Loading..." : "Select value"}</option>
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label} ({String(option.value)})
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={
        operator === "between"
          ? "start,end"
          : MULTI_VALUE_OPERATORS.includes(operator)
            ? "value1,value2"
            : foreignKey && isFetching
              ? "Loading..."
              : "value"
      }
      className="w-full bg-[#001219] border border-[#0A4D66]/40 rounded-md px-3 py-2 text-xs sm:text-sm text-white outline-none placeholder:text-gray-500"
    />
  );
};
