import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, FileText, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [generatingMap, setGeneratingMap] = useState(false);
  const [closetSvg, setClosetSvg] = useState<string | null>(null);
  const [svgLoaded, setSvgLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing SVG on mount
  useState(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("closet_svg")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.closet_svg) {
          setClosetSvg(data.closet_svg);
          setSvgLoaded(true);
        }
      });
  });

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Account deleted. Goodbye!");
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleClosetPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGeneratingMap(true);

    try {
      const normalizedBlob = await normalizeToPng(file);
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(normalizedBlob);
      });

      const { data, error } = await supabase.functions.invoke("generate-wardrobe-svg", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.svg) {
        setClosetSvg(data.svg);
        setSvgLoaded(true);
        toast.success("Wardrobe map generated! ✨");
      } else {
        throw new Error("No SVG returned");
      }
    } catch (err: any) {
      console.error("Wardrobe map error:", err);
      toast.error(err.message || "Failed to generate wardrobe map.");
    } finally {
      setGeneratingMap(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-safe pb-10">
      <div className="max-w-lg mx-auto pt-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl min-w-[44px] min-h-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground font-outfit">Settings</h1>
        </div>

        {/* Wardrobe Map Section */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            AI Wardrobe Map
          </h3>
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {svgLoaded ? "Your Wardrobe Map" : "Setup Wardrobe Map"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {svgLoaded
                    ? "Tap a zone when adding items to remember where you store them."
                    : "Take a photo of your closet and AI will create an interactive map of its compartments."}
                </p>
              </div>
            </div>

            {closetSvg && <WardrobeMap svgString={closetSvg} />}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleClosetPhotoSelect}
            />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={generatingMap}
              className="w-full rounded-xl gap-2"
              variant={svgLoaded ? "outline" : "default"}
            >
              {generatingMap ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing your closet…
                </>
              ) : svgLoaded ? (
                <>
                  <Camera className="w-4 h-4" />
                  Retake Photo
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Take Closet Photo
                </>
              )}
            </Button>
          </GlassCard>
        </div>

        {/* Legal Links */}
        <GlassCard className="p-0 divide-y divide-border">
          <button
            onClick={() => navigate("/legal")}
            className="flex items-center gap-3 p-4 w-full text-left min-h-[52px]"
          >
            <FileText className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Terms of Service</span>
          </button>
          <button
            onClick={() => navigate("/legal?tab=privacy")}
            className="flex items-center gap-3 p-4 w-full text-left min-h-[52px]"
          >
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Privacy Policy</span>
          </button>
        </GlassCard>

        {/* Danger Zone */}
        <div className="pt-4">
          <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-3">
            Danger Zone
          </h3>
          <GlassCard className="p-5 border-destructive/20">
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account, wardrobe, looks, and all associated data. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full rounded-xl gap-2" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-outfit">Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove all your data including your wardrobe, looks, beauty products, and profile. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
