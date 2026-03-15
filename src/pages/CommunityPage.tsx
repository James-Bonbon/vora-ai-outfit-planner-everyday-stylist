import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePublicFeed, type PublicLook } from "@/hooks/useFeedData";
import { Loader2, Sparkles, Compass, User } from "lucide-react";

const CommunityPage = () => {
  const { data: looks = [], isLoading } = usePublicFeed();

  // Split looks into two columns for a faux-masonry layout
  const col1 = looks.filter((_, i) => i % 2 === 0);
  const col2 = looks.filter((_, i) => i % 2 === 1);

  return (
    <div className="pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Inspiration</h1>
      </div>

      <div className="flex gap-2">
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
          For You
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          Trending
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Curating looks…</p>
        </div>
      ) : looks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Compass className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">No public looks yet</p>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Be the first to share your AI-generated style with the community!
          </p>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Column 1 */}
          <div className="flex-1 flex flex-col gap-3">
            {col1.map((look) => (
              <FeedCard key={look.id} look={look} />
            ))}
          </div>

          {/* Column 2 - Offset slightly for organic masonry feel */}
          <div className="flex-1 flex flex-col gap-3 pt-6">
            {col2.map((look) => (
              <FeedCard key={look.id} look={look} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Extracted Card Component for clean rendering
const FeedCard = ({ look }: { look: PublicLook }) => {
  const creatorName = look.profiles?.display_name || "Vora User";
  const creatorAvatar = look.profiles?.avatar_url || look.profiles?.selfie_url;

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="relative">
        {look.signed_image_url ? (
          <SafeImage
            src={look.signed_image_url}
            alt={look.occasion || "Community look"}
            aspectRatio="aspect-[3/4]"
            fit="cover"
            className="rounded-t-2xl"
          />
        ) : (
          <div className="aspect-[3/4] bg-muted flex items-center justify-center rounded-t-2xl">
            <Sparkles className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={creatorAvatar || undefined} />
            <AvatarFallback className="text-[9px]">
              <User className="w-3 h-3" />
            </AvatarFallback>
          </Avatar>
          <p className="text-xs font-medium text-foreground truncate">{creatorName}</p>
        </div>
        {look.occasion && (
          <span className="inline-block text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {look.occasion}
          </span>
        )}
      </div>
    </GlassCard>
  );
};

export default CommunityPage;
