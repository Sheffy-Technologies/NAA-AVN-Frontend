import React from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";

/**
 * The HTML tracker's buttons (`.mt-btn`): solid accent, `g` (plain, bordered)
 * and `r` (red). Takes the shared Button's props so tracker screens can use
 * either; variants map onto those three.
 */
export const Button = ({
  variant = "primary",
  size = "md",
  leftIcon,
  isLoading,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "destructive" | "excel" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  leftIcon?: string;
  isLoading?: boolean;
}) => (
  <button
    type={type}
    disabled={disabled || isLoading}
    className={cn(
      "mt-btn",
      (variant === "secondary" || variant === "outline" || variant === "ghost" || variant === "excel") && "g",
      variant === "destructive" && "r",
      size === "xs" && "sm",
      className,
    )}
    {...props}
  >
    {isLoading ? <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" /> : leftIcon ? <Icon icon={leftIcon} className="h-4 w-4" /> : null}
    {children}
  </button>
);
