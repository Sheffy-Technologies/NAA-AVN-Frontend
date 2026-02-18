import { Icon as IconifyIcon } from '@iconify/react';
import { cn } from '@/shared/utils/cn';

interface IconProps {
  icon: string;
  className?: string;
  size?: number | string;
  onClick?: () => void;
}

export function Icon({ icon, className, size = 24, onClick }: IconProps) {
  return (
    <IconifyIcon
      icon={icon}
      width={size}
      height={size}
      className={cn('inline-block align-middle', className)}
      onClick={onClick}
    />
  );
}
