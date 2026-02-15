import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import { User, Settings, Crown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || "VORA User";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <div className="pt-6 space-y-5">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      {/* Avatar Section */}
      <GlassCard className="flex items-center gap-4 p-5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-foreground">{displayName}</h3>
          <p className="text-xs text-primary font-medium">Pro tier ✨</p>
        </div>
      </GlassCard>

      {/* Pro Card */}
      <GlassCard className="p-5 glow-lime" glowOnHover>
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
