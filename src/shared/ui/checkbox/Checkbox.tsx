import React from 'react';
import { cn } from '@/shared/utils/cn';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const autoId = React.useId();
    const checkboxId = id ?? autoId;

    return (
      <div className="flex items-center">
        <input
          id={checkboxId}
          type="checkbox"
          ref={ref}
          className={cn(
            'h-4 w-4 rounded border-gray-500 text-primary-med focus:ring-primary-med bg-transparent cursor-pointer',
            className
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={checkboxId}
            className="ml-2 block text-sm text-gray-300 select-none cursor-pointer"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

