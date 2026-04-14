type DownloadElementAsPdfParams = {
  element: HTMLElement;
  fileName: string;
  backgroundColor?: string;
};

const isImageOrCorsError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "SecurityError") {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("tainted") ||
    message.includes("cross-origin") ||
    message.includes("securityerror") ||
    message.includes("cors")
  );
};

const isUnsupportedColorFunctionError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("unsupported color function") ||
    message.includes("oklab") ||
    message.includes("oklch")
  );
};

const sanitizeUnsupportedColorFunctions = (cssText: string) =>
  cssText
    .replace(/oklab\([^)]*\)/gi, "rgb(148, 163, 184)")
    .replace(/oklch\([^)]*\)/gi, "rgb(148, 163, 184)");

const inlineComputedStyles = (
  sourceRoot: HTMLElement,
  cloneRoot: HTMLElement,
) => {
  const sourceElements = [
    sourceRoot,
    ...Array.from(sourceRoot.querySelectorAll<HTMLElement>("*")),
  ];
  const cloneElements = [
    cloneRoot,
    ...Array.from(cloneRoot.querySelectorAll<HTMLElement>("*")),
  ];

  const total = Math.min(sourceElements.length, cloneElements.length);

  for (let i = 0; i < total; i += 1) {
    const sourceEl = sourceElements[i];
    const cloneEl = cloneElements[i];
    const computed = window.getComputedStyle(sourceEl);

    for (let index = 0; index < computed.length; index += 1) {
      const property = computed.item(index);
      const value = computed.getPropertyValue(property);
      const priority = computed.getPropertyPriority(property);

      cloneEl.style.setProperty(
        property,
        sanitizeUnsupportedColorFunctions(value),
        priority,
      );
    }
  }
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "details";

export const downloadElementAsPdf = async ({
  element,
  fileName,
  backgroundColor = "#001219",
}: DownloadElementAsPdfParams) => {
  const previousElementId = element.id;
  if (!previousElementId) {
    element.id = "capture-root";
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const captureAsImageData = async (
    ignoreImages: boolean,
    sanitizeColors: boolean,
  ) => {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor,
      onclone: sanitizeColors
        ? (doc) => {
            const clonedRoot = doc.getElementById("capture-root") as
              | HTMLElement
              | null;
            if (clonedRoot) {
              inlineComputedStyles(element, clonedRoot);
            }

            const styleTags = Array.from(doc.querySelectorAll("style"));
            for (const tag of styleTags) {
              if (!tag.textContent) continue;
              tag.textContent = sanitizeUnsupportedColorFunctions(tag.textContent);
            }

            const stylesheetLinks = Array.from(
              doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
            );
            for (const link of stylesheetLinks) {
              link.remove();
            }

            const inlineStyledElements = Array.from(
              doc.querySelectorAll<HTMLElement>("[style]"),
            );
            for (const node of inlineStyledElements) {
              const inlineCss = node.getAttribute("style");
              if (!inlineCss) continue;
              node.setAttribute(
                "style",
                sanitizeUnsupportedColorFunctions(inlineCss),
              );
            }
          }
        : undefined,
      ignoreElements: ignoreImages
        ? (node) => node.nodeName.toUpperCase() === "IMG"
        : undefined,
    });

    return {
      canvas,
      imageData: canvas.toDataURL("image/png"),
    };
  };

  try {
    let rendered: { canvas: HTMLCanvasElement; imageData: string };

    try {
      rendered = await captureAsImageData(false, false);
    } catch (error) {
      console.error("PDF generation failed on first attempt", {
        fileName,
        error,
      });

      if (isUnsupportedColorFunctionError(error)) {
        console.warn(
          "Retrying PDF generation with unsupported color-function sanitization",
          { fileName },
        );
        rendered = await captureAsImageData(false, true);
      } else {
        if (!isImageOrCorsError(error)) {
          throw error;
        }

        console.warn(
          "Retrying PDF generation without <img> elements due to CORS/security constraints",
          { fileName },
        );

        rendered = await captureAsImageData(true, false);
      }
    }

    if (!rendered) {
      rendered = await captureAsImageData(true, true);
    }

    try {
      rendered.imageData = rendered.canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Failed to convert canvas to image data for PDF", {
        fileName,
        error,
      });
      rendered = await captureAsImageData(true, true);
    }

    const { canvas, imageData } = rendered;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${sanitizeFileName(fileName)}.pdf`);
  } finally {
    if (!previousElementId) {
      element.removeAttribute("id");
    }
  }
};