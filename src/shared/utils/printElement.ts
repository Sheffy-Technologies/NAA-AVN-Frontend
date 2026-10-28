/**
 * Utility to print any DOM element in an isolated print window.
 * Ensures complete styling isolation from the application (e.g. sidebar,
 * dark theme, modals) and triggers browser print dialog immediately.
 */
export const printElement = (
  element: HTMLElement | null,
  documentTitle: string,
  extraCss?: string,
) => {
  if (!element) return;

  const clone = element.cloneNode(true) as HTMLElement;

  // Carry over live input/textarea/select values if any exist
  const originalSources = element.querySelectorAll("input, textarea, select");
  clone.querySelectorAll("input, textarea, select").forEach((node, idx) => {
    const src = originalSources[idx] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (src) {
      const span = document.createElement("span");
      span.style.whiteSpace = "pre-wrap";
      span.textContent = src.value || " ";
      node.replaceWith(span);
    }
  });

  // Strip elements marked .noprint
  clone.querySelectorAll(".noprint").forEach((node) => node.remove());

  // Ensure element is visible in the clone even if hidden in origin DOM
  clone.style.display = "block";
  clone.style.visibility = "visible";
  clone.style.position = "static";
  clone.style.opacity = "1";
  clone.style.margin = "0 auto";

  // Collect stylesheet tags from the document
  let collectedStyles = "";
  document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
    collectedStyles += node.outerHTML + "\n";
  });

  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    // Fallback if popup blocker intervenes
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${documentTitle.replace(/</g, "&lt;")}</title>
        ${collectedStyles}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          *, *::before, *::after {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 16px;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-wrapper {
            width: 100%;
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            color: #000000;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .noprint {
              display: none !important;
            }
          }
          ${extraCss || ""}
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${clone.outerHTML}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  // Allow styles, fonts, and inline images to paint before printing
  setTimeout(() => {
    printWindow.print();
  }, 350);
};
