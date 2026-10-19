import type React from "react";

/**
 * Checks if a click event target is or is within an interactive element
 * (buttons, links, inputs, selects, dropdowns, role="button", or elements marked with data-prevent-row-click).
 */
export const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      "button, a, input, select, textarea, [role='button'], [data-prevent-row-click]",
    ),
  );
};

/**
 * Executes the row navigation callback only if the click did not originate
 * from an interactive child element (button, link, input, 3-dot action menu, etc.).
 */
export const onInteractiveRowClick = (
  e: React.MouseEvent,
  action: () => void,
): void => {
  if (isInteractiveTarget(e.target)) {
    return;
  }
  action();
};

/**
 * Keyboard handler to support row activation with Enter or Space key for accessibility.
 */
export const onInteractiveRowKeyDown = (
  e: React.KeyboardEvent,
  action: () => void,
): void => {
  if (e.key === "Enter" || e.key === " ") {
    if (isInteractiveTarget(e.target)) {
      return;
    }
    e.preventDefault();
    action();
  }
};
