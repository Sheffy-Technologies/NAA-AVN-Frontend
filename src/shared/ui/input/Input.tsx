import React from "react";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/icons/Icon";
import { useTheme } from "@/context/ThemeContext";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelClassName?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconClick?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      labelClassName,
      error,
      leftIcon,
      rightIcon,
      onRightIconClick,
      id,
      ...props
    },
    ref,
  ) => {
    const { isDark } = useTheme();
    const reactId = React.useId();
    const inputId = id ?? reactId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-xs font-semibold mb-1 transition-colors",
              isDark ? "text-gray-300" : "text-slate-700",
              labelClassName,
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon icon={leftIcon} className={isDark ? "text-gray-400" : "text-slate-400"} size={16} />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "block w-full rounded-lg text-xs py-2 px-3 border outline-none transition-colors",
              isDark
                ? "bg-[#001219] border-[#0A4D66]/50 text-white placeholder-gray-500 focus:border-[#7FD5FF] focus:ring-1 focus:ring-[#7FD5FF]/30"
                : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#0A4D66] focus:ring-1 focus:ring-[#0A4D66]/20 shadow-sm",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div
              className={cn(
                "absolute inset-y-0 right-0 pr-3 flex items-center",
                onRightIconClick && "cursor-pointer hover:opacity-80",
              )}
              onClick={onRightIconClick}
            >
              <Icon icon={rightIcon} className={isDark ? "text-gray-400" : "text-slate-400"} size={16} />
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
