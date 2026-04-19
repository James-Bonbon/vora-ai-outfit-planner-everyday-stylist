import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { X, RotateCcw, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cropToBoundingBox } from "@/utils/imageProcessing";
import GlassCard from "@/components/GlassCard";
// Lazy-loaded to avoid WASM pre-bundling timeout
const loadRemoveBackground = () =>
  import("@imgly/background-removal").then((m) => m.removeBackground);

export interface AnalyzedItem {
  imageFile: File;
  preview: string;
  name: string;
  category: string;
  color: string;
  material: string;
  brand: string;
  hasTransparentBg: boolean;
  storage_zone?: string;
}

interface SmartCameraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyzed: (data: AnalyzedItem[]) => void;
}

const SmartCamera = ({ open, onOpenChange, onAnalyzed }: SmartCameraProps) => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, step: "" });
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const { data: accessData } = useQuery({
    queryKey: ['user-access', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("subscription_tier").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle()
      ]);
      return {
        tier: profileRes.data?.subscription_tier || 'free',
        isAdmin: !!roleRes.data
      };
    }
  });

  const hasProAccess = accessData?.tier === 'pro' || accessData?.isAdmin;
  const maxPhotos = (accessData?.tier === 'free' && !accessData?.isAdmin) ? 2 : 20;

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
    if (capturedImages.length >= maxPhotos) {
      toast.info(`Maximum ${maxPhotos} photos reached for your tier.`);
      return;
    }
    const shot = webcamRef.current?.getScreenshot();
    if (shot) setCapturedImages((prev) => [...prev, shot]);
  }, [capturedImages.length, maxPhotos]);

  const handleAnalyze = useCallback(async () => {
    if (capturedImages.length === 0 || !user) return;
    setAnalyzing(true);
    const total = capturedImages.length;
    setProgressInfo({ current: 0, total, step: "" });

    const results: AnalyzedItem[] = [];
    const tempPaths: string[] = [];

    try {
      for (let i = 0; i < capturedImages.length; i++) {
        const raw = capturedImages[i];
        const { blob } = await compressImage(raw);

        // Step 1: Client-side background removal
        setProgressInfo({ current: i + 1, total, step: "Removing background…" });
        let processedBlob: Blob;
        let hasTransparentBg = false;
        try {
          const removeBackground = await loadRemoveBackground();
          const bgRemoved = await removeBackground(blob);
          // Auto-crop transparent padding so garment fills the frame
          processedBlob = await cropToBoundingBox(bgRemoved);
          hasTransparentBg = true;
        } catch (e) {
          console.warn("Background removal failed, using raw image:", e);
          processedBlob = blob;
        }

        // Generate preview from processed blob
        const preview = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target?.result as string);
          reader.readAsDataURL(processedBlob);
        });

        // Step 2: Upload processed image to temp-uploads
        setProgressInfo({ current: i + 1, total, step: "Uploading…" });
        const ext = hasTransparentBg ? "png" : "jpg";
        const contentType = hasTransparentBg ? "image/png" : "image/jpeg";
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("temp-uploads")
          .upload(filePath, processedBlob, { contentType });
        if (uploadErr) throw uploadErr;
        tempPaths.push(filePath);

        const { data: urlData } = supabase.storage
          .from("temp-uploads")
          .getPublicUrl(filePath);

        // Step 3: AI metadata extraction
        setProgressInfo({ current: i + 1, total, step: "AI tagging…" });
        const { data, error } = await supabase.functions.invoke("analyze-garment", {
          body: { imageUrl: urlData.publicUrl },
        });
        if (error) throw error;

        const imageFile = new File([processedBlob], `capture-${i}.${ext}`, { type: contentType });

        results.push({
          imageFile,
          preview,
          name: data?.name || "",
          category: data?.category || "",
          color: data?.color || "",
          material: data?.material || "",
          brand: data?.brand || "",
          hasTransparentBg,
          storage_zone: data?.storage_zone || undefined,
        });
      }

      onAnalyzed(results);
      setCapturedImages([]);
      onOpenChange(false);
      toast.success(`${results.length} item${results.length > 1 ? "s" : ""} analyzed! Review & save below ✨`);
    } catch (err: any) {
      console.error("Bulk analysis error:", err);
      toast.error(err?.message || "Analysis failed. Try again.");
      if (results.length > 0) {
        onAnalyzed(results);
        setCapturedImages([]);
        onOpenChange(false);
        toast.info(`${results.length} of ${total} items analyzed (partial).`);
      }
    } finally {
      if (tempPaths.length > 0) {
        supabase.storage.from("temp-uploads").remove(tempPaths).catch(() => {});
      }
      setAnalyzing(false);
      setProgressInfo({ current: 0, total: 0, step: "" });
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
      <SheetContent side="bottom" className="rounded-t-3xl h-[95vh] p-0 bg-black [&>button.absolute]:hidden">
        <div className="relative w-full h-full flex flex-col">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
            <Button size="icon" variant="ghost" className="text-white bg-black/40 rounded-full h-10 w-10" onClick={handleClose}>
              <X className="w-5 h-5" />
            </Button>
            {capturedImages.length > 0 && !analyzing && (
              <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold">
                {capturedImages.length} / {maxPhotos} items
              </div>
            )}
            {!analyzing && (
              <Button size="icon" variant="ghost" className="text-white bg-black/40 rounded-full h-10 w-10" onClick={() => setFacingMode((m) => m === "user" ? "environment" : "user")}>
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
            {!analyzing && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-6 border-2 border-white/50 rounded-3xl" />
                <div className="absolute top-6 left-6 w-10 h-10 border-t-[3px] border-l-[3px] border-white rounded-tl-3xl" />
                <div className="absolute top-6 right-6 w-10 h-10 border-t-[3px] border-r-[3px] border-white rounded-tr-3xl" />
                <div className="absolute bottom-6 left-6 w-10 h-10 border-b-[3px] border-l-[3px] border-white rounded-bl-3xl" />
                <div className="absolute bottom-6 right-6 w-10 h-10 border-b-[3px] border-r-[3px] border-white rounded-br-3xl" />
                <p className="absolute top-10 left-0 right-0 text-center text-white/80 text-sm font-medium">
                  Align your garment here
                </p>
              </div>
            )}
            {analyzing && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-10 px-8">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <span className="text-white font-medium flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {progressInfo.step || "Processing"} ({progressInfo.current}/{progressInfo.total})
                </span>
                <Progress value={(progressInfo.current / progressInfo.total) * 100} className="w-full max-w-xs h-2 bg-white/20" />
              </div>
            )}
          </div>

          {/* Tier-specific instructional card */}
          {!analyzing && capturedImages.length === 0 && (
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-lg text-card-foreground">
                {hasProAccess ? (
                  <>
                    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-primary">
                      <rect x="2" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="28" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="15" y="28" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Auto-Batch Enabled</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Lay multiple garments flat with clear space between them. Our AI will automatically detect, crop, and save each item individually.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 text-primary">
                      <rect x="10" y="10" width="28" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Single Item Scan</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Center a single garment in the frame. Ensure good lighting and a plain background for the best AI studio flat lay.{" "}
                        <span className="text-primary font-medium">Limit: {maxPhotos} photos per upload.</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="p-5 pb-8 bg-black space-y-3">
            <div className="flex items-center justify-center gap-5">
              <div className="w-12 h-12">
                {lastThumb ? (
                  <img src={lastThumb} alt="Last capture" className="w-12 h-12 rounded-xl object-cover border-2 border-white/40" />
                ) : (
                  <div className="w-12 h-12" />
                )}
              </div>
              <button onClick={handleCapture} disabled={analyzing || capturedImages.length >= maxPhotos} className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40">
                <div className="w-14 h-14 rounded-full bg-white" />
              </button>
              <div className="w-12 h-12" />
            </div>
            {capturedImages.length > 0 && !analyzing && (
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 gap-2" onClick={() => setCapturedImages([])}>
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
                <Button className="flex-1 rounded-xl gap-2" onClick={handleAnalyze}>
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
