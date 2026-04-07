import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { removeBackground } from "@imgly/background-removal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, X, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";

interface SlotDef {
  label: string;
  category: string;
}

const SLOTS: SlotDef[] = [
  { label: "Top 1", category: "Tops" },
  { label: "Top 2", category: "Tops" },
  { label: "Top 3", category: "Tops" },
  { label: "Bottom 1", category: "Bottoms" },
  { label: "Bottom 2", category: "Bottoms" },
];

const STUDIO_BG = "#E5E5E5";
const CANVAS_SIZE = 1024;

function drawOnStudioCanvas(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d")!;

      // Fill studio backdrop
      ctx.fillStyle = STUDIO_BG;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Fit image centered with padding
      const pad = 40;
      const maxW = CANVAS_SIZE - pad * 2;
      const maxH = CANVAS_SIZE - pad * 2;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (CANVAS_SIZE - w) / 2;
      const y = (CANVAS_SIZE - h) / 2;

      ctx.drawImage(img, x, y, w, h);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Canvas export failed"))),
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load processed image"));
    };
    img.src = url;
  });
}

interface Magic5UploadProps {
  onAllUploaded: () => void;
}

const Magic5Upload = ({ onAllUploaded }: Magic5UploadProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [images, setImages] = useState<(File | null)[]>(Array(5).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(Array(5).fill(null));
  const [processing, setProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(-1);
  const [processingTotal, setProcessingTotal] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const allFilled = images.every(Boolean);

  const handlePick = (index: number) => {
    inputRefs.current[index]?.click();
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreviews((p) => { const n = [...p]; n[index] = ev.target?.result as string; return n; });
    };
    reader.readAsDataURL(file);
    setImages((imgs) => { const n = [...imgs]; n[index] = file; return n; });
    // Reset the input so re-selecting the same file works
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    setImages((imgs) => { const n = [...imgs]; n[index] = null; return n; });
    setPreviews((p) => { const n = [...p]; n[index] = null; return n; });
  };

  const handleProcess = useCallback(async () => {
    if (!user || !allFilled) return;
    setProcessing(true);
    setProcessingTotal(5);

    try {
      const uploadedIds: string[] = [];

      // Sequential processing — one at a time to avoid OOM
      for (let i = 0; i < 5; i++) {
        setProcessingIndex(i);
        const file = images[i]!;

        // 1. Remove background
        const removedBlob = await removeBackground(file, {
          output: { format: "image/png" as any },
        });

        // 2. Draw onto studio canvas
        const studioBlob = await drawOnStudioCanvas(removedBlob);

        // 3. Upload to Supabase Storage
        const filePath = `${user.id}/onboarding_${Date.now()}_${i}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from("garments")
          .upload(filePath, studioBlob, { contentType: "image/jpeg", upsert: true });
        if (uploadErr) throw uploadErr;

        // 4. Get signed URL (private bucket)
        const { data: signedData, error: signedErr } = await supabase.storage
          .from("garments")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);
        if (signedErr) throw signedErr;

        const imageUrl = signedData.signedUrl;

        // 5. Insert into closet_items
        const { data: inserted, error: insertErr } = await supabase
          .from("closet_items")
          .insert({
            user_id: user.id,
            image_url: imageUrl,
            category: SLOTS[i].category,
            name: SLOTS[i].label,
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        uploadedIds.push(inserted.id);
      }

      // 6. Mark onboarding complete
      setProcessingIndex(-1);
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ onboarding_complete: true })
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      // 7. Invalidate caches
      await queryClient.refetchQueries({ queryKey: ["profile"] });
      await queryClient.refetchQueries({ queryKey: ["profile-data"] });
      await queryClient.invalidateQueries({ queryKey: ["closet"] });

      toast.success("Your Magic 5 are ready! 🎉");
      onAllUploaded();
      navigate("/wardrobe", { replace: true });
    } catch (err: any) {
      console.error("Magic 5 processing error:", err);
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
      setProcessingIndex(-1);
    }
  }, [user, images, allFilled, navigate, queryClient, onAllUploaded]);

  if (processing) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-foreground font-outfit">Processing Your Wardrobe</h2>
        <p className="text-sm text-muted-foreground">
          {processingIndex >= 0
            ? `Removing background — item ${processingIndex + 1} of ${processingTotal}…`
            : "Saving your profile…"}
        </p>
        <div className="flex items-center gap-2 justify-center mt-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Do not close this page.</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${((processingIndex + 1) / processingTotal) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">The Magic 5</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload 5 garment photos. We'll remove the background automatically.
        </p>
      </div>

      {/* Tops */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">3 Tops</p>
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.slice(0, 3).map((slot, i) => (
            <SlotCard
              key={i}
              index={i}
              label={slot.label}
              preview={previews[i]}
              onPick={() => handlePick(i)}
              onRemove={() => handleRemove(i)}
              inputRef={(el) => { inputRefs.current[i] = el; }}
              onFileChange={(e) => handleFileChange(i, e)}
            />
          ))}
        </div>
      </div>

      {/* Bottoms */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">2 Bottoms</p>
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.slice(3).map((slot, i) => {
            const idx = i + 3;
            return (
              <SlotCard
                key={idx}
                index={idx}
                label={slot.label}
                preview={previews[idx]}
                onPick={() => handlePick(idx)}
                onRemove={() => handleRemove(idx)}
                inputRef={(el) => { inputRefs.current[idx] = el; }}
                onFileChange={(e) => handleFileChange(idx, e)}
              />
            );
          })}
        </div>
      </div>

      <Button onClick={handleProcess} disabled={!allFilled} className="w-full rounded-xl">
        {allFilled ? "Process & Save My Wardrobe ✨" : `${images.filter(Boolean).length} / 5 selected`}
      </Button>
    </div>
  );
};

/* ---- Slot Card sub-component ---- */

interface SlotCardProps {
  index: number;
  label: string;
  preview: string | null;
  onPick: () => void;
  onRemove: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SlotCard = ({ label, preview, onPick, onRemove, inputRef, onFileChange }: SlotCardProps) => (
  <GlassCard className="aspect-square flex items-center justify-center relative overflow-hidden cursor-pointer" onClick={!preview ? onPick : undefined}>
    {preview ? (
      <>
        <img src={preview} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center z-10"
        >
          <X className="w-3.5 h-3.5 text-foreground" />
        </button>
      </>
    ) : (
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <Plus className="w-6 h-6" />
        <span className="text-[10px]">{label}</span>
      </div>
    )}
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={onFileChange}
    />
  </GlassCard>
);

export default Magic5Upload;
