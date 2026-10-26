import { forwardRef } from "react";
import { NAAVN_LOGOS } from "@/shared/documents/naavnDocument";
import { PAPER_CSS } from "./paperPrint";

/*
 * The paper NAAVN forms the tracker fills in on screen — NAAVN-005
 * Maintenance Workpack, NAAVN-007 Spare Parts Request, Stores Issue Voucher —
 * laid out like the printed originals (grey label cells, black rules, white
 * paper in either theme). Print opens the form alone in a print window;
 * Download PDF captures it.
 */



export const PaperStyles = () => <style>{PAPER_CSS}</style>;

export const NaavnLogo = ({ side }: { side: "left" | "right" }) => <img className="logo" src={NAAVN_LOGOS[side]} alt="" />;

export const Paper = forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
  <>
    <PaperStyles />
    <div ref={ref} className="naavn-paper">
      {children}
    </div>
  </>
));
Paper.displayName = "Paper";

