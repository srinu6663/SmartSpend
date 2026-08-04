import { useState, useCallback, useRef } from "react";
import { Camera, X, Loader2, CheckCircle2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { compressImage, scanReceipt, AIError, type ReceiptScan } from "@/lib/ai";

interface Props {
  /** Receives the extracted fields plus the compressed image to upload. */
  onResult: (result: ReceiptScan, image: Blob) => void;
}

/** Below this the extraction is shown as "check this" rather than confirmed. */
const LOW_CONFIDENCE = 0.5;

const ReceiptScanner = ({ onResult }: Props) => {
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ReceiptScan | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);

  const releasePreview = () => {
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current); // object URLs leak until revoked
      previewUrl.current = null;
    }
  };

  const handleFile = useCallback(
    async (file: File) => {
      setScanning(true);
      setScan(null);

      try {
        // Downscale first: it speeds up the upload, cuts model cost, and the
        // same compressed blob is what gets stored as the receipt.
        const { base64, mimeType, blob } = await compressImage(file);

        releasePreview();
        previewUrl.current = URL.createObjectURL(blob);
        setPreview(previewUrl.current);

        const result = await scanReceipt(base64, mimeType);
        setScan(result);
        onResult(result, blob);

        if (result.amount === null) {
          toast.warning("Couldn't read the total — please type the amount.");
        } else if (result.confidence < LOW_CONFIDENCE) {
          toast.warning(`Read ₹${result.amount.toLocaleString("en-IN")}, but I'm unsure — please check.`);
        } else {
          const parts = [`₹${result.amount.toLocaleString("en-IN")}`];
          if (result.merchant) parts.push(result.merchant);
          toast.success(`Scanned: ${parts.join(" · ")}`);
        }
      } catch (err) {
        console.error("Receipt scan failed:", err);
        toast.error(
          err instanceof AIError ? err.message : "Could not read the receipt — please enter it manually."
        );
        releasePreview();
        setPreview(null);
      } finally {
        setScanning(false);
      }
    },
    [onResult]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ""; // allow re-picking the same file
  };

  const clear = () => {
    releasePreview();
    setPreview(null);
    setScan(null);
  };

  const lowConfidence = scan !== null && (scan.amount === null || scan.confidence < LOW_CONFIDENCE);

  return (
    <div className="relative flex shrink-0">
      {preview ? (
        <div className="relative w-11 h-11">
          <img src={preview} alt="Receipt preview" className="w-11 h-11 rounded-xl object-cover" />

          {scanning && (
            <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}

          {!scanning && scan && (
            <div
              className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center ${
                lowConfidence ? "bg-warning" : "bg-success"
              }`}
              title={lowConfidence ? "Low confidence — please check the amount" : "Scanned"}
            >
              {lowConfidence ? (
                <AlertTriangle className="w-2.5 h-2.5 text-white" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-white" />
              )}
            </div>
          )}

          {!scanning && (
            <button
              type="button"
              onClick={clear}
              aria-label="Remove receipt"
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          )}
        </div>
      ) : (
        <>
          <input
            type="file"
            accept="image/*"
            onChange={handleChange}
            disabled={scanning}
            aria-label="Scan a receipt with AI"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-wait"
          />
          <div className="w-11 h-11 rounded-xl bg-muted flex flex-col items-center justify-center gap-0.5 pointer-events-none">
            {scanning ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <>
                <Camera className="w-4 h-4 text-muted-foreground" />
                <span className="text-[8px] font-bold text-muted-foreground/70 flex items-center gap-0.5">
                  <Sparkles className="w-2 h-2" /> AI
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReceiptScanner;
