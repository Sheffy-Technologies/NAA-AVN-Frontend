import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useTheme } from "@/context/ThemeContext";

export type TabItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: string;
  badge?: ReactNode;
};

export type AppTabsProps<T extends string = string> = {
  tabs: readonly TabItem<T>[] | TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: "underline" | "segmented";
  size?: "sm" | "md";
  className?: string;
  containerClassName?: string;
};

export const AppTabs = <T extends string>({
  tabs,
  activeTab,
  onChange,
  variant = "underline",
  size = "md",
  className,
  containerClassName,
}: AppTabsProps<T>) => {
  const { isDark } = useTheme();

  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "inline-flex flex-wrap items-center space-x-1 p-1 rounded-xl border transition-colors",
          isDark
            ? "bg-[#0A4D66] border-[#0A4D66]"
            : "bg-slate-200 border-slate-300",
          containerClassName,
        )}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg font-semibold transition-all outline-none",
                size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
                isActive
                  ? isDark
                    ? "bg-[#001219] text-[#7FD5FF] font-bold shadow-sm"
                    : "bg-white text-slate-900 font-bold shadow-sm"
                  : isDark
                    ? "text-gray-200 hover:text-white"
                    : "text-slate-600 hover:text-slate-900",
                className,
              )}
            >
              {tab.icon && (
                <Icon
                  icon={tab.icon}
                  className={cn(
                    "w-4 h-4 transition-colors",
                    isActive
                      ? isDark
                        ? "text-[#7FD5FF]"
                        : "text-sky-700"
                      : isDark
                        ? "text-gray-300"
                        : "text-slate-500",
                  )}
                />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                    isActive
                      ? isDark
                        ? "bg-[#7FD5FF]/20 text-[#7FD5FF]"
                        : "bg-sky-100 text-sky-700"
                      : isDark
                        ? "bg-black/30 text-gray-300"
                        : "bg-slate-300 text-slate-700",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Level 1: Underline Variant
  return (
    <div
      className={cn(
        "border-b relative transition-colors",
        isDark ? "border-[#0A4D66]/40" : "border-slate-300",
        containerClassName,
      )}
    >
      <div className="flex space-x-2 sm:space-x-4 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                "flex items-center space-x-2 text-sm transition-all relative outline-none rounded-t-lg whitespace-nowrap bg-transparent tab-link",
                size === "sm" ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
                isActive
                  ? isDark
                    ? "text-[#7FD5FF] font-bold bg-[#7FD5FF]/10"
                    : "text-sky-700 font-bold bg-sky-50"
                  : isDark
                    ? "text-gray-400 font-medium hover:text-white hover:bg-white/5"
                    : "text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100",
                className,
              )}
            >
              {tab.icon && (
                <Icon
                  icon={tab.icon}
                  className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5 transition-colors",
                    isActive
                      ? isDark
                        ? "text-[#7FD5FF]"
                        : "text-sky-700"
                      : isDark
                        ? "text-gray-400"
                        : "text-slate-500",
                  )}
                />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1.5",
                    isActive
                      ? isDark
                        ? "bg-[#7FD5FF]/20 text-[#7FD5FF]"
                        : "bg-sky-100 text-sky-700"
                      : isDark
                        ? "bg-slate-800 text-gray-300"
                        : "bg-slate-200 text-slate-700",
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full transition-all",
                    isDark
                      ? "bg-[#00A3E0] shadow-[0_0_12px_rgba(0,163,224,0.9)]"
                      : "bg-sky-700 shadow-sm",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
