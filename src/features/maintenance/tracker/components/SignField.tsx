import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAppSelector } from "@/app/store";
import { SignaturePad, type SignaturePadHandle } from "@/features/approvals/components/SignaturePad";
import { TrackerDialog } from "./TrackerDialog";

/** Loads a stored signature through the authenticated endpoint (they're on the private disk). */
const useSignatureUrl = (path: string | null) => {
  const token = useAppSelector((state) => state.auth.token);
  // Keyed by path, so a changed or cleared path never shows the previous image.
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let url: string | null = null;
    let cancelled = false;
    axios
      .get(`${import.meta.env.VITE_API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data as Blob);
        setLoaded({ path, url });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, token]);

  return path && loaded?.path === path ? loaded.url : null;
};

/**
 * A signature box on a paper form. Shows the newly drawn signature (not yet
 * saved), else the stored one; "Sign" opens the touch pad. `onChange(null)`
 * means unchanged, `""` clears it.
 */
export const SignField = ({
  storedPath,
  pending,
  onChange,
  disabled,
}: {
  storedPath: string | null;
  pending: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) => {
  const stored = useSignatureUrl(pending === null ? storedPath : null);
  const [open, setOpen] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const shown = pending ? pending : pending === "" ? null : stored;

  return (
    <div className="sig">
      {shown ? <img src={shown} alt="Signature" /> : <span style={{ color: "#888", fontSize: 11 }}>{disabled ? "" : "Not signed"}</span>}
      {!disabled && (
        <span className="noprint" style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setOpen(true)} className="mt-link" style={{ fontSize: 11, color: "#1d5fd1", fontWeight: 700 }}>
            {shown ? "Re-sign" : "Sign"}
          </button>
          {shown && (
            <button type="button" onClick={() => onChange("")} className="mt-link" style={{ fontSize: 11, color: "#b42318", fontWeight: 700 }}>
              Clear
            </button>
          )}
        </span>
      )}
      {open && (
        <TrackerDialog
          title="Sign"
          subtitle="Draw your signature with a finger, stylus or mouse."
          onClose={() => setOpen(false)}
          width="max-w-lg"
          footer={
            <>
              <button
                type="button"
                className="mt-btn"
                onClick={() => {
                  const data = pad.current?.toDataUrl();
                  if (data) onChange(data);
                  setOpen(false);
                }}
              >
                Use signature
              </button>
              <button type="button" className="mt-btn g" onClick={() => pad.current?.clear()}>
                Clear pad
              </button>
            </>
          }
        >
          <SignaturePad ref={pad} height={170} />
        </TrackerDialog>
      )}
    </div>
  );
};
