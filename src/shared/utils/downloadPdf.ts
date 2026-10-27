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
  backgroundColor = "#ffffff",
}: DownloadElementAsPdfParams) => {
  // html2canvas-pro handles modern color spaces (oklch, color-mix) in Tailwind v4;
  // fall back to standard html2canvas if html2canvas-pro is unavailable.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro" as string).catch(() => import("html2canvas")),
    import("jspdf"),
  ]);

  const captureAsImageData = async (ignoreImages: boolean) => {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor,
      ignoreElements: ignoreImages
        ? (node: Element) => node.nodeName.toUpperCase() === "IMG"
        : undefined,
    });

    return {
      canvas,
      imageData: canvas.toDataURL("image/png"),
    };
  };

  let rendered: { canvas: HTMLCanvasElement; imageData: string };

  try {
    rendered = await captureAsImageData(false);
  } catch (error) {
    if (isImageOrCorsError(error)) {
      console.warn("Retrying PDF generation without <img> elements due to CORS/rendering constraints", {
        fileName,
        error,
      });
      rendered = await captureAsImageData(true);
    } else {
      throw error;
    }
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
};
