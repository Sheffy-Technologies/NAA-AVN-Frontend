import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";

/**
 * Small "i" icon that explains something on hover, focus or click (tap on
 * touch screens). Used on table column headers to say what a column means
 * and how its value is calculated. The bubble is portalled to <body> so a
 * table's overflow:auto doesn't clip it.
 */
export const InfoTip = ({
  title,
  children,
  formula,
  className,
}: {
  title: string;
  children: React.ReactNode;
  /** Optional calculation, shown in monospace under the explanation. */
  formula?: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const id = useId();
  const show = open || pinned;

  const place = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
    setPos({ top: r.bottom + 6, left });
  };

  useEffect(() => {
    if (!show) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !bubble.current?.contains(t)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [show]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`About ${title}`}
        aria-describedby={show ? id : undefined}
        aria-expanded={show}
        onMouseEnter={() => {
          place();
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          place();
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Header cells may be clickable (sorting); the tip shouldn't trigger them.
          e.stopPropagation();
          place();
          setPinned((v) => !v);
        }}
        className={cn(
          "inline-flex items-center justify-center align-middle ml-1 rounded-full text-slate-400 hover:text-sky-600 dark:hover:text-[#7FD5FF] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7FD5FF]",
          className,
        )}
      >
        <Icon icon="mdi:information-outline" className="w-3.5 h-3.5" />
      </button>
      {show &&
        pos &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: 288 }}
            className="fixed z-[80] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs normal-case tracking-normal font-normal text-slate-700 shadow-xl dark:border-[#0A4D66] dark:bg-[#001825] dark:text-gray-200"
          >
            <div className="font-semibold text-slate-900 dark:text-white mb-1">{title}</div>
            <div className="leading-relaxed">{children}</div>
            {formula && (
              <div className="mt-2 whitespace-pre-line rounded bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-slate-800 dark:bg-white/10 dark:text-[#7FD5FF]">
                {formula}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};
