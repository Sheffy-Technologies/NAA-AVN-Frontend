import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";

export type SignaturePadHandle = {
  /** PNG data URL of the drawing, or null when nothing has been drawn. */
  toDataUrl: () => string | null;
  clear: () => void;
};

type Point = { x: number; y: number };

/**
 * Draw-to-sign pad. Pointer events cover finger, stylus and mouse alike;
 * `touch-action: none` stops the page from scrolling while signing. The
 * canvas is sized by devicePixelRatio so strokes stay sharp on high-DPI
 * screens, and ink is always dark on white so the stored PNG prints cleanly
 * regardless of the app theme.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number; onChange?: (hasInk: boolean) => void }>(
  ({ height = 180, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<Point | null>(null);
    const [hasInk, setHasInk] = useState(false);
    const lastWidth = useRef(0);
    // Held in a ref so a parent passing a new inline onChange on every render
    // doesn't re-run the canvas setup below, which would wipe the signature
    // each time the parent re-renders (e.g. when the finger lifts).
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const setInk = useCallback((value: boolean) => {
      setHasInk(value);
      onChangeRef.current?.(value);
    }, []);

    /** Sizes the canvas and paints it blank (no React state involved). */
    const paintBlank = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const { width } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0b1f33";
      ctx.lineWidth = 2.2;
    }, [height]);

    // Resizing or clearing wipes the bitmap, so any earlier signature is gone.
    const reset = useCallback(() => {
      paintBlank();
      setInk(false);
    }, [paintBlank, setInk]);

    useEffect(() => {
      paintBlank();
      lastWidth.current = canvasRef.current?.getBoundingClientRect().width ?? 0;
      // Only a real width change resets the pad, not unrelated layout shifts.
      const observer = new ResizeObserver(() => {
        const width = canvasRef.current?.getBoundingClientRect().width ?? 0;
        if (Math.abs(width - lastWidth.current) < 1) return;
        lastWidth.current = width;
        reset();
      });
      if (canvasRef.current) observer.observe(canvasRef.current);
      return () => observer.disconnect();
    }, [paintBlank, reset]);

    const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = point(e);
      // A tap leaves a dot.
      const ctx = e.currentTarget.getContext("2d");
      if (ctx && last.current) {
        ctx.beginPath();
        ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = "#0b1f33";
        ctx.fill();
      }
      if (!hasInk) setInk(true);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !last.current) return;
      e.preventDefault();
      const ctx = e.currentTarget.getContext("2d");
      if (!ctx) return;
      const next = point(e);
      // Pressure from pens/touch screens varies the stroke slightly.
      ctx.lineWidth = e.pressure > 0 && e.pointerType !== "mouse" ? 1.4 + e.pressure * 2 : 2.2;
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      last.current = next;
    };

    const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawing.current = false;
      last.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    };

    useImperativeHandle(ref, () => ({
      toDataUrl: () => (hasInk && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
      clear: () => reset(),
    }));

    return (
      <div>
        <div className="relative rounded-lg border-2 border-dashed border-slate-300 dark:border-[#0A4D66] overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            style={{ height, width: "100%", touchAction: "none" }}
            className="block cursor-crosshair"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
            aria-label="Signature pad: draw your signature"
            role="img"
          />
          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Sign here with your finger, stylus or mouse
            </div>
          )}
          <div className="pointer-events-none absolute left-6 right-6 bottom-8 border-b border-slate-300" />
        </div>
        <div className="flex justify-end mt-1.5">
          <button
            type="button"
            onClick={() => reset()}
            disabled={!hasInk}
            className={cn("inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-40")}
          >
            <Icon icon="mdi:eraser" className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>
    );
  },
);

SignaturePad.displayName = "SignaturePad";
