import { useState } from "react";
import imageCompression from "browser-image-compression";
import SafeImage from "@/components/ui/SafeImage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GlassCard from "@/components/GlassCard";
import { User, AtSign, Settings, Crown, LogOut, Pencil, X, Check, Ruler, Weight, Calendar, Users, Camera, Database, Loader2, Lock, Palette, ChevronLeft, MessageSquare, CalendarDays, Paperclip, Shield, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { applyTheme } from "@/components/ThemeProvider";
import { BODY_SHAPES, toDbValue, toDisplayLabel } from "@/constants/bodyShapes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AvatarCropperModal } from "@/components/AvatarCropperModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ignoreToastInteractOutside } from "@/lib/radixToastGuard";

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  selfie_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_shape: string | null;
  subscription_tier: string | null;
  app_theme: string | null;
  username: string | null;
  tier: string | null;
}


const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    queryFn: async () => {
      // 1. Fetch exactly the columns we need to avoid select("*") schema traps
      const { data: pData, error: pError } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, username, avatar_url, selfie_url, date_of_birth, gender, height_cm, weight_kg, body_shape, subscription_tier, app_theme, tier")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (pError) {
        console.error("Profile Fetch Error (Handled safely):", pError);
        // CRITICAL FIX: Do NOT throw an error. Return null to prevent the Error Boundary from kicking the user to /onboarding.
        return { profile: null, isAdmin: false };
      }

      // 2. Fetch Admin Role safely
      const { data: rData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();

      // Keep raw selfie_url path on profile — signing happens in a separate cached query
      return {
        profile: pData as ProfileData,
        isAdmin: !!rData || pData?.tier === 'admin',
      };
    }
  });

  const profile = profileData?.profile || null;
  const isAdmin = profileData?.isAdmin || false;

  // Separate cached signed URL query for the selfie. Keeps the avatar src stable
  // across navigations while the signed URL is still valid (1h expiry, 50min cache).
  const rawSelfieUrl = profile?.selfie_url || null;
  const { data: signedSelfieUrl } = useQuery({
    queryKey: ['selfie-url', user?.id, rawSelfieUrl],
    enabled: !!user && !!rawSelfieUrl,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    queryFn: async () => {
      if (!rawSelfieUrl) return null;
      if (rawSelfieUrl.startsWith("http")) return rawSelfieUrl;
      const { data, error } = await supabase.storage.from("selfies").createSignedUrl(rawSelfieUrl, 3600);
      if (error) {
        console.error("Selfie signed URL error:", error);
        return null;
      }
      return data?.signedUrl || null;
    },
  });

  const [editing, setEditing] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editSex, setEditSex] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editBodyShape, setEditBodyShape] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Feedback modal state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{url: string, type: string, name: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    e.target.value = "";
    if (!newFiles.length) return;

    if (attachments.length + newFiles.length > 3) {
      toast.error("Maximum 3 files allowed.");
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: {url: string, type: string, name: string}[] = [];

    for (const file of newFiles) {
      if (file.type.startsWith("video/")) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 20MB`);
          continue;
        }
        validFiles.push(file);
        newPreviews.push({ url: "", type: "video", name: file.name });
      } else if (file.type.startsWith("image/")) {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          const compressedFile = new File([compressed], file.name, { type: compressed.type });
          const previewUrl = URL.createObjectURL(compressedFile);
          validFiles.push(compressedFile);
          newPreviews.push({ url: previewUrl, type: "image", name: file.name });
        } catch {
          toast.error(`Failed to process ${file.name}`);
        }
      } else {
        toast.error("Only images and videos are supported.");
      }
    }

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeAttachment = (index: number) => {
    setPreviews(prev => {
      const removed = prev[index];
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllAttachments = () => {
    previews.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
    setAttachments([]);
    setPreviews([]);
  };

  const handleSubmitFeedback = async () => {
    if (!user || !feedbackMessage.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    setIsSubmitting(true);
    setIsUploading(attachments.length > 0);
    try {
      let finalAttachmentUrl: string | null = null;

      if (attachments.length > 0) {
        const uploadedUrls = await Promise.all(
          attachments.map(async (file) => {
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = `${user.id}/${Date.now()}-${cleanFileName}`;
            const { error: uploadError } = await supabase.storage
              .from("feedback_attachments")
              .upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage
              .from("feedback_attachments")
              .getPublicUrl(filePath);
            return data.publicUrl;
          })
        );
        finalAttachmentUrl = uploadedUrls.join(', ');
      }

      const { error } = await supabase.from("user_feedback").insert({
        user_id: user.id,
        type: feedbackType,
        message: feedbackMessage.trim(),
        attachment_url: finalAttachmentUrl,
      });
      if (error) throw error;
      toast.success("Feedback sent — thank you!");
      setFeedbackOpen(false);
      setFeedbackMessage("");
      setFeedbackType("bug");
      clearAllAttachments();
    } catch {
      toast.error("Failed to send feedback.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const startEditing = () => {
    setEditName(profile?.display_name || "");
    setEditDob(profile?.date_of_birth || "");
    setEditSex(profile?.gender || "");
    setEditHeight(profile?.height_cm?.toString() || "");
    setEditWeight(profile?.weight_kg?.toString() || "");
    setEditBodyShape(profile?.body_shape || "");
    setEditUsername(profile?.username || "");
    setUsernameError(null);
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

  const validateUsername = (value: string): string | null => {
    if (!value) return null;
    if (value !== value.toLowerCase()) return "Username must be lowercase";
    if (/\s/.test(value)) return "Username cannot contain spaces";
    if (!/^[a-z0-9._]*$/.test(value)) return "Only letters, numbers, dots, and underscores";
    if (value.length < 3) return "At least 3 characters";
    if (value.length > 30) return "Max 30 characters";
    return null;
  };

  const handleSave = async () => {
    if (!user || !editName.trim()) {
      toast.error("Name is required.");
      return;
    }
    const uError = validateUsername(editUsername);
    if (editUsername && uError) {
      setUsernameError(uError);
      return;
    }
    setSaving(true);
    try {
      let selfieStoragePath = profile?.selfie_url ?? null;

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

        // Store the raw storage path, not a public/signed URL
        selfieStoragePath = filePath;
      }

      const updatePayload: Record<string, any> = {
          display_name: editName.trim(),
          date_of_birth: editDob || null,
          gender: editSex || null,
          height_cm: editHeight ? Number(editHeight) : null,
          weight_kg: editWeight ? Number(editWeight) : null,
          selfie_url: selfieStoragePath,
          body_shape: editBodyShape || null,
          username: editUsername.trim() || null,
        };

      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
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

  const handleConnectCalendar = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
          redirectTo: window.location.origin + "/profile",
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to Google Calendar.");
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
        </div>
        <div className="flex-1">
          {editing ? (
            <div className="space-y-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" className="rounded-xl bg-card" />
              <div>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={editUsername}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/\s/g, "");
                      setEditUsername(val);
                      setUsernameError(validateUsername(val));
                    }}
                    placeholder="username"
                    className="rounded-xl bg-card pl-8 text-sm"
                  />
                </div>
                {usernameError && <p className="text-[11px] text-destructive mt-1">{usernameError}</p>}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl text-xs w-full"
                onClick={() => document.getElementById("selfie-upload-input")?.click()}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" /> Update VTON Selfie
              </Button>
              <input id="selfie-upload-input" type="file" accept="image/*" className="hidden" onChange={handleSelfieChange} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{displayName}</h3>
                {isAdmin && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 text-[10px] px-2 py-0.5 gap-1">
                    <Shield className="w-3 h-3" /> Admin
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {profile?.username ? `@${profile.username}` : "No username set"}
              </p>
              {!isAdmin && (
                <p className="text-xs text-primary font-medium capitalize">
                  {(profile?.subscription_tier || "free")} tier {(profile?.subscription_tier && profile.subscription_tier !== "free") ? "✨" : ""}
                </p>
              )}
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
              <div className="flex flex-wrap gap-2 mt-2">
                {BODY_SHAPES.map((shape) => {
                  const dbVal = toDbValue(shape);
                  const isSelected = editBodyShape === dbVal;
                  return (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setEditBodyShape(dbVal)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card text-foreground border border-border"
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gender</p>
                <p className="text-sm font-medium text-foreground capitalize">{profile?.gender || "—"}</p>
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
                <p className="text-sm font-medium text-foreground">{toDisplayLabel(profile?.body_shape) || "—"}</p>
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
                  if (isActive) return;
                  const { error } = await supabase
                    .from("profiles")
                    .update({ app_theme: t.key })
                    .eq("user_id", user.id);
                  if (error) {
                    toast.error("Failed to update theme.");
                    return;
                  }
                  localStorage.setItem("vora_app_theme", t.key);
                  applyTheme(t.key);
                  queryClient.setQueryData(['profile', user.id], (oldData: any) => {
                    if (!oldData?.profile) return oldData;
                    return {
                      ...oldData,
                      profile: { ...oldData.profile, app_theme: t.key },
                    };
                  });
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

      {/* Integrations */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground font-outfit flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> Integrations
        </h3>
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
          <div>
            <p className="text-sm font-medium text-foreground">Google Calendar</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px]">
              Allow VORA to securely read upcoming events to proactively plan your outfits.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl text-xs bg-background hover:bg-muted"
            onClick={handleConnectCalendar}
          >
            Connect
          </Button>
        </div>
      </GlassCard>

      {/* Pro Card - hidden for admins */}
      {!isAdmin && (
        <GlassCard className="p-5 cursor-pointer" glowOnHover onClick={() => navigate("/subscription")}>
          <div className="flex items-center gap-3 mb-3">
            <Crown className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-primary text-sm">VORA Pro</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Unlock unlimited AI try-ons, advanced styling, and more.
          </p>
        </GlassCard>
      )}

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
            onClick={() => navigate("/admin")}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" /> Admin Dashboard
          </Button>
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

      {/* Support & Menu */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-1 font-medium">Support</p>
        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setFeedbackOpen(true)}>
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Help & Feedback</span>
        </GlassCard>
        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => navigate("/settings")}>
          <Settings className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </GlassCard>
        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer" onClick={handleSignOut}>
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Sign Out</span>
        </GlassCard>
      </div>


      {/* Feedback Modal */}
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="rounded-2xl max-w-[360px]" onInteractOutside={ignoreToastInteractOutside}>
          <DialogHeader>
            <DialogTitle>Help & Feedback</DialogTitle>
            <DialogDescription>Let us know how we can improve.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
            Need immediate assistance or want to request account deletion? Email us directly at{" "}
            <a href="mailto:vora.support@gmail.com" className="font-semibold text-primary underline">
              vora.support@gmail.com
            </a>
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Issue Type</Label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="question">Question</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Message</Label>
              <Textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe your issue or idea…"
                className="mt-1 rounded-xl bg-card min-h-[100px]"
              />
            </div>

            {/* Attachment */}
            <div className="space-y-2">
              <input id="feedback-attachment" type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
              <Button variant="outline" size="sm" className="w-full rounded-xl text-xs" onClick={() => document.getElementById("feedback-attachment")?.click()} disabled={attachments.length >= 3}>
                <Paperclip className="w-3.5 h-3.5 mr-1.5" /> Attach Images or Videos
              </Button>
              <p className="text-xs text-muted-foreground text-center">Max 3 files. Videos limited to 20MB.</p>
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previews.map((p, i) => (
                    <div key={i} className="relative flex items-center gap-1.5 p-1.5 rounded-lg border border-border bg-card">
                      {p.type === "image" && p.url ? (
                        <img src={p.url} alt="preview" className="w-10 h-10 rounded-md object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-[10px] text-muted-foreground">VID</div>
                      )}
                      <span className="text-[10px] text-foreground truncate max-w-[60px]">{p.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeAttachment(i)}><X className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitFeedback} disabled={isSubmitting || isUploading || !feedbackMessage.trim()} className="w-full rounded-xl">
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isUploading ? "Uploading…" : "Sending..."}</> : "Send Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
