import React from 'react';
import { cn } from '@/shared/utils/cn';
import { Icon } from '@/shared/icons/Icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-primary-med text-inverse-black hover:bg-opacity-90 active:bg-opacity-95 border border-transparent',
      secondary: 'bg-transparent border border-primary-med text-primary-med hover:bg-primary-med/10',
      ghost: 'bg-transparent text-primary-med hover:bg-primary-med/10',
      destructive: 'bg-red-500 text-white hover:bg-red-600',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-primary font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-med focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Icon icon="eos-icons:loading" className="mr-2 animate-spin" />}
        {!isLoading && leftIcon && <Icon icon={leftIcon} className="mr-2" />}
        {children}
        {!isLoading && rightIcon && <Icon icon={rightIcon} className="ml-2" />}
      </button>
    );
  }
);

Button.displayName = 'Button';
