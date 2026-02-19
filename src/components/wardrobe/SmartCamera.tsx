import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SmartCameraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyzed: (data: {
    imageFile: File;
    preview: string;
    name: string;
    category: string;
    color: string;
    material: string;
    brand: string;
  }) => void;
}

const FRAME_SIZE = 280;

const SmartCamera = ({ open, onOpenChange, onAnalyzed }: SmartCameraProps) => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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
    const shot = webcamRef.current?.getScreenshot();
    if (shot) setCaptured(shot);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!captured || !user) return;
    setAnalyzing(true);

    try {
      const { blob, preview } = await compressImage(captured);
      const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;

      // Upload to temp bucket
      const { error: uploadErr } = await supabase.storage
        .from("temp-uploads")
        .upload(filePath, blob, { contentType: "image/jpeg" });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("temp-uploads")
        .getPublicUrl(filePath);

      // Call analyze edge function
      const { data, error } = await supabase.functions.invoke("analyze-garment", {
        body: { imageUrl: urlData.publicUrl },
      });
      if (error) throw error;

      // Convert blob to File for AddItemSheet
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

      onAnalyzed({
        imageFile: file,
        preview,
        name: data?.name || "",
        category: data?.category || "",
        color: data?.color || "",
        material: data?.material || "",
        brand: data?.brand || "",
      });

      // Cleanup temp file
      supabase.storage.from("temp-uploads").remove([filePath]).catch(() => {});

      setCaptured(null);
      onOpenChange(false);
      toast.success("Garment analyzed! Review & save below ✨");
    } catch (err: any) {
      console.error("Smart camera error:", err);
      toast.error(err?.message || "Analysis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [captured, user, compressImage, onAnalyzed, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!analyzing) { onOpenChange(v); setCaptured(null); } }}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[95vh] p-0 bg-black">
        <div className="relative w-full h-full flex flex-col">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
            <Button
              size="icon"
              variant="ghost"
              className="text-white bg-black/40 rounded-full h-10 w-10"
              onClick={() => { onOpenChange(false); setCaptured(null); }}
            >
              <X className="w-5 h-5" />
            </Button>
            {!captured && (
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

          {/* Camera / Preview */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center">
            {captured ? (
              <img src={captured} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <>
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
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="border-2 border-white/70 rounded-3xl"
                    style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
                  />
                </div>
                <p className="absolute bottom-28 left-0 right-0 text-center text-white/80 text-sm font-medium">
                  Align your garment here
                </p>
              </>
            )}

            {analyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <span className="text-white font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" /> Analyzing garment...
                </span>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="p-6 pb-8 flex items-center justify-center gap-6 bg-black">
            {captured ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl border-white/30 text-white bg-white/10"
                  onClick={() => setCaptured(null)}
                  disabled={analyzing}
                >
                  Retake
                </Button>
                <Button
                  className="rounded-xl gap-2 px-8"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? "Analyzing..." : "Analyze"}
                  <Sparkles className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <button
                onClick={handleCapture}
                className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center"
              >
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SmartCamera;
