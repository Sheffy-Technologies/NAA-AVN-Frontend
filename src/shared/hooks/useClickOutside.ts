import { useEffect, type RefObject } from "react";

export const useClickOutside = <T extends HTMLElement | null>(
  ref: RefObject<T>,
  handler: () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }

      handler();
    };

    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [ref, handler, enabled]);
};
