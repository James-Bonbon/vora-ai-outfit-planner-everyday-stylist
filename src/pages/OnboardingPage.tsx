import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronRight, ChevronLeft, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "@/components/GlassCard";
import BodyShapeIcon from "@/components/onboarding/BodyShapeIcon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BODY_SHAPES = [
  { id: "balanced", label: "Balanced" },
  { id: "shoulders_wider", label: "Shoulders Wider" },
  { id: "hips_wider", label: "Hips Wider" },
  { id: "midsection_fuller", label: "Midsection Fuller" },
  { id: "curvy", label: "Curvy" },
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

      <div className="grid grid-cols-2 gap-3">
        {BODY_SHAPES.map((shape) => {
          const selected = bodyShape === shape.id;
          return (
            <div
              key={shape.id}
              onClick={() => setBodyShape(shape.id)}
              className={`relative flex flex-col items-center gap-2 p-5 rounded-2xl cursor-pointer transition-all bg-card ${
                selected ? "border-2 border-primary shadow-sm" : "border border-border"
              }`}
            >
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <BodyShapeIcon shape={shape.id} className="w-12 h-12" />
              <span className="text-sm font-medium text-foreground">{shape.label}</span>
            </div>
          );
        })}
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
