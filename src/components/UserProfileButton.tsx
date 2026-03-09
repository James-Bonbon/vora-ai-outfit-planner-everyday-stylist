import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const UserProfileButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAvatar = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("selfie_url, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return;

      // selfie_url may be a full public URL or a legacy relative path
      let selfie = data?.selfie_url || null;
      if (selfie && !selfie.startsWith("http")) {
        selfie = supabase.storage.from("selfies").getPublicUrl(selfie).data.publicUrl;
      }

      const url = selfie || data?.avatar_url || user.user_metadata?.avatar_url;
      if (url) setAvatarUrl(url);
    };

    fetchAvatar();
  }, [user]);

  return (
    <button
      onClick={() => navigate("/profile")}
      className="transition-transform hover:scale-105 shrink-0"
    >
      <Avatar className="w-9 h-9 border border-border shadow-sm">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
        <AvatarFallback className="bg-primary text-primary-foreground font-medium text-sm">
          {user?.email?.charAt(0).toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
    </button>
  );
};

export default UserProfileButton;
