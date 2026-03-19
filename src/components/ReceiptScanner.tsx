import { useState, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { toast } from "sonner";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

interface OCRResult {
  amount: number | null;
  merchant: string | null;
  date: string | null;
}

interface Props {
  onResult: (result: OCRResult) => void;
}

const ReceiptScanner = ({ onResult }: Props) => {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setScanning(true);
    setScanned(false);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      // Convert to base64 for Gemini Vision
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(",")[1]); // remove data:image/...;base64, prefix
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: file.type || "image/jpeg",
            data: base64,
          },
        },
        `You are a receipt parser. Extract the total amount, merchant/store name, and date from this receipt image.
Return ONLY a JSON object like: {"amount": 450, "merchant": "Swiggy", "date": "2024-03-15"}
If you can't find a field, use null. Amount should be a number only, no currency symbols.`,
      ]);

      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as OCRResult;
        onResult(parsed);
        setScanned(true);
        toast.success("Receipt scanned! ✓ Amount pre-filled");
      } else {
        throw new Error("Could not parse receipt");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      toast.error("Could not read receipt — please enter manually");
    } finally {
      setScanning(false);
    }
  }, [onResult]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setPreview(null);
    setScanned(false);
  };

  return (
    <div className="relative flex shrink-0">
      {preview ? (
        <div className="relative w-11 h-11">
          <img src={preview} alt="Receipt" className="w-11 h-11 rounded-xl object-cover" />
          {scanning && (
            <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
          {scanned && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </div>
          )}
          {!scanning && (
            <button
              onClick={clear}
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
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <button className="w-11 h-11 rounded-xl bg-muted flex flex-col items-center justify-center gap-0.5 pointer-events-none">
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
          </button>
        </>
      )}
    </div>
  );
};

export default ReceiptScanner;
