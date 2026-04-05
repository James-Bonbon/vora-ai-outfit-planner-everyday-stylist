import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronRight, ChevronLeft, AlertTriangle, LogOut, Check, X, Loader2, Sparkles, Shirt, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "@/components/GlassCard";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { getBodyShapes } from "@/constants/bodyShapes";

const VIBES = ["Casual", "Streetwear", "Smart Casual", "Minimalist"];
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
  const [preferences, setPreferences] = useState({ vibe: "Casual", fit: "Fitted", colors: "Neutral" });

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("");
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
      setSelfieFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setSelfiePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    if (isUnderage) { toast.error(`You must be at least ${MIN_AGE} years old to use VORA.`); return; }
    if (!username.trim() || !USERNAME_REGEX.test(username)) { toast.error("Please enter a valid username."); return; }
    if (usernameStatus === "taken") { toast.error("That username is already taken."); return; }
    if (!selfieFile && !selfiePreview) { toast.error("Please upload a reference photo to continue."); return; }

    setSaving(true);
    try {
      // Check username uniqueness one final time
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username.trim())
        .neq("user_id", user.id)
        .maybeSingle();
      if (existing) { toast.error("That username was just taken. Please choose another."); setSaving(false); setUsernameStatus("taken"); return; }

      let selfiePath: string | null = null;
      if (selfieFile) {
        const fileExt = selfieFile.name.split(".").pop();
        const filePath = `${user.id}/selfie_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("selfies")
          .upload(filePath, selfieFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("selfies").getPublicUrl(filePath);
        selfiePath = publicUrlData.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          username: username.trim(),
          display_name: displayName.trim() || username.trim(),
          date_of_birth: dateOfBirth || null,
          sex: sex || null,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          body_shape: bodyShape || null,
          selfie_url: selfiePath,
          style_preferences: preferences,
          onboarding_complete: true,
        })
        .eq("user_id", user.id);
      if (error) throw error;

      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("vora_")) sessionStorage.removeItem(key);
      });

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-data"] });

      toast.success("Welcome to VORA! 🎉");
      navigate("/home", { replace: true });
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canContinueStep0 = !!selfiePreview;
  const canContinueStep1 = username.trim().length >= 3 && usernameStatus !== "taken" && usernameStatus !== "invalid" && !isUnderage;

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
    // Step 0: Selfie (required)
    <motion.div key="selfie" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Your Reference Photo</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload a clear, front-facing photo for the AI Stylist</p>
      </div>
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
        <div>
          <Label className="text-xs text-muted-foreground">Sex</Label>
          <div className="flex gap-2 mt-1">
            {["Female", "Male", "Other"].map((s) => (
              <button key={s} onClick={() => setSex(s.toLowerCase())} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${sex === s.toLowerCase() ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"}`}>
                {s}
              </button>
            ))}
          </div>
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

    // Step 2: Body Shape
    <motion.div key="shape" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Fit Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Select the closest body shape</p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Body Shape</p>
        <div className="flex gap-3">
          {getBodyShapes(sex).map((shape) => (
            <button key={shape} type="button" onClick={() => setBodyShape(shape)} className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${bodyShape === shape ? "bg-primary text-primary-foreground" : "bg-card text-foreground border border-border hover:border-primary/50"}`}>
              {shape}
            </button>
          ))}
        </div>
      </div>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>
      </div>

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        {step < 2 ? (
          <Button
            onClick={() => { if (step === 1) checkUsername(); setStep(step + 1); }}
            disabled={(step === 0 && !canContinueStep0) || (step === 1 && !canContinueStep1)}
            className="flex-1 rounded-xl"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={saving} className="flex-1 rounded-xl">
            {saving ? "Setting up..." : "Complete Setup ✨"}
          </Button>
        )}
      </div>

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
