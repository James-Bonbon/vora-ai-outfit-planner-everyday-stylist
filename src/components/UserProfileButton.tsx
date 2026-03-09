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
      // 1. Check user_metadata first (e.g., Google Sign-In)
      if (user.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
        return;
      }

      // 2. Check the profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data?.avatar_url) return;

      // 3. Resolve the URL
      if (data.avatar_url.startsWith("http")) {
        setAvatarUrl(data.avatar_url);
      } else {
        // Storage path — use the selfies bucket
        const { data: urlData } = await supabase.storage
          .from("selfies")
          .createSignedUrl(data.avatar_url, 3600);

        if (urlData?.signedUrl) {
          setAvatarUrl(urlData.signedUrl);
        }
      }
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
