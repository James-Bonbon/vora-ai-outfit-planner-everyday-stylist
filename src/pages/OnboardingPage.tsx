import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronRight, ChevronLeft, AlertTriangle, LogOut, Check, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import GlassCard from "@/components/GlassCard";
import Magic5Upload from "@/components/onboarding/Magic5Upload";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/utils/cropImage";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const FEMALE_SHAPES = ["Hourglass", "Pear", "Apple", "Rectangle", "Inverted Triangle"];
const MALE_SHAPES = ["Trapezoid", "Inverted Triangle", "Rectangle", "Triangle", "Oval"];

const VIBES = ["Casual", "Streetwear", "Smart Casual", "Minimalist", "Vintage", "Athleisure", "Bohemian", "Preppy"];
const TOTAL_STEPS = 5;

const MIN_AGE = 13;
const USERNAME_REGEX = /^[a-z0-9._]{3,30}$/;

const getAge = (dob: string): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const OnboardingPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<{ vibe: string[]; fit: string; colors: string }>({ vibe: [], fit: "Fitted", colors: "Neutral" });

  const [profileData, setProfileData] = useState({ username: "", gender: "female" });

  // Cropper state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isSkippingAvatar, setIsSkippingAvatar] = useState(false);

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  // sex state removed — gender is collected in Step 2 (Fit Profile) only
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const [bodyShape, setBodyShape] = useState("");

  const age = getAge(dateOfBirth);
  const isUnderage = age !== null && age < MIN_AGE;

  const handleUsernameChange = (val: string) => {
    const lower = val.toLowerCase().replace(/\s/g, "");
    setUsername(lower);
    setUsernameStatus("idle");
  };

  const checkUsername = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) { setUsernameStatus("idle"); return; }
    if (!USERNAME_REGEX.test(trimmed)) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const { data } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("username", trimmed)
      .neq("user_id", user?.id ?? "")
      .maybeSingle();
    setUsernameStatus(data ? "taken" : "available");
  }, [username, user?.id]);

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target?.result as string);
        setIsSkippingAvatar(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSkipAvatar = () => {
    setIsSkippingAvatar(true);
    setImageSrc(null);
    setSelfieFile(null);
    setSelfiePreview(null);
    setStep(1);
  };

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, "selfie_crop.jpg");
      setSelfieFile(croppedFile);
      setSelfiePreview(URL.createObjectURL(croppedFile));
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image. Please try again.");
    }
  };

  const toggleVibe = (v: string) => {
    setPreferences(prev => {
      const isSelected = prev.vibe.includes(v);
      if (isSelected) return { ...prev, vibe: prev.vibe.filter(i => i !== v) };
      if (prev.vibe.length >= 3) {
        toast.error("You can select up to 3 vibes.");
        return prev;
      }
      return { ...prev, vibe: [...prev.vibe, v] };
    });
  };

  // Save profile data (steps 0-3) WITHOUT setting onboarding_complete
  const handleSaveProfile = async () => {
    if (!user) return;
    if (isUnderage) { toast.error(`You must be at least ${MIN_AGE} years old to use VORA.`); return; }
    if (!username.trim() || !USERNAME_REGEX.test(username)) { toast.error("Please enter a valid username."); return; }
    if (usernameStatus === "taken") { toast.error("That username is already taken."); return; }
    if (!isSkippingAvatar && !selfieFile && !selfiePreview) { toast.error("Please upload a reference photo or skip."); return; }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username.trim())
        .neq("user_id", user.id)
        .maybeSingle();
      if (existing) { toast.error("That username was just taken. Please choose another."); setSaving(false); setUsernameStatus("taken"); return; }

      let selfiePath: string | null = null;
      if (!isSkippingAvatar && selfieFile) {
        const fileExt = selfieFile.name.split(".").pop();
        const filePath = `${user.id}/selfie_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("selfies")
          .upload(filePath, selfieFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("selfies").getPublicUrl(filePath);
        selfiePath = publicUrlData.publicUrl;
      }

      const updatePayload: Record<string, any> = {
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        date_of_birth: dateOfBirth || null,
        gender: profileData.gender,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        body_shape: bodyShape || null,
        style_preferences: preferences,
      };

      // Only update selfie_url if we have one
      if (selfiePath) {
        updatePayload.selfie_url = selfiePath;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", user.id);
      if (error) throw error;

      // Move to Magic 5 step
      setStep(4);
    } catch (err) {
      console.error("Profile save error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canContinueStep0 = !!selfiePreview || isSkippingAvatar;
  const canContinueStep1 = username.trim().length >= 3 && usernameStatus !== "taken" && usernameStatus !== "invalid" && !isUnderage;

  const bodyShapes = profileData.gender === "male" ? MALE_SHAPES : FEMALE_SHAPES;

  const usernameHint = () => {
    switch (usernameStatus) {
      case "checking": return <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</span>;
      case "available": return <span className="flex items-center gap-1 text-primary"><Check className="w-3 h-3" /> Available</span>;
      case "taken": return <span className="flex items-center gap-1 text-destructive"><X className="w-3 h-3" /> Taken</span>;
      case "invalid": return <span className="text-destructive">3-30 chars, lowercase, numbers, dots, underscores only</span>;
      default: return null;
    }
  };

  const steps = [
    // Step 0: Selfie with Cropper
    <motion.div key="selfie" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Your Reference Photo</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload a clear, front-facing photo for the AI Stylist</p>
      </div>

      {imageSrc && !selfiePreview ? (
        // Cropper mode
        <div className="space-y-4">
          <div className="relative w-full h-72 bg-muted rounded-xl overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="px-4">
            <Slider min={1} max={3} step={0.1} value={[zoom]} onValueChange={(val) => setZoom(val[0])} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setImageSrc(null); }}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleConfirmCrop}>
              Confirm Crop
            </Button>
          </div>
        </div>
      ) : (
        // Upload / Preview mode
        <GlassCard className="flex flex-col items-center justify-center p-8 min-h-[260px]">
          {selfiePreview ? (
            <div className="relative">
              <img src={selfiePreview} alt="Selfie preview" className="w-40 h-40 rounded-full object-cover border-4 border-primary/20" />
              <label className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg">
                <Camera className="w-5 h-5 text-primary-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleSelfieChange} />
              </label>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-3 cursor-pointer">
              <div className="w-28 h-28 rounded-full bg-secondary flex items-center justify-center">
                <Camera className="w-10 h-10 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-primary">Tap to upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleSelfieChange} />
            </label>
          )}
        </GlassCard>
      )}

      {!imageSrc && !selfiePreview && (
        <button
          onClick={handleSkipAvatar}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip for now (Use VORA Model)
        </button>
      )}

      {isSkippingAvatar && (
        <p className="text-center text-xs text-muted-foreground italic">Using default VORA model — you can add your photo later in Settings.</p>
      )}
    </motion.div>,

    // Step 1: Username + Fit Profile
    <motion.div key="info" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Claim Your Handle</h2>
        <p className="text-sm text-muted-foreground mt-1">Set up your identity</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="username" className="text-xs text-muted-foreground">Username <span className="text-destructive">*</span></Label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              id="username"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              onBlur={checkUsername}
              placeholder="yourhandle"
              className="pl-7 rounded-xl bg-card"
              maxLength={30}
            />
          </div>
          <div className="text-xs mt-1 h-4">{usernameHint()}</div>
        </div>
        <div>
          <Label htmlFor="name" className="text-xs text-muted-foreground">Display Name</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="mt-1 rounded-xl bg-card" />
        </div>
        <div>
          <Label htmlFor="dob" className="text-xs text-muted-foreground">Date of Birth</Label>
          <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="mt-1 rounded-xl bg-card" />
          {isUnderage && (
            <div className="flex items-center gap-2 mt-2 p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>You must be at least {MIN_AGE} years old to use VORA.</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="height" className="text-xs text-muted-foreground">Height (cm)</Label>
            <Input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" className="mt-1 rounded-xl bg-card" />
          </div>
          <div className="flex-1">
            <Label htmlFor="weight" className="text-xs text-muted-foreground">Weight (kg)</Label>
            <Input id="weight" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="65" className="mt-1 rounded-xl bg-card" />
          </div>
        </div>
      </div>
    </motion.div>,

    // Step 2: Gender Toggle + Body Shape
    <motion.div key="shape" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Fit Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Select your gender and closest body shape</p>
      </div>

      {/* Gender Toggle */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Gender</p>
        <div className="flex gap-2">
          {["female", "male"].map((g) => (
            <button
              key={g}
              onClick={() => { setProfileData(prev => ({ ...prev, gender: g })); setBodyShape(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                profileData.gender === g ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Body Shapes - vertical column */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Body Shape</p>
        <div className="flex flex-col gap-3">
          {bodyShapes.map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => setBodyShape(shape)}
              className={`w-full py-3 px-4 rounded-xl text-sm font-medium text-left transition-colors ${
                bodyShape === shape
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border hover:border-primary/50"
              }`}
            >
              {shape}
            </button>
          ))}
        </div>
      </div>
    </motion.div>,

    // Step 3: Style Vibe Quiz (multi-select, max 3)
    <motion.div key="vibe" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground font-outfit">What's Your Vibe?</h2>
        <p className="text-sm text-muted-foreground mt-1">Pick up to 3 styles for your AI Stylist.</p>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Everyday Style</p>
        <div className="grid grid-cols-2 gap-2">
          {VIBES.map((v) => {
            const isActive = preferences.vibe.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggleVibe(v)}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                    : "bg-card text-foreground border border-border hover:border-primary/50"
                }`}
              >
                {isActive && <Check className="w-3.5 h-3.5 inline mr-1.5" />}
                {v}
              </button>
            );
          })}
        </div>
        {preferences.vibe.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">{preferences.vibe.length}/3 selected</p>
        )}
      </div>
    </motion.div>,

    // Step 4: The Magic 5 — functional upload
    <motion.div key="magic5" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <Magic5Upload onAllUploaded={() => {
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith("vora_")) sessionStorage.removeItem(key);
        });
      }} />
    </motion.div>,
  ];

  const lastStep = TOTAL_STEPS - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <div className="flex gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
      </div>

      {step < lastStep && (
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          {step < lastStep - 1 ? (
            <Button
              onClick={() => { if (step === 1) checkUsername(); setStep(step + 1); }}
              disabled={(step === 0 && !canContinueStep0) || (step === 1 && !canContinueStep1)}
              className="flex-1 rounded-xl"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleSaveProfile} disabled={saving} className="flex-1 rounded-xl">
              {saving ? "Saving…" : "Continue to Magic 5"} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      <button
        onClick={signOut}
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-4"
      >
        <LogOut className="w-3 h-3" /> Sign Out
      </button>
    </div>
  );
};

export default OnboardingPage;
