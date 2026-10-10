import { useRef, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import { useTheme } from "@/context/ThemeContext";

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  label?: string;
  placeholder?: string;
  options: SearchableSelectOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  className?: string;
  /** Merged onto the trigger button — use to override padding/text-size for compact (e.g. filter bar) usage. */
  buttonClassName?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
}

export const SearchableSelect = ({
  label,
  placeholder = "Select...",
  options,
  value,
  onChange,
  className,
  buttonClassName,
  disabled,
  searchPlaceholder = "Search...",
  clearable = true,
}: SearchableSelectProps) => {
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
  const optionRowHoverCls = isDark ? "hover:bg-[#0A4D66]/20" : "hover:bg-blue-50";
  const optionTextSelectedCls = isDark
    ? "text-white font-medium"
    : "text-gray-900 font-medium";
  const optionTextIdleCls = isDark
    ? "text-gray-300 group-hover:text-white"
    : "text-gray-700 group-hover:text-gray-900";
  const descriptionCls = isDark ? "text-gray-500" : "text-gray-400";
  const clearRowCls = isDark
    ? "text-gray-400 hover:bg-[#0A4D66]/20 hover:text-white"
    : "text-gray-500 hover:bg-blue-50 hover:text-gray-900";

  useClickOutside(containerRef, () => {
    setIsOpen(false);
    setSearchTerm("");
  });

  const selectedOption = options.find((o) => o.value === value) ?? null;

  const filteredOptions = searchTerm.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
      )
    : options;

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(null);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className={cn("space-y-1", className)} ref={containerRef}>
      {label && (
        <label className={cn("block text-sm font-medium mb-1", labelCls)}>
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full border rounded-md py-3 px-3 text-left text-sm focus:outline-none focus:ring-2 flex items-center justify-between gap-2 transition-colors",
            triggerCls,
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && triggerOpenCls,
            buttonClassName,
          )}
        >
          <span
            className={cn(
              "truncate",
              !selectedOption ? placeholderTextCls : valueTextCls,
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {clearable && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                aria-label="Clear selection"
              >
                <Icon
                  icon="mdi:close"
                  className={cn("w-4 h-4", chevronCls, "hover:opacity-70")}
                />
              </span>
            )}
            <Icon
              icon="mdi:chevron-down"
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                chevronCls,
                isOpen && "rotate-180",
              )}
            />
          </div>
        </button>

        {isOpen && !disabled && (
          <div
            className={cn(
              "absolute z-20 mt-1 w-full border rounded-md shadow-xl max-h-72 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col",
              dropdownCls,
            )}
          >
            <div className={cn("p-2 border-b sticky top-0", searchWrapCls)}>
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "w-full border rounded px-2 py-1.5 text-sm focus:outline-none",
                  searchInputCls,
                )}
              />
            </div>
            <div className="overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className={cn("px-3 py-2 text-sm text-center", emptyTextCls)}>
                  {searchTerm ? "No matches" : "No options available"}
                </div>
              ) : (
                <>
                  {clearable && selectedOption && (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 cursor-pointer border-b text-sm transition-colors",
                        clearRowCls,
                      )}
                      onClick={handleClear}
                    >
                      <Icon icon="mdi:close-circle-outline" className="w-4 h-4" />
                      Clear selection
                    </div>
                  )}
                  {filteredOptions.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <div
                        key={option.value}
                        className={cn(
                          "flex flex-col px-3 py-2 cursor-pointer group transition-colors",
                          optionRowHoverCls,
                        )}
                        onClick={() => handleSelect(option.value)}
                      >
                        <span
                          className={cn(
                            "text-sm transition-colors",
                            isSelected ? optionTextSelectedCls : optionTextIdleCls,
                          )}
                        >
                          {option.label}
                        </span>
                        {option.description && (
                          <span className={cn("text-xs", descriptionCls)}>
                            {option.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
