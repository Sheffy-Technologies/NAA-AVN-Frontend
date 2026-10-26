import { SignatureImage } from "@/features/approvals/components/ApprovalPanel";
import { cn } from "@/shared/utils/cn";
import type { MemoStatus } from "../api";
import { formatMemoDate, sanitizeMemoHtml } from "../memoHelpers";
import crest from "../memo-crest.jpeg";
import "../memo.css";

export const SECRETS_ACT_NOTICE =
  "“Unauthorized disclosure, transmission, reproduction or retention of information on this sheet violates the official Secrets Act CAP 03 (LFN) 2004”";

export type MemoSheetData = {
  id?: number;
  classification?: string | null;
  reference?: string | null;
  to?: string | null;
  from?: string | null;
  memo_date?: string | null;
  subject?: string | null;
  body?: string | null;
  originator_rank?: string | null;
  originator_name?: string | null;
  status?: MemoStatus;
  has_originator_signature?: boolean;
  /** A signature drawn but not yet submitted (form preview). */
  originator_signature_src?: string | null;
  decision?: {
    action: "approved" | "rejected";
    by: { name: string } | null;
    comment: string | null;
    signed_at: string | null;
    has_signature: boolean;
  } | null;
};

const STATUS_STAMP: Partial<Record<MemoStatus, string>> = {
  draft: "DRAFT",
  pending: "AWAITING APPROVAL",
  rejected: "NOT APPROVED",
};

/**
 * A memo drawn as the printed NA AVN COMD memo: classification header and
 * footer, page border, crest, watermark. Always black-on-white regardless of
 * the app theme, because it represents the paper document. Mirrors the
 * backend PDF (resources/views/memos/pdf.blade.php).
 */
export const MemoSheet = ({ memo, className }: { memo: MemoSheetData; className?: string }) => {
  const classification = memo.classification || "RESTRICTED";
  const stamp = memo.status ? STATUS_STAMP[memo.status] : "DRAFT";
  const approved = memo.status === "approved" && memo.decision?.action === "approved";

  return (
    <div className={cn("bg-white text-black shadow-xl mx-auto w-full max-w-[820px] px-4 sm:px-8 py-4 select-text", className)}>
      <div className="text-center text-sm italic font-serif">{classification}</div>

      <div className="relative border border-black mt-2 px-5 sm:px-8 pt-4 pb-6 min-h-[900px] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        >
          <span className="font-serif text-[64px] sm:text-[88px] tracking-wider text-black/[0.09] -rotate-[55deg] whitespace-nowrap">
            NA AVN COMD
          </span>
        </div>

        <div className="relative">
          <h1 className="text-center font-serif italic font-bold underline text-4xl sm:text-5xl leading-tight">MEMORANDUM</h1>
          {stamp && <div className="text-center text-[11px] font-bold tracking-widest text-orange-800 mt-0.5">{stamp}</div>}

          <div className="memo-body grid grid-cols-[1fr_auto_1fr] items-end gap-2 mt-1 not-italic">
            <div className="italic">To: {memo.to}</div>
            <img src={crest} alt="" className="w-20 sm:w-24 mx-auto" />
            <div className="italic text-right">From: {memo.from}</div>
            <div className="italic col-span-2 mt-2">Ref: {memo.reference || <span className="text-gray-400">Assigned on submission</span>}</div>
            <div className="italic text-right mt-2">Date: {formatMemoDate(memo.memo_date)}</div>
          </div>
          <div className="border-b-[3px] border-black mt-1 mb-4" />

          <div className="memo-body font-bold underline mb-3">
            Subj:&nbsp;&nbsp;&nbsp;&nbsp;{(memo.subject ?? "").toUpperCase()}
          </div>

          <div className="memo-body text-justify" dangerouslySetInnerHTML={{ __html: sanitizeMemoHtml(memo.body) }} />

          <div className="memo-body grid grid-cols-[auto_1fr_auto] items-end gap-6 mt-4">
            <div>
              Rank: <strong>{memo.originator_rank}</strong>
            </div>
            <div>
              Name: <strong>{memo.originator_name}</strong>
            </div>
            <div className="flex items-end gap-2">
              Sign:
              {memo.originator_signature_src ? (
                <img src={memo.originator_signature_src} alt="Signature" className="h-10 max-w-[180px] object-contain" />
              ) : memo.id && memo.has_originator_signature ? (
                <SignatureImage path={`/memos/${memo.id}/signatures/originator`} className="h-10 border-0 bg-transparent" />
              ) : (
                <span>………………….</span>
              )}
            </div>
          </div>

          {approved && memo.decision && (
            <div className="memo-body border border-black mt-6 px-3 py-2 text-[13px]">
              <div className="font-bold underline not-italic">APPROVED</div>
              <div>
                By: <strong>{memo.decision.by?.name}</strong>&nbsp;&nbsp;&nbsp; Date: {formatMemoDate(memo.decision.signed_at)}
              </div>
              {memo.decision.comment && <div>Note: {memo.decision.comment}</div>}
              {memo.id && memo.decision.has_signature && (
                <SignatureImage path={`/memos/${memo.id}/signatures/approver`} className="h-12 border-0 bg-transparent mt-1" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-sm italic font-serif mt-2">{classification}</div>
      <div className="text-center text-[9px] italic">{SECRETS_ACT_NOTICE}</div>
    </div>
  );
};
