import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "@/components/GlassCard";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BODY_SHAPES = [
  {
    id: "balanced",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M7 4h10M7 4c0 4 3 7 3 8s-3 4-3 8m10-16c0 4-3 7-3 8s3 4 3 8M7 20h10" />
      </svg>
    ),
  },
  {
    id: "shoulders_wider",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M5 6h14M5 6c1 5 4 10 7 14M19 6c-1 5-4 10-7 14" />
      </svg>
    ),
  },
  {
    id: "hips_wider",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M12 4c-3 8-6 12-7 16h14c-1-4-4-8-7-16z" />
      </svg>
    ),
  },
  {
    id: "midsection_fuller",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <ellipse cx="12" cy="12" rx="7" ry="9" />
        <path d="M10 3h4M10 21h4" />
      </svg>
    ),
  },
  {
    id: "curvy",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M8 5c0 3 2 5 2 7s-3 4-3 7h10c0-3-3-4-3-7s2-4 2-7" />
        <path d="M9 5h6M9 19h6" />
      </svg>
    ),
  },
];

const MIN_AGE = 13;

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const [bodyShape, setBodyShape] = useState("");

  const age = getAge(dateOfBirth);
  const isUnderage = age !== null && age < MIN_AGE;
  const nameEmpty = displayName.trim().length === 0;

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelfieFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSelfiePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    if (isUnderage) {
      toast.error(`You must be at least ${MIN_AGE} years old to use VORA.`);
      return;
    }
    if (nameEmpty) {
      toast.error("Please enter your name to continue.");
      return;
    }
    setSaving(true);

    try {
      let selfiePath: string | null = null;

      if (selfieFile) {
        const fileExt = selfieFile.name.split(".").pop();
        const filePath = `${user.id}/selfie.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("selfies")
          .upload(filePath, selfieFile, { upsert: true });

        if (uploadError) throw uploadError;
        selfiePath = filePath;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          date_of_birth: dateOfBirth || null,
          sex: sex || null,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          body_shape: bodyShape || null,
          selfie_url: selfiePath,
          onboarding_complete: true,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Clear all session caches so Profile/Stylist fetch fresh data
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("vora_")) sessionStorage.removeItem(key);
      });

      toast.success("Welcome to VORA! 🎉");
      navigate("/home", { replace: true });
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canContinueStep1 = !nameEmpty && !isUnderage;

  const steps = [
    // Step 0: Selfie
    <motion.div key="selfie" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Your Selfie</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload a photo for AI body mapping</p>
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

    // Step 1: Fit Profile
    <motion.div key="info" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground font-outfit">Fit Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Help us personalise your experience</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-xs text-muted-foreground">Display Name <span className="text-destructive">*</span></Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="mt-1 rounded-xl bg-card" />
          {nameEmpty && displayName !== "" && (
            <p className="text-xs text-destructive mt-1">Name is required</p>
          )}
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
              <button
                key={s}
                onClick={() => setSex(s.toLowerCase())}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  sex === s.toLowerCase()
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border"
                }`}
              >
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
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {BODY_SHAPES.map((shape) => {
            const isSelected = bodyShape === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => setBodyShape(shape.id)}
                className={`relative flex-shrink-0 w-16 h-20 rounded-2xl flex items-center justify-center transition-all bg-card border-2 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
                aria-label={shape.id}
                title={shape.id}
              >
                {shape.icon}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <div className="flex gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-secondary"
            }`}
          />
        ))}
      </div>

      <div className="flex-1">
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
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !canContinueStep1}
            className="flex-1 rounded-xl"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={saving} className="flex-1 rounded-xl">
            {saving ? "Setting up..." : "Let's Go! 🚀"}
          </Button>
        )}
      </div>

      <button
        onClick={handleComplete}
        className="text-xs text-muted-foreground mt-4 text-center"
      >
        Skip for now
      </button>
    </div>
  );
};

export default OnboardingPage;
