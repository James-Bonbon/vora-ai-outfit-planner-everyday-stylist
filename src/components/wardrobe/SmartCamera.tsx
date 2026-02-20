import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AnalyzedItem {
  imageFile: File;
  preview: string;
  name: string;
  category: string;
  color: string;
  material: string;
  brand: string;
  /** Public URL of the studio-processed image (background removed). Null if Photoroom was skipped. */
  processedImageUrl: string | null;
}

interface SmartCameraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyzed: (data: AnalyzedItem[]) => void;
}

const MAX_ITEMS = 20;

const SmartCamera = ({ open, onOpenChange, onAnalyzed }: SmartCameraProps) => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const compressImage = useCallback((dataUrl: string): Promise<{ blob: Blob; preview: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 512;
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round((h * max) / w); w = max; }
        else { w = Math.round((w * max) / h); h = max; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const preview = canvas.toDataURL("image/jpeg", 0.7);
        canvas.toBlob((blob) => resolve({ blob: blob!, preview }), "image/jpeg", 0.7);
      };
      img.src = dataUrl;
    });
  }, []);

  const handleCapture = useCallback(() => {
    if (capturedImages.length >= MAX_ITEMS) {
      toast.info(`Maximum ${MAX_ITEMS} items reached`);
      return;
    }
    const shot = webcamRef.current?.getScreenshot();
    if (shot) setCapturedImages((prev) => [...prev, shot]);
  }, [capturedImages.length]);

  const handleAnalyze = useCallback(async () => {
    if (capturedImages.length === 0 || !user) return;
    setAnalyzing(true);
    const total = capturedImages.length;
    setProgress({ current: 0, total });

    const results: AnalyzedItem[] = [];
    const tempPaths: string[] = [];

    try {
      for (let i = 0; i < capturedImages.length; i++) {
        setProgress({ current: i + 1, total });
        const raw = capturedImages[i];
        const { blob, preview } = await compressImage(raw);
        const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from("temp-uploads")
          .upload(filePath, blob, { contentType: "image/jpeg" });
        if (uploadErr) throw uploadErr;
        tempPaths.push(filePath);

        const { data: urlData } = supabase.storage
          .from("temp-uploads")
          .getPublicUrl(filePath);

        const { data, error } = await supabase.functions.invoke("analyze-garment", {
          body: { imageUrl: urlData.publicUrl },
        });
        if (error) throw error;

        // If Photoroom returned a studio-processed image, use that as the final file/preview
        let imageFile: File;
        let finalPreview: string;

        if (data?.processedImageUrl) {
          try {
            const processedResp = await fetch(data.processedImageUrl);
            if (processedResp.ok) {
              const processedBlob = await processedResp.blob();
              imageFile = new File([processedBlob], `capture-${i}-studio.jpg`, { type: "image/jpeg" });
              // Generate a local data-URL preview from the processed blob
              finalPreview = await new Promise<string>((res) => {
                const reader = new FileReader();
                reader.onload = (e) => res(e.target?.result as string);
                reader.readAsDataURL(processedBlob);
              });
            } else {
              throw new Error("Processed image fetch failed");
            }
          } catch {
            // Fallback: use the raw captured blob
            imageFile = new File([blob], `capture-${i}.jpg`, { type: "image/jpeg" });
            finalPreview = preview;
          }
        } else {
          imageFile = new File([blob], `capture-${i}.jpg`, { type: "image/jpeg" });
          finalPreview = preview;
        }

        results.push({
          imageFile,
          preview: finalPreview,
          name: data?.name || "",
          category: data?.category || "",
          color: data?.color || "",
          material: data?.material || "",
          brand: data?.brand || "",
          processedImageUrl: data?.processedImageUrl ?? null,
        });
      }

      onAnalyzed(results);
      setCapturedImages([]);
      onOpenChange(false);
      toast.success(`${results.length} item${results.length > 1 ? "s" : ""} analyzed! Review & save below ✨`);
    } catch (err: any) {
      console.error("Bulk analysis error:", err);
      toast.error(err?.message || "Analysis failed. Try again.");
      // Still return partial results if any
      if (results.length > 0) {
        onAnalyzed(results);
        setCapturedImages([]);
        onOpenChange(false);
        toast.info(`${results.length} of ${total} items analyzed (partial).`);
      }
    } finally {
      // Cleanup temp files
      if (tempPaths.length > 0) {
        supabase.storage.from("temp-uploads").remove(tempPaths).catch(() => {});
      }
      setAnalyzing(false);
      setProgress({ current: 0, total: 0 });
    }
  }, [capturedImages, user, compressImage, onAnalyzed, onOpenChange]);

  const handleClose = () => {
    if (!analyzing) {
      onOpenChange(false);
      setCapturedImages([]);
    }
  };

  const lastThumb = capturedImages.length > 0 ? capturedImages[capturedImages.length - 1] : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!analyzing) { onOpenChange(v); if (!v) setCapturedImages([]); } }}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[95vh] p-0 bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
            <Button
              size="icon"
              variant="ghost"
              className="text-white bg-black/40 rounded-full h-10 w-10"
              onClick={handleClose}
            >
              <X className="w-5 h-5" />
            </Button>

            {/* Counter badge */}
            {capturedImages.length > 0 && !analyzing && (
              <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold">
                {capturedImages.length} / {MAX_ITEMS} items
              </div>
            )}

            {!analyzing && (
              <Button
                size="icon"
                variant="ghost"
                className="text-white bg-black/40 rounded-full h-10 w-10"
                onClick={() => setFacingMode((m) => m === "user" ? "environment" : "user")}
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Camera feed */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode, width: 1280, height: 1280 }}
              className="w-full h-full object-cover"
              onUserMediaError={() => {
                toast.error("Camera access denied. Use the file picker instead.");
                onOpenChange(false);
              }}
            />

            {/* Full-screen viewfinder overlay */}
            {!analyzing && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Viewfinder border — responsive with padding from edges */}
                <div className="absolute inset-6 border-2 border-white/50 rounded-3xl" />
                {/* Corner accents */}
                <div className="absolute top-6 left-6 w-10 h-10 border-t-[3px] border-l-[3px] border-white rounded-tl-3xl" />
                <div className="absolute top-6 right-6 w-10 h-10 border-t-[3px] border-r-[3px] border-white rounded-tr-3xl" />
                <div className="absolute bottom-6 left-6 w-10 h-10 border-b-[3px] border-l-[3px] border-white rounded-bl-3xl" />
                <div className="absolute bottom-6 right-6 w-10 h-10 border-b-[3px] border-r-[3px] border-white rounded-br-3xl" />
                <p className="absolute top-10 left-0 right-0 text-center text-white/80 text-sm font-medium">
                  Align your garment here
                </p>
              </div>
            )}

            {/* Progress overlay */}
            {analyzing && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-10 px-8">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <span className="text-white font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Analyzing {progress.current} of {progress.total}...
                </span>
                <Progress
                  value={(progress.current / progress.total) * 100}
                  className="w-full max-w-xs h-2 bg-white/20"
                />
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="p-5 pb-8 bg-black space-y-3">
            {/* Shutter row */}
            <div className="flex items-center justify-center gap-5">
              {/* Last thumbnail */}
              <div className="w-12 h-12">
                {lastThumb ? (
                  <img src={lastThumb} alt="Last capture" className="w-12 h-12 rounded-xl object-cover border-2 border-white/40" />
                ) : (
                  <div className="w-12 h-12" />
                )}
              </div>

              {/* Shutter */}
              <button
                onClick={handleCapture}
                disabled={analyzing || capturedImages.length >= MAX_ITEMS}
                className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>

              {/* Spacer to balance */}
              <div className="w-12 h-12" />
            </div>

            {/* Action buttons */}
            {capturedImages.length > 0 && !analyzing && (
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 gap-2"
                  onClick={() => setCapturedImages([])}
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
                <Button
                  className="flex-1 rounded-xl gap-2"
                  onClick={handleAnalyze}
                >
                  <Sparkles className="w-4 h-4" />
                  Analyze ({capturedImages.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SmartCamera;
