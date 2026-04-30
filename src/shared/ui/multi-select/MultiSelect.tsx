import { useRef, useState } from "react";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useClickOutside } from "@/shared/hooks/useClickOutside";

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
}: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedLabels = selectedValues
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <div className={cn("space-y-1", className)} ref={containerRef}>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full bg-[#001825] border border-[#0A4D66]/40 rounded-md py-3 px-3 text-left text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#7FD5FF]/40 flex items-center justify-between transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "border-[#7FD5FF]/40 ring-2 ring-[#7FD5FF]/20"
          )}
        >
          <span className={!selectedValues.length ? "text-gray-400" : "text-white truncate pr-4"}>
            {selectedLabels || placeholder}
          </span>
          <Icon 
            icon="mdi:chevron-down" 
            className={cn("w-5 h-5 text-gray-400 transition-transform duration-200", isOpen && "rotate-180")} 
          />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-20 mt-1 w-full bg-[#001219] border border-[#0A4D66] rounded-md shadow-xl max-h-60 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col">
            {searchable && (
              <div className="p-2 border-b border-[#0A4D66]/40 bg-[#001219] sticky top-0">
                <input
                  type="text"
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-[#001825] border border-[#0A4D66]/40 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7FD5FF]/60"
                />
              </div>
            )}
            <div className="overflow-y-auto">
            {(() => {
              const filtered = searchable && searchTerm.trim()
                ? options.filter((o) =>
                    o.label.toLowerCase().includes(searchTerm.trim().toLowerCase()),
                  )
                : options;
              if (filtered.length === 0) {
                return (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    {searchTerm ? "No matches" : "No options available"}
                  </div>
                );
              }
              return filtered.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className="flex items-center px-3 py-2 hover:bg-[#0A4D66]/20 cursor-pointer group transition-colors"
                    onClick={() => handleToggle(option.value)}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 border rounded mr-3 flex items-center justify-center transition-all duration-200",
                        isSelected
                          ? "bg-[#0369A1] border-[#7FD5FF]"
                          : "border-gray-500 group-hover:border-[#7FD5FF]/50"
                      )}
                    >
                      {isSelected && (
                        <Icon icon="mdi:check" className="w-3 h-3 text-black" />
                      )}
                    </div>
                    <span className={cn("text-sm transition-colors", isSelected ? "text-white font-medium" : "text-gray-300 group-hover:text-white")}>
                      {option.label}
                    </span>
                  </div>
                );
              });
            })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
