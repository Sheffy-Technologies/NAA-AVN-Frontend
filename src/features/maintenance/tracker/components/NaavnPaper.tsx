import { forwardRef } from "react";
import {
  ARMY_LOGO_DATA_URL,
  NA_AVN_LOGO_DATA_URL,
} from "@/features/inventory/components/purchaseOrderLogos";
import { PAPER_CSS } from "./paperPrint";

/*
 * The paper NAAVN forms the tracker fills in on screen — NAAVN-005
 * Maintenance Workpack, NAAVN-007 Spare Parts Request, Stores Issue Voucher —
 * laid out like the printed originals (grey label cells, black rules, white
 * paper in either theme). Print opens the form alone in a print window;
 * Download PDF captures it.
 */

export const PaperStyles = () => <style>{PAPER_CSS}</style>;

export const NaavnLogo = ({ side }: { side: "left" | "right" }) => (
  <img
    className="logo"
    src={side === "left" ? ARMY_LOGO_DATA_URL : NA_AVN_LOGO_DATA_URL}
    alt={side === "left" ? "Nigerian Army Emblem" : "NA AVN Emblem"}
  />
);

export const Paper = forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
  <>
    <PaperStyles />
    <div ref={ref} className="naavn-paper">
      {children}
    </div>
  </>
));
Paper.displayName = "Paper";

