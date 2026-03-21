import { useState } from "react";
import SafeImage from "@/components/ui/SafeImage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GlassCard from "@/components/GlassCard";
import { User, Settings, Crown, LogOut, Pencil, X, Check, Ruler, Weight, Calendar, Users, Camera, Database, Loader2, Lock, Palette, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { applyTheme } from "@/components/ThemeProvider";
import { BODY_SHAPES, toDbValue, toDisplayLabel } from "@/constants/bodyShapes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AvatarCropperModal } from "@/components/AvatarCropperModal";

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  selfie_url: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_shape: string | null;
  subscription_tier: string | null;
  app_theme: string | null;
}


const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user!.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle(),
      ]);

      // Backward compatibility: expand legacy relative paths to full public URLs
      let finalSelfieUrl = profileRes.data?.selfie_url || null;
      if (finalSelfieUrl && !finalSelfieUrl.startsWith("http")) {
        finalSelfieUrl = supabase.storage.from("selfies").getPublicUrl(finalSelfieUrl).data.publicUrl;
      }

      const profileWithResolvedUrl = { ...profileRes.data, selfie_url: finalSelfieUrl } as ProfileData;

      return {
        profile: profileWithResolvedUrl,
        isAdmin: !!roleRes.data,
      };
    }
  });

  const profile = profileData?.profile || null;
  const isAdmin = profileData?.isAdmin || false;

  const [editing, setEditing] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editSex, setEditSex] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBodyShape, setEditBodyShape] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const startEditing = () => {
    setEditName(profile?.display_name || "");
    setEditDob(profile?.date_of_birth || "");
    setEditSex(profile?.sex || "");
    setEditHeight(profile?.height_cm?.toString() || "");
    setEditWeight(profile?.weight_kg?.toString() || "");
    setEditBodyShape(profile?.body_shape || "");
    setEditing(true);
  };

  const [editSelfieFile, setEditSelfieFile] = useState<File | null>(null);
  const [editSelfiePreview, setEditSelfiePreview] = useState<string | null>(null);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setRawImageSrc(ev.target?.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File, previewUrl: string) => {
    setEditSelfieFile(croppedFile);
    setEditSelfiePreview(previewUrl);
  };

  const handleSave = async () => {
    if (!user || !editName.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      let selfiePublicUrl = profile?.selfie_url ?? null;

      if (editSelfieFile) {
        const fileExt = editSelfieFile.name.split(".").pop();
        const filePath = `${user.id}/selfie_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("selfies")
          .upload(filePath, editSelfieFile);
        if (uploadError) throw uploadError;

        // Clean up old storage file if it was a path (not a full URL)
        if (profile?.selfie_url && !profile.selfie_url.startsWith("http")) {
          await supabase.storage.from("selfies").remove([profile.selfie_url]);
        }

        // Get permanent public URL
        const { data: publicUrlData } = supabase.storage
          .from("selfies")
          .getPublicUrl(filePath);
        selfiePublicUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: editName.trim(),
          date_of_birth: editDob || null,
          sex: editSex || null,
          height_cm: editHeight ? Number(editHeight) : null,
          weight_kg: editWeight ? Number(editWeight) : null,
          selfie_url: selfiePublicUrl,
          body_shape: editBodyShape || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-data'] });
      queryClient.invalidateQueries({ queryKey: ['selfie-url'] });
      setEditing(false);
      setEditSelfieFile(null);
      setEditSelfiePreview(null);
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "VORA User";
  const avatarUrl = profile?.selfie_url || profile?.avatar_url || user?.user_metadata?.avatar_url;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="pt-6 space-y-5">
      <div className="flex items-center justify-between h-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground font-outfit">Profile</h1>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={startEditing} className="text-primary">
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              <X className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl">
              <Check className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
        )}
      </div>

      {/* Avatar + Name */}
      <GlassCard className="flex items-center gap-4 p-5">
        <div className="relative">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarImage src={(editing && editSelfiePreview) ? editSelfiePreview : avatarUrl || undefined} />
            <AvatarFallback className="bg-secondary">
              <User className="w-8 h-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          {editing && (
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg">
              <Camera className="w-3.5 h-3.5 text-primary-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleSelfieChange} />
            </label>
          )}
        </div>
        <div className="flex-1">
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" className="rounded-xl bg-card" />
          ) : (
            <>
              <h3 className="font-semibold text-foreground">{displayName}</h3>
              <p className="text-xs text-primary font-medium capitalize">
                {(profile?.subscription_tier || "free")} tier {profile?.subscription_tier !== "free" ? "✨" : ""}
              </p>
            </>
          )}
        </div>
      </GlassCard>

      {/* Profile Details */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground font-outfit">Fit Profile</h3>

        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Date of Birth</Label>
              <Input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className="mt-1 rounded-xl bg-card" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sex</Label>
              <div className="flex gap-2 mt-1">
                {["Female", "Male"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setEditSex(s.toLowerCase()); setEditBodyShape(""); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      editSex === s.toLowerCase()
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground border border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Body Shape</Label>
              <div className="flex gap-3 mt-1">
                {getBodyShapes(editSex || profile?.sex).map((shape) => {
                  const isSelected = editBodyShape === shape;
                  return (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setEditBodyShape(shape)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border hover:border-primary/50"
                      }`}
                    >
                      {shape}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Height (cm)</Label>
                <Input type="number" value={editHeight} onChange={(e) => setEditHeight(e.target.value)} placeholder="170" className="mt-1 rounded-xl bg-card" />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
                <Input type="number" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} placeholder="65" className="mt-1 rounded-xl bg-card" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">DOB</p>
                <p className="text-sm font-medium text-foreground">{formatDate(profile?.date_of_birth ?? null)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sex</p>
                <p className="text-sm font-medium text-foreground capitalize">{profile?.sex || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Height</p>
                <p className="text-sm font-medium text-foreground">{profile?.height_cm ? `${profile.height_cm} cm` : "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Weight className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p>
                <p className="text-sm font-medium text-foreground">{profile?.weight_kg ? `${profile.weight_kg} kg` : "—"}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Body Shape</p>
                <p className="text-sm font-medium text-foreground">{profile?.body_shape || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* App Appearance */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground font-outfit flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> App Appearance
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "default", label: "Midnight", sub: "Default", bg: "#121417", accent: "#C4A55A", swatch3: "#EDE8DA", premium: false },
            { key: "forest", label: "Forest & Sand", sub: "Premium", bg: "#2C3A2E", accent: "#C8B69B", swatch3: "#F4F4F0", premium: true },
            { key: "navy", label: "Midnight Navy", sub: "Premium", bg: "#18222E", accent: "#C8B69B", swatch3: "#F4F4F0", premium: true },
            { key: "rose", label: "Rose Water", sub: "Premium", bg: "#FDE8EE", accent: "#E098A6", swatch3: "#5C4048", premium: true },
            { key: "cream", label: "Minimal Cream", sub: "Premium", bg: "#F7F6F2", accent: "#C0B5A6", swatch3: "#4A4642", premium: true },
            { key: "peach", label: "Warm Peach", sub: "Premium", bg: "#FEF0E6", accent: "#E8AD8E", swatch3: "#5C463C", premium: true },
          ].map((t) => {
            const isActive = (profile?.app_theme || "default") === t.key;
            const tier = profile?.subscription_tier || "free";
            const isLocked = t.premium && tier === "free" && !isAdmin;
            return (
              <button
                key={t.key}
                onClick={async () => {
                  if (!user) return;
                  if (isLocked) {
                    toast("Unlock premium themes with Vora Plus or Pro", {
                      action: { label: "Upgrade", onClick: () => navigate("/subscription") },
                    });
                    return;
                  }
                  await supabase.from("profiles").update({ app_theme: t.key }).eq("user_id", user.id);
                  localStorage.setItem("vora_app_theme", t.key);
                  applyTheme(t.key);
                  queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
                  toast.success("Theme updated!");
                }}
                className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                  isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex gap-1 mb-2">
                  <div className="w-5 h-5 rounded-full border border-border/30" style={{ background: t.bg }} />
                  <div className="w-5 h-5 rounded-full border border-border/30" style={{ background: t.accent }} />
                  <div className="w-5 h-5 rounded-full border border-border/30" style={{ background: t.swatch3 }} />
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-semibold text-foreground leading-tight">{t.label}</p>
                  {isLocked && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                </div>
                <p className="text-[10px] text-muted-foreground">{t.sub}</p>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Pro Card */}
      <GlassCard className="p-5 cursor-pointer" glowOnHover onClick={() => navigate("/subscription")}>
        <div className="flex items-center gap-3 mb-3">
          <Crown className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-primary text-sm">VORA Pro</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Unlock unlimited AI try-ons, advanced styling, and more.
        </p>
      </GlassCard>

      {/* Admin Tools */}
      {isAdmin && (
        <GlassCard className="p-5 space-y-3 border-dashed border-primary/30">
          <h3 className="text-sm font-semibold text-muted-foreground font-outfit flex items-center gap-2">
            <Database className="w-4 h-4" /> Admin Tools
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              toast.info("Fetching 500+ products… this may take a minute");
              try {
                const { data, error } = await supabase.functions.invoke("seed-beauty-library");
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                toast.success(`Seeded ${data.totalInserted} products!${data.errors?.length ? ` (${data.errors.length} warnings)` : ""}`);
              } catch (err: any) {
                toast.error(err.message || "Seeding failed");
              } finally {
                setSeeding(false);
              }
            }}
          >
            {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
            Stock Beauty Library
          </Button>
        </GlassCard>
      )}

      {/* Menu */}
      <div className="space-y-2">
        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => navigate("/settings")}>
          <Settings className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </GlassCard>

        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer" onClick={handleSignOut}>
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Sign Out</span>
        </GlassCard>
      </div>

      {rawImageSrc && (
        <AvatarCropperModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          imageSrc={rawImageSrc}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default ProfilePage;
