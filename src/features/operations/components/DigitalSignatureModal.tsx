import { useState, useRef, useEffect, type MouseEvent, type TouchEvent } from "react";
import { Icon } from "@iconify/react";

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signatureDataUrl: string) => Promise<void> | void;
  appointment: "Commanding officer" | "Pilot in Command" | "CO Pilot" | string;
  signerName?: string;
  signerRank?: string;
  signerServiceNumber?: string;
  operationName?: string;
  isSubmitting?: boolean;
}

export const DigitalSignatureModal = ({
  isOpen,
  onClose,
  onConfirm,
  appointment,
  signerName,
  signerRank,
  signerServiceNumber,
  operationName,
  isSubmitting = false,
}: DigitalSignatureModalProps) => {
  const [tab, setTab] = useState<"draw" | "type" | "upload">("draw");
  const [typedName, setTypedName] = useState(signerName || "");
  const [fontStyle, setFontStyle] = useState<"font1" | "font2" | "font3">("font1");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  // Setup canvas
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI scaling
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width || 500) * dpr;
    canvas.height = (rect.height || 180) * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width || 500, rect.height || 180);
    setHasDrawn(false);
  };

  useEffect(() => {
    if (isOpen && tab === "draw") {
      setTimeout(() => {
        initCanvas();
      }, 50);
    }
  }, [isOpen, tab]);

  if (!isOpen) return null;

  // Drawing event handlers
  const startDrawing = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    isDrawing.current = true;
    lastX.current = clientX - rect.left;
    lastY.current = clientY - rect.top;
  };

  const draw = (clientX: number, clientY: number) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX.current = currentX;
    lastY.current = currentY;
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    startDrawing(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    draw(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      startDrawing(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      e.preventDefault();
      draw(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const clearCanvas = () => {
    initCanvas();
  };

  // Convert typed name to canvas data URL
  const generateTypedSignatureDataUrl = (): string => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 500;
    tempCanvas.height = 180;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    ctx.fillStyle = "#000000";
    const fontFam =
      fontStyle === "font1"
        ? "'Brush Script MT', 'Segoe Script', cursive"
        : fontStyle === "font2"
        ? "'Lucida Handwriting', 'Caveat', cursive"
        : "'Great Vibes', 'Allura', cursive";
    ctx.font = `italic 42px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName || signerName || "Signature", 250, 90);

    return tempCanvas.toDataURL("image/png");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    let finalSignatureUrl = "";

    if (tab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) return;
      finalSignatureUrl = canvas.toDataURL("image/png");
    } else if (tab === "type") {
      if (!typedName.trim()) return;
      finalSignatureUrl = generateTypedSignatureDataUrl();
    } else if (tab === "upload") {
      if (!uploadedImage) return;
      finalSignatureUrl = uploadedImage;
    }

    if (!finalSignatureUrl) return;
    await onConfirm(finalSignatureUrl);
  };

  const canSubmit =
    (tab === "draw" && hasDrawn) ||
    (tab === "type" && Boolean(typedName.trim())) ||
    (tab === "upload" && Boolean(uploadedImage));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#001825] border border-[#0A4D66] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-[#001219] border-b border-[#0A4D66]/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#0A4D66]/30 text-[#7FD5FF]">
                <Icon icon="mdi:draw-pen" className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Digital Sign-Off
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Sign as <span className="text-[#7FD5FF] font-semibold">{appointment}</span>
              {operationName ? ` for ${operationName}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <Icon icon="mdi:close" className="w-5 h-5" />
          </button>
        </div>

        {/* Signer Info Summary Banner */}
        <div className="bg-[#002433] px-6 py-3 border-b border-[#0A4D66]/30 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">
              Signer Name
            </span>
            <span className="text-gray-200 font-medium truncate block">
              {signerName || "Authorized Signer"}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">
              Rank
            </span>
            <span className="text-gray-200 font-medium truncate block">
              {signerRank || "Officer"}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">
              Service Number
            </span>
            <span className="text-gray-200 font-mono font-medium truncate block">
              {signerServiceNumber || "-"}
            </span>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-[#0A4D66]/40 bg-[#001219]">
          <button
            type="button"
            onClick={() => setTab("draw")}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === "draw"
                ? "text-[#7FD5FF] border-b-2 border-[#7FD5FF] bg-[#001825]"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon icon="mdi:gesture" className="w-4 h-4" />
            Draw Signature
          </button>
          <button
            type="button"
            onClick={() => setTab("type")}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === "type"
                ? "text-[#7FD5FF] border-b-2 border-[#7FD5FF] bg-[#001825]"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon icon="mdi:format-font" className="w-4 h-4" />
            Type Name
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              tab === "upload"
                ? "text-[#7FD5FF] border-b-2 border-[#7FD5FF] bg-[#001825]"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon icon="mdi:upload" className="w-4 h-4" />
            Upload Image
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {tab === "draw" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Draw your signature using mouse or finger/stylus on the pad below:
                </span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium"
                >
                  <Icon icon="mdi:refresh" className="w-3.5 h-3.5" />
                  Clear Pad
                </button>
              </div>

              <div className="border-2 border-dashed border-[#0A4D66]/80 rounded-xl overflow-hidden bg-white shadow-inner relative">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-gray-400 text-sm italic select-none">
                    Sign on the line above
                  </div>
                )}
                <div className="absolute bottom-6 left-6 right-6 border-b border-gray-300 pointer-events-none" />
              </div>
            </div>
          )}

          {tab === "type" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">
                  Type Your Name for Stylized Signature
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. Major J. Doe"
                  className="w-full bg-[#001219] border border-[#0A4D66]/60 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7FD5FF]"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium block mb-2">
                  Choose Script Style
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["font1", "font2", "font3"] as const).map((style, idx) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setFontStyle(style)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        fontStyle === style
                          ? "border-[#7FD5FF] bg-[#0A4D66]/20 text-[#7FD5FF]"
                          : "border-[#0A4D66]/40 bg-[#001219] text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <span className="text-xs block text-gray-400 mb-1">Style {idx + 1}</span>
                      <span
                        className="text-lg italic truncate block"
                        style={{
                          fontFamily:
                            style === "font1"
                              ? "'Brush Script MT', cursive"
                              : style === "font2"
                              ? "'Lucida Handwriting', cursive"
                              : "'Great Vibes', cursive",
                        }}
                      >
                        {typedName || "Sign"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="border border-[#0A4D66]/60 rounded-xl p-4 bg-white text-black text-center shadow-inner">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1">
                  Generated Signature Preview
                </span>
                <div
                  className="text-3xl italic py-4 select-none"
                  style={{
                    fontFamily:
                      fontStyle === "font1"
                        ? "'Brush Script MT', cursive"
                        : fontStyle === "font2"
                        ? "'Lucida Handwriting', cursive"
                        : "'Great Vibes', cursive",
                  }}
                >
                  {typedName || "Sign Here"}
                </div>
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-4">
              <label className="text-xs text-gray-400 font-medium block">
                Upload Scanned Signature (PNG/JPEG)
              </label>

              <label className="border-2 border-dashed border-[#0A4D66]/80 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#7FD5FF] transition-colors bg-[#001219]">
                <Icon icon="mdi:cloud-upload-outline" className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm font-semibold text-gray-200">
                  Click to select signature file
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Supports PNG, JPG (Transparent or white background recommended)
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {uploadedImage && (
                <div className="border border-[#0A4D66]/60 rounded-xl p-4 bg-white flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold mb-2">
                    Signature Preview
                  </span>
                  <img
                    src={uploadedImage}
                    alt="Uploaded Signature"
                    className="max-h-24 max-w-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Legal / Military endorsement disclaimer */}
          <div className="mt-5 p-3 rounded-xl bg-[#001219]/70 border border-[#0A4D66]/30 flex items-start gap-2.5 text-xs text-gray-400">
            <Icon icon="mdi:shield-check-outline" className="w-5 h-5 text-[#7FD5FF] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-300">Military Document Endorsement:</span> By
              clicking "Affix Signature", I certify that I am the authorized{" "}
              <span className="text-[#7FD5FF] font-medium">{appointment}</span> and that this After
              Action Report has been verified in compliance with official flight operational directives.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#001219] border-t border-[#0A4D66]/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:text-white bg-[#001825] border border-[#0A4D66]/40 hover:bg-[#0A4D66]/30 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-[#0A4D66] hover:bg-[#083c50] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            {isSubmitting ? (
              <>
                <Icon icon="mdi:loading" className="w-4 h-4 animate-spin" />
                <span>Submitting Signature...</span>
              </>
            ) : (
              <>
                <Icon icon="mdi:draw" className="w-4 h-4" />
                <span>Affix Signature</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
