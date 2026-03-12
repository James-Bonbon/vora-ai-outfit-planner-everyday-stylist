import { useCommunityFeed } from "@/hooks/useCommunityFeed";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { Heart, MoreHorizontal, Flag, ShieldBan, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

const CommunityPage = () => {
  const { data, isLoading } = useCommunityFeed();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleReport = async (lookId: string, reason: string) => {
    if (!user) return;
    const { error } = await supabase.from("reports").insert({
      look_id: lookId,
      reporter_id: user.id,
      reason,
    });
    if (error) {
      toast.error("Failed to report");
      return;
    }
    toast.success("Post reported", {
      description: "Our team will review this content shortly.",
    });
    queryClient.invalidateQueries({ queryKey: ["community-feed"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const looks = data?.looks || [];
  const urls = data?.urls || {};
  const avatars = data?.avatarUrls || {};

  return (
    <div className="pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Inspo</h1>
      </div>

      {looks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>The community feed is empty. Be the first to publish a look!</p>
        </div>
      ) : (
        <div className="columns-2 gap-3 space-y-3">
          {looks.map((look) => (
            <GlassCard
              key={look.id}
              className="break-inside-avoid p-0 overflow-hidden"
            >
              <div className="relative">
                <SafeImage
                  src={urls[look.id]}
                  alt={look.occasion || "Community look"}
                  aspectRatio="aspect-[3/4]"
                  fit="cover"
                  className="rounded-t-2xl"
                />

                {/* Report Menu */}
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-full bg-background/60 backdrop-blur-sm text-foreground">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      <DropdownMenuItem
                        onClick={() =>
                          handleReport(look.id, "inappropriate_content")
                        }
                      >
                        <Flag className="w-4 h-4 mr-2 text-destructive" />
                        Report Image
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleReport(look.id, "block_user")}
                      >
                        <ShieldBan className="w-4 h-4 mr-2 text-destructive" />
                        Block User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Creator Info */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={avatars[look.id] || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {look.profiles?.display_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-foreground truncate">
                    {look.profiles?.display_name || "Vora User"}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-xs">{look.likes_count || 0}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
