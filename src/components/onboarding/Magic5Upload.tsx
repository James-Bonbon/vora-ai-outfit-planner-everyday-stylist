import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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

interface Magic5UploadProps {
  onAllUploaded: () => void;
  profileData: { username: string; gender: string };
  preferences: { vibe: string[]; fit: string; colors: string };
}

const Magic5Upload = ({ onAllUploaded, profileData, preferences }: Magic5UploadProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [images, setImages] = useState<(File | null)[]>(Array(5).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(Array(5).fill(null));
  const [processing, setProcessing] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
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
    e.target.value = "";
  };

  const handleRemove = (index: number) => {
    setImages((imgs) => { const n = [...imgs]; n[index] = null; return n; });
    setPreviews((p) => { const n = [...p]; n[index] = null; return n; });
  };

  const handleProcess = useCallback(async () => {
    if (!user || !allFilled) return;
    setProcessing(true);
    setProgressCount(0);

    try {
      // Process all 5 images in parallel via the cloud edge function
      const processedResults = await Promise.all(
        images.map(async (file, i) => {
          try {
            // 1. Package as raw FormData (key must be "image_file" to match edge function)
            const formData = new FormData();
            formData.append("image_file", file!, "garment.jpg");

            // 2. Invoke the process-garment edge function
            const { data, error } = await supabase.functions.invoke("process-garment", {
              body: formData,
            });

            if (error) throw error;

            // The edge function returns a raw PNG blob
            const blob = data instanceof Blob ? data : new Blob([data], { type: "image/png" });

            // 3. Upload processed image to Supabase Storage
            const filePath = `${user.id}/onboarding_${Date.now()}_${i}.png`;
            const { error: uploadErr } = await supabase.storage
              .from("garments")
              .upload(filePath, blob, { contentType: "image/png", upsert: true });
            if (uploadErr) throw uploadErr;

            // 4. Get signed URL
            const { data: signedData, error: signedErr } = await supabase.storage
              .from("garments")
              .createSignedUrl(filePath, 60 * 60 * 24 * 365);
            if (signedErr) throw signedErr;

            setProgressCount((c) => c + 1);

            return {
              user_id: user.id,
              image_url: signedData.signedUrl,
              name: SLOTS[i].label,
              category: SLOTS[i].category,
            };
          } catch (err) {
            console.error(`Failed to process ${SLOTS[i].label}:`, err);
            setProgressCount((c) => c + 1);
            return null;
          }
        })
      );

      const successfulPayloads = processedResults.filter(Boolean);

      if (successfulPayloads.length === 0) {
        throw new Error("All items failed to process. Please try again.");
      }

      // 1. Insert the garments (if any were successfully processed)
      if (successfulPayloads.length > 0) {
        const { error: dbError } = await supabase
          .from("closet_items")
          .insert(successfulPayloads as any[]);
        if (dbError) throw dbError;
      }

      // 2. CRITICAL FIX: Commit ALL profile data and finalize onboarding
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          gender: profileData.gender || 'female',
          style_preferences: preferences,
          onboarding_complete: true,
        })
        .eq("user_id", user.id);
      if (profileErr) {
        console.error("Failed to update profile status:", profileErr);
        throw new Error("Failed to finalize onboarding.");
      }

      // 3. UI Feedback
      if (successfulPayloads.length > 0 && successfulPayloads.length < images.length) {
        toast.warning(`Saved ${successfulPayloads.length} items. Some failed to process.`);
      } else {
        toast.success("Magic 5 complete! Welcome to VORA.", { duration: 3000 });
      }

      onAllUploaded();

      // 4. Cache-clearing redirect with delay so toast is readable
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      console.error("Batch processing error:", err);
      toast.error(err?.message || "Failed to save wardrobe. Please try again.");
    } finally {
      setProcessing(false);
      setProgressCount(0);
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
          Cloud AI is removing backgrounds… {progressCount} of 5 done
        </p>
        <div className="flex items-center gap-2 justify-center mt-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Do not close this page.</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${(progressCount / 5) * 100}%` }}
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

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">3 Tops</p>
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.slice(0, 3).map((slot, i) => (
            <SlotCard
              key={i}
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

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">2 Bottoms</p>
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.slice(3).map((slot, i) => {
            const idx = i + 3;
            return (
              <SlotCard
                key={idx}
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

/* ---- Slot Card ---- */

interface SlotCardProps {
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
