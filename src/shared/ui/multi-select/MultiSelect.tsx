import { useRef, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useTheme } from "@/context/ThemeContext";

export interface MultiSelectOption {
  value: string | number;
  label: string;
}

interface MultiSelectProps {
  label: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onChange: (selected: (string | number)[]) => void;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  allowCustom?: boolean;
}

export const MultiSelect = ({
  label,
  placeholder = "Select...",
  options,
  selectedValues,
  onChange,
  className,
  disabled,
  searchable = false,
  searchPlaceholder = "Search...",
  allowCustom = false,
}: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  const triggerCls = isDark
    ? "bg-[#001825] border-[#0A4D66]/40 text-white focus:ring-[#7FD5FF]/40"
    : "bg-white border-gray-300 text-gray-900 focus:ring-blue-200";
  const triggerOpenCls = isDark
    ? "border-[#7FD5FF]/40 ring-2 ring-[#7FD5FF]/20"
    : "border-blue-400 ring-2 ring-blue-100";
  const placeholderTextCls = isDark ? "text-gray-400" : "text-gray-500";
  const valueTextCls = isDark ? "text-white" : "text-gray-900";
  const chevronCls = isDark ? "text-gray-400" : "text-gray-500";
  const labelCls = isDark ? "text-gray-300" : "text-gray-700";
  const dropdownCls = isDark
    ? "bg-[#001219] border-[#0A4D66]"
    : "bg-white border-gray-200";
  const searchWrapCls = isDark
    ? "border-[#0A4D66]/40 bg-[#001219]"
    : "border-gray-200 bg-white";
  const searchInputCls = isDark
    ? "bg-[#001825] border-[#0A4D66]/40 text-white placeholder-gray-500 focus:border-[#7FD5FF]/60"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400";
  const emptyTextCls = isDark ? "text-gray-500" : "text-gray-400";
  const selectAllRowCls = isDark
    ? "border-[#0A4D66]/30 bg-[#001825]/60 hover:bg-[#0A4D66]/20"
    : "border-gray-200 bg-gray-50 hover:bg-blue-50";
  const selectAllTextCls = isDark ? "text-[#7FD5FF]" : "text-blue-600";
  const optionRowHoverCls = isDark
    ? "hover:bg-[#0A4D66]/20"
    : "hover:bg-blue-50";
  const checkboxBaseCls = isDark
    ? "border-gray-500 group-hover:border-[#7FD5FF]/50"
    : "border-gray-300 group-hover:border-blue-400";
  const checkboxSelectedCls = isDark
    ? "bg-[#0369A1] border-[#7FD5FF]"
    : "bg-blue-600 border-blue-600";
  const checkIconCls = isDark ? "text-black" : "text-white";
  const optionTextSelectedCls = isDark
    ? "text-white font-medium"
    : "text-gray-900 font-medium";
  const optionTextIdleCls = isDark
    ? "text-gray-300 group-hover:text-white"
    : "text-gray-700 group-hover:text-gray-900";

  useClickOutside(containerRef, () => {
    setIsOpen(false);
    setSearchTerm("");
  });

  const handleToggle = (value: string | number) => {
    if (disabled) return;
    const isSelected = selectedValues.includes(value);
    if (isSelected) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleAddCustom = (customVal: string) => {
    const trimmed = customVal.trim();
    if (!trimmed) return;
    if (!selectedValues.includes(trimmed)) {
      onChange([...selectedValues, trimmed]);
    }
    setSearchTerm("");
  };

  const selectedLabels = selectedValues
    .map((v) => options.find((o) => o.value === v)?.label || String(v))
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("space-y-1", className)} ref={containerRef}>
      <label className={cn("block text-sm font-medium mb-1", labelCls)}>
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full border rounded-md py-3 px-3 text-left text-sm focus:outline-none focus:ring-2 flex items-center justify-between transition-colors",
            triggerCls,
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && triggerOpenCls,
          )}
        >
          <span className={!selectedValues.length ? placeholderTextCls : cn(valueTextCls, "truncate pr-4")}>
            {selectedLabels || placeholder}
          </span>
          <Icon 
            icon="mdi:chevron-down" 
            className={cn("w-5 h-5 transition-transform duration-200", chevronCls, isOpen && "rotate-180")} 
          />
        </button>

        {isOpen && !disabled && (
          <div className={cn("absolute z-50 mt-1 w-full border rounded-md shadow-xl max-h-60 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col", dropdownCls)}>
            {(searchable || allowCustom) && (
              <div className={cn("p-2 border-b sticky top-0", searchWrapCls)}>
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && allowCustom && searchTerm.trim()) {
                      e.preventDefault();
                      handleAddCustom(searchTerm);
                    }
                  }}
                  placeholder={allowCustom ? "Search or type custom name..." : searchPlaceholder}
                  className={cn("w-full border rounded px-2 py-1.5 text-sm focus:outline-none", searchInputCls)}
                />
              </div>
            )}
            <div className="overflow-y-auto">
            {(() => {
              const trimmedSearch = searchTerm.trim().toLowerCase();
              const filtered = (searchable || allowCustom) && trimmedSearch
                ? options.filter((o) =>
                    o.label.toLowerCase().includes(trimmedSearch),
                  )
                : options;
              const hasExactMatch = options.some(
                (o) => o.label.toLowerCase() === trimmedSearch,
              ) || selectedValues.some((v) => String(v).toLowerCase() === trimmedSearch);

              if (filtered.length === 0 && (!allowCustom || !searchTerm.trim())) {
                return (
                  <div className={cn("px-3 py-2 text-sm text-center", emptyTextCls)}>
                    {searchTerm ? "No matches" : "No options available"}
                  </div>
                );
              }
              const filteredValues = filtered.map((o) => o.value);
              const allSelected = filteredValues.length > 0 && filteredValues.every((v) =>
                selectedValues.includes(v),
              );
              const handleToggleAll = () => {
                if (disabled) return;
                if (allSelected) {
                  onChange(
                    selectedValues.filter((v) => !filteredValues.includes(v)),
                  );
                } else {
                  const merged = [...selectedValues];
                  for (const v of filteredValues) {
                    if (!merged.includes(v)) merged.push(v);
                  }
                  onChange(merged);
                }
              };
              return (
                <>
                  {allowCustom && searchTerm.trim() && !hasExactMatch && (
                    <div
                      className={cn(
                        "flex items-center px-3 py-2 border-b cursor-pointer transition-colors bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 text-sm font-medium",
                      )}
                      onClick={() => handleAddCustom(searchTerm)}
                    >
                      <Icon icon="mdi:plus-circle-outline" className="w-4 h-4 mr-2" />
                      Add custom: &quot;{searchTerm.trim()}&quot;
                    </div>
                  )}
                  {filtered.length > 0 && (
                    <div
                      className={cn("flex items-center px-3 py-2 border-b cursor-pointer group transition-colors", selectAllRowCls)}
                      onClick={handleToggleAll}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 border rounded mr-3 flex items-center justify-center transition-all duration-200",
                          allSelected ? checkboxSelectedCls : checkboxBaseCls,
                        )}
                      >
                        {allSelected && (
                          <Icon icon="mdi:check" className={cn("w-3 h-3", checkIconCls)} />
                        )}
                      </div>
                      <span className={cn("text-sm font-medium", selectAllTextCls)}>
                        {allSelected
                          ? `Clear all${searchTerm ? " (filtered)" : ""}`
                          : `Select all${searchTerm ? " (filtered)" : ""}`}
                      </span>
                    </div>
                  )}
                  {filtered.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={cn("flex items-center px-3 py-2 cursor-pointer group transition-colors", optionRowHoverCls)}
                    onClick={() => handleToggle(option.value)}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 border rounded mr-3 flex items-center justify-center transition-all duration-200",
                        isSelected ? checkboxSelectedCls : checkboxBaseCls,
                      )}
                    >
                      {isSelected && (
                        <Icon icon="mdi:check" className={cn("w-3 h-3", checkIconCls)} />
                      )}
                    </div>
                    <span className={cn("text-sm transition-colors", isSelected ? optionTextSelectedCls : optionTextIdleCls)}>
                      {option.label}
                    </span>
                  </div>
                );
              })}
                </>
              );
            })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
