import { useEffect, useState, useCallback } from "react";
import GlassCard from "@/components/GlassCard";
import { User, Settings, Crown, LogOut, Pencil, X, Check, Ruler, Weight, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
  selfie_url: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_shape: string | null;
}

const BODY_SHAPE_LABELS: Record<string, string> = {
  balanced: "Balanced",
  shoulders_wider: "Shoulders Wider",
  hips_wider: "Hips Wider",
  midsection_fuller: "Midsection Fuller",
  curvy: "Curvy",
};

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selfieSignedUrl, setSelfieSignedUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editSex, setEditSex] = useState("");
  const [editHeight, setEditHeight] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, selfie_url, date_of_birth, sex, height_cm, weight_kg, body_shape")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setProfile(data);
      // Get signed URL for selfie (private bucket)
      if (data.selfie_url) {
        const { data: signedData } = await supabase.storage
          .from("selfies")
          .createSignedUrl(data.selfie_url, 3600);
        setSelfieSignedUrl(signedData?.signedUrl || null);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const startEditing = () => {
    setEditName(profile?.display_name || "");
    setEditDob(profile?.date_of_birth || "");
    setEditSex(profile?.sex || "");
    setEditHeight(profile?.height_cm?.toString() || "");
    setEditWeight(profile?.weight_kg?.toString() || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!user || !editName.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: editName.trim(),
          date_of_birth: editDob || null,
          sex: editSex || null,
          height_cm: editHeight ? Number(editHeight) : null,
          weight_kg: editWeight ? Number(editWeight) : null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
      setEditing(false);
      fetchProfile();
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "VORA User";
  const avatarUrl = selfieSignedUrl || profile?.avatar_url || user?.user_metadata?.avatar_url;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
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
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          {editing ? (
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" className="rounded-xl bg-card" />
          ) : (
            <>
              <h3 className="font-semibold text-foreground">{displayName}</h3>
              <p className="text-xs text-primary font-medium">Pro tier ✨</p>
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
                {["Female", "Male", "Other"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditSex(s.toLowerCase())}
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
                <p className="text-sm font-medium text-foreground">{profile?.body_shape ? BODY_SHAPE_LABELS[profile.body_shape] || profile.body_shape : "—"}</p>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Pro Card */}
      <GlassCard className="p-5" glowOnHover>
        <div className="flex items-center gap-3 mb-3">
          <Crown className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-primary text-sm">VORA Pro — Active</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          AI try-ons, garment care guides, and unlimited storage are unlocked.
        </p>
      </GlassCard>

      {/* Menu */}
      <div className="space-y-2">
        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Settings</span>
        </GlassCard>

        <GlassCard className="flex items-center gap-3 p-4 cursor-pointer" onClick={handleSignOut}>
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Sign Out</span>
        </GlassCard>
      </div>
    </div>
  );
};

export default ProfilePage;
