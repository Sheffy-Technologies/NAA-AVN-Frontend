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
  size?: "sm" | "md" | "lg";
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
  size = "md",
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  const sizeClasses = {
    sm: "py-1.5 px-3 text-xs rounded-lg",
    md: "py-2.5 px-3 text-sm rounded-lg",
    lg: "py-3 px-3.5 text-base rounded-xl",
  }[size];

  const triggerCls = isDark
    ? "bg-[#001825] border-[#0A4D66]/60 text-white focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/40"
    : "bg-white border-slate-300 text-slate-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30";
  const triggerOpenCls = isDark
    ? "border-[#7FD5FF] ring-2 ring-[#7FD5FF]/30"
    : "border-sky-500 ring-2 ring-sky-500/20";
  const placeholderTextCls = isDark ? "text-gray-400" : "text-slate-400";
  const valueTextCls = isDark ? "text-white font-medium" : "text-slate-900 font-medium";
  const chevronCls = isDark ? "text-gray-400" : "text-slate-500";
  const labelCls = isDark ? "text-gray-200" : "text-slate-700";
  const dropdownCls = isDark
    ? "bg-[#001219] border-[#0A4D66]"
    : "bg-white border-slate-200 shadow-xl";
  const searchWrapCls = isDark
    ? "border-[#0A4D66]/40 bg-[#001219]"
    : "border-slate-200 bg-slate-50";
  const searchInputCls = isDark
    ? "bg-[#001825] border-[#0A4D66]/60 text-white placeholder-gray-500 focus:border-[#7FD5FF]"
    : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-500";
  const emptyTextCls = isDark ? "text-gray-400" : "text-slate-500";
  const optionRowHoverCls = isDark ? "hover:bg-[#0A4D66]/30" : "hover:bg-slate-100";
  const optionTextSelectedCls = isDark
    ? "text-[#7FD5FF] font-bold"
    : "text-sky-700 font-bold";
  const optionTextIdleCls = isDark
    ? "text-gray-200 group-hover:text-white"
    : "text-slate-800 group-hover:text-slate-900";
  const descriptionCls = isDark ? "text-gray-400" : "text-slate-500";
  const clearRowCls = isDark
    ? "text-gray-400 hover:bg-[#0A4D66]/20 hover:text-white"
    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

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
            "w-full border text-left focus:outline-none flex items-center justify-between gap-2 transition-colors",
            sizeClasses,
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
                "w-4 h-4 transition-transform duration-200",
                chevronCls,
                isOpen && "rotate-180",
              )}
            />
          </div>
        </button>

        {isOpen && !disabled && (
          <div
            className={cn(
              "absolute z-30 mt-1 w-full border rounded-xl shadow-2xl max-h-72 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col",
              dropdownCls,
            )}
          >
            <div className={cn("p-2 border-b sticky top-0", searchWrapCls)}>
              <div className="relative">
                <Icon
                  icon="mdi:magnify"
                  className={cn(
                    "w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2",
                    isDark ? "text-gray-400" : "text-slate-400",
                  )}
                />
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn(
                    "w-full border rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none transition-colors",
                    searchInputCls,
                  )}
                />
              </div>
            </div>
            <div className="overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className={cn("px-3 py-4 text-xs text-center", emptyTextCls)}>
                  {searchTerm ? "No matching options found" : "No options available"}
                </div>
              ) : (
                <>
                  {clearable && selectedOption && (
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 cursor-pointer border-b text-xs transition-colors",
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
                          "flex items-center justify-between px-3 py-2 cursor-pointer group transition-colors",
                          isSelected
                            ? isDark
                              ? "bg-[#0A4D66]/40"
                              : "bg-sky-50"
                            : optionRowHoverCls,
                        )}
                        onClick={() => handleSelect(option.value)}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span
                            className={cn(
                              "text-xs transition-colors truncate",
                              isSelected ? optionTextSelectedCls : optionTextIdleCls,
                            )}
                          >
                            {option.label}
                          </span>
                          {option.description && (
                            <span className={cn("text-[11px]", descriptionCls)}>
                              {option.description}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <Icon
                            icon="mdi:check"
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isDark ? "text-[#7FD5FF]" : "text-sky-600",
                            )}
                          />
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
