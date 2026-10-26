import { useEffect } from "react";
import { cn } from "@/shared/utils/cn";

/**
 * The tracker's dialogs, laid out like the HTML tracker's modal: a dimmed
 * mask the page scrolls in, a 520px panel (wider when `width` asks for it),
 * the title, a sub line, the body and a row of buttons. Escape or a click on
 * the mask closes it.
 */
export const TrackerDialog = ({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Any value other than "max-w-md"/"max-w-lg" gets the wider panel. */
  width?: string;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const wide = width !== undefined && width !== "max-w-md" && width !== "max-w-lg";

  return (
    <div className="mt-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cn("mt-modal", wide && "wide")}>
        <h2>{title}</h2>
        {subtitle && <div className="mt-sub">{subtitle}</div>}
        <div style={{ marginTop: 8 }}>{children}</div>
        {footer && <div className="mt-row">{footer}</div>}
      </div>
    </div>
  );
};

/** "Are you sure?" with OK / Cancel. */
export const ConfirmDialog = ({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "OK",
  destructive,
}: {
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  destructive?: boolean;
}) => (
  <TrackerDialog
    title="Please confirm"
    onClose={onCancel}
    width="max-w-md"
    footer={
      <>
        <button type="button" className={cn("mt-btn", destructive && "r")} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="mt-btn g" onClick={onCancel}>
          Cancel
        </button>
      </>
    }
  >
    <p style={{ margin: 0 }}>{message}</p>
  </TrackerDialog>
);
