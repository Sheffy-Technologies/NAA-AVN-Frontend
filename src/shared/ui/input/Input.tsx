import React from "react";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/icons/Icon";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
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
    const reactId = React.useId();
    const inputId = id ?? reactId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn("block text-sm font-medium text-gray-300 mb-1", labelClassName)}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon icon={leftIcon} className="text-gray-400" size={20} />
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "block w-full rounded-md bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-med focus:border-transparent sm:text-sm py-3 px-3 transition-colors",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-red-500 focus:ring-red-500",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <div
              className={cn(
                "absolute inset-y-0 right-0 pr-3 flex items-center",
                onRightIconClick && "cursor-pointer hover:text-white",
              )}
              onClick={onRightIconClick}
            >
              <Icon icon={rightIcon} className="text-gray-400" size={20} />
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
