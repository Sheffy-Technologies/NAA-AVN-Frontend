import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils/cn";

type FloatingActionMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  widthClassName?: string;
};

export const FloatingActionMenu = ({
  open,
  anchorRef,
  onClose,
  children,
  className,
  widthClassName = "w-40",
}: FloatingActionMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      const anchorRect = anchor.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const viewportPadding = 12;
      const spacing = 4;

      const left = Math.min(
        Math.max(anchorRect.right - menuWidth, viewportPadding),
        window.innerWidth - menuWidth - viewportPadding,
      );

      const openBelowTop = anchorRect.bottom + spacing;
      const openAboveTop = anchorRect.top - menuHeight - spacing;

      let top = openBelowTop;

      if (
        openBelowTop + menuHeight > window.innerHeight - viewportPadding &&
        openAboveTop >= viewportPadding
      ) {
        top = openAboveTop;
      } else {
        top = Math.min(
          Math.max(openBelowTop, viewportPadding),
          window.innerHeight - menuHeight - viewportPadding,
        );
      }

      setPosition((current) =>
        current.top === top && current.left === left ? current : { top, left },
      );
    };

    const animationFrameId = window.requestAnimationFrame(updatePosition);

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        menuRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={cn(
        "fixed bg-[#001219] border border-[#0A4D66]/40 rounded shadow-xl z-90 overflow-hidden",
        widthClassName,
        className,
      )}
      style={position}
    >
      {children}
    </div>,
    document.body,
  );
};
