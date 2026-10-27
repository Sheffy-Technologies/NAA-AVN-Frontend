import type React from "react";

/**
 * Checks if a click event target is or is within an interactive element
 * (buttons, links, inputs, selects, dropdowns, role="button", or elements marked with data-prevent-row-click).
 */
export const isInteractiveTarget = (
  target: EventTarget | null,
  container?: EventTarget | null,
): boolean => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const containerEl =
    container instanceof HTMLElement ? container : null;

  const interactiveEl = target.closest(
    "button, a, input, select, textarea, [role='button'], [data-prevent-row-click]",
  );

  if (!interactiveEl) {
    return false;
  }

  // If the interactive element found is the row/card container itself,
  // it is NOT an interactive child.
  if (containerEl && interactiveEl === containerEl) {
    return false;
  }

  // Ensure interactive element is inside container if container is provided
  if (containerEl && !containerEl.contains(interactiveEl)) {
    return false;
  }

  return true;
};

/**
 * Executes the row navigation callback only if the click did not originate
 * from an interactive child element (button, link, input, 3-dot action menu, etc.).
 */
export const onInteractiveRowClick = (
  e: React.MouseEvent,
  action: () => void,
): void => {
  if (isInteractiveTarget(e.target, e.currentTarget)) {
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
    if (isInteractiveTarget(e.target, e.currentTarget)) {
      return;
    }
    e.preventDefault();
    action();
  }
};
