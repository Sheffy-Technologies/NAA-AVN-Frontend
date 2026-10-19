import React from "react";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/icons/Icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "destructive" | "excel" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "sm",
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary:
        "bg-[#0A4D66] text-white hover:bg-[#083c50] shadow-sm active:scale-[0.98] border border-transparent",
      accent:
        "bg-[#7FD5FF] text-[#001219] font-bold hover:bg-[#5dbced] shadow-[0_0_12px_rgba(127,213,255,0.3)] active:scale-[0.98] border border-transparent",
      secondary:
        "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white shadow-sm active:scale-[0.98]",
      outline:
        "bg-transparent border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-[0.98]",
      ghost:
        "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 active:scale-[0.98]",
      destructive:
        "bg-red-600 text-white hover:bg-red-700 shadow-sm border border-transparent active:scale-[0.98]",
      success:
        "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-transparent active:scale-[0.98]",
      excel:
        "border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
    };

    const sizes = {
      xs: "px-2.5 py-1 text-xs rounded-md",
      sm: "px-3 py-1.5 text-xs font-semibold rounded-lg",
      md: "px-4 py-2 text-sm font-semibold rounded-lg",
      lg: "px-5 py-2.5 text-base font-semibold rounded-xl",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-primary transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:ring-offset-1 dark:focus:ring-offset-[#0B1528] disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Icon icon="eos-icons:loading" className="mr-1.5 animate-spin w-4 h-4" />}
        {!isLoading && leftIcon && <Icon icon={leftIcon} className="mr-1.5 w-4 h-4" />}
        {children}
        {!isLoading && rightIcon && <Icon icon={rightIcon} className="ml-1.5 w-4 h-4" />}
      </button>
    );
  },
);

Button.displayName = "Button";
