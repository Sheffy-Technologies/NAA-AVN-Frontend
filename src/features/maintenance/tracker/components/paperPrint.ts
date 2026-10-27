import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";

/* Styles, printing and PDF capture for the paper NAAVN forms (NaavnPaper.tsx). */

export const PAPER_CSS = `
.naavn-paper{background:#fff;color:#000;font:13px/1.3 Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:16px;border:1px solid #cbd5e1;color-scheme:light}
.naavn-paper .c{text-align:center;font-size:12px;margin:2px 0}
.naavn-paper table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:12px}
.naavn-paper td,.naavn-paper th{border:1px solid #000;padding:4px 6px;vertical-align:middle;word-wrap:break-word;color:#000}
.naavn-paper td.nb{border:0}
.naavn-paper .l{background:#c0c0c0;font-weight:700}
.naavn-paper .gr{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.naavn-paper .h{text-align:center}
.naavn-paper .tt{text-align:center;font-size:18px;font-weight:700}
.naavn-paper input,.naavn-paper textarea,.naavn-paper select{width:100%;border:0;border-radius:0;background:#fff;color:#000;padding:2px;font:inherit;outline:0}
.naavn-paper input:disabled,.naavn-paper textarea:disabled,.naavn-paper select:disabled{opacity:1;-webkit-text-fill-color:#000}
.naavn-paper textarea{height:140px;resize:vertical}
.naavn-paper .pre{white-space:pre-wrap;min-height:60px}
.naavn-paper .hd td{border:0;padding:2px}
.naavn-paper img.logo{width:66px;height:66px;object-fit:contain;display:block;margin:auto}
.naavn-paper .sr th{background:#c0c0c0;font-size:11px;text-align:center;padding:3px}
.naavn-paper .sr td{padding:1px 4px;font-size:12px;height:22px}
.naavn-paper .ap td{border:0;padding:3px 4px}
.naavn-paper .ap td.v{border-bottom:1px solid #000}
.naavn-paper .ap td.k{text-align:right;font-weight:700;width:38%}
.naavn-paper .sig{height:52px;display:flex;align-items:center}
.naavn-paper .sig img{max-height:48px;max-width:100%}
.naavn-paper a.x{color:#b42318;cursor:pointer;font-weight:700;text-decoration:none;margin-left:4px}
@media print{.naavn-paper{border:0;padding:0;max-width:none}.noprint{display:none!important}}
`;

/** Opens just the form in a new window and prints it. Inputs are printed as their values. */
export const printPaper = (element: HTMLElement | null, title: string) => {
  if (!element) return;
  const clone = element.cloneNode(true) as HTMLElement;
  // Carry typed values over (cloneNode keeps attributes, not live values).
  const sources = element.querySelectorAll("input,textarea,select");
  clone.querySelectorAll("input,textarea,select").forEach((node, i) => {
    const src = sources[i] as HTMLInputElement;
    const span = document.createElement("span");
    span.style.whiteSpace = "pre-wrap";
    span.textContent = src.value;
    node.replaceWith(span);
  });
  clone.querySelectorAll(".noprint").forEach((n) => n.remove());
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title><style>${PAPER_CSS} body{margin:16px;background:#fff}</style></head><body>${clone.outerHTML}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
};

export const downloadPaperPdf = async (element: HTMLElement | null, fileName: string) => {
  if (!element) return;

  const clone = element.cloneNode(true) as HTMLElement;
  const sources = element.querySelectorAll("input,textarea,select");
  clone.querySelectorAll("input,textarea,select").forEach((node, i) => {
    const src = sources[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const span = document.createElement("span");
    span.style.whiteSpace = "pre-wrap";
    span.textContent = src.value || " ";
    node.replaceWith(span);
  });
  clone.querySelectorAll(".noprint").forEach((n) => n.remove());

  // Mount in off-screen container so layout, fonts, and fixed width calculate accurately
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "820px";
  container.style.backgroundColor = "#ffffff";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";

  const styleEl = document.createElement("style");
  styleEl.textContent = `${PAPER_CSS} body{background:#fff;color:#000}`;
  container.appendChild(styleEl);
  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    await downloadElementAsPdf({
      element: clone,
      fileName,
      backgroundColor: "#ffffff",
    });
  } finally {
    container.remove();
  }
};
