import GlassCard from "@/components/GlassCard";
import { User, Settings, Crown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const ProfilePage = () => {
  return (
    <div className="pt-6 space-y-5">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      {/* Avatar Section */}
      <GlassCard className="flex items-center gap-4 p-5">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <User className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">VORA User</h3>
          <p className="text-xs text-muted-foreground">Free tier</p>
        </div>
      </GlassCard>

      {/* Upgrade Card */}
      <GlassCard className="p-5 glow-lime" glowOnHover>
        <div className="flex items-center gap-3 mb-3">
          <Crown className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-primary text-sm">Upgrade to VORA Pro</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Unlock AI try-ons, garment care guides, and unlimited storage — £12/mo
        </p>
        <Button className="mt-4 w-full rounded-xl" size="sm">
          Go Pro
        </Button>
      </GlassCard>

      {/* Menu */}
      <div className="space-y-2">
        {[
          { icon: Settings, label: "Settings" },
          { icon: LogOut, label: "Sign Out" },
        ].map((item) => (
          <GlassCard key={item.label} className="flex items-center gap-3 p-4 cursor-pointer">
            <item.icon className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{item.label}</span>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default ProfilePage;
