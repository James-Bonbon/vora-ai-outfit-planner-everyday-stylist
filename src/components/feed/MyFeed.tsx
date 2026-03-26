import { useState } from "react";
import { Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { useMyPosts, useDeleteFeedPost } from "@/hooks/useFeedPosts";
import { FeedOutfitSheet } from "./FeedOutfitSheet";
import type { OutfitPost } from "@/data/mockFeedData";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: {
    label: "Pending Review",
    icon: <Clock className="w-3 h-3" />,
    className: "bg-yellow-500/80 text-white",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "bg-emerald-600/80 text-white",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="w-3 h-3" />,
    className: "bg-red-500/80 text-white",
  },
};

export const MyFeed = () => {
  const { data: myPosts = [], isLoading } = useMyPosts();
  const deleteMutation = useDeleteFeedPost();

  const [selectedItem, setSelectedItem] = useState<OutfitPost | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading your posts…</p>
      </div>
    );
  }

  if (myPosts.length === 0) {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-sm font-medium text-foreground">No posts yet</p>
        <p className="text-xs text-muted-foreground">Tap the + button to share your first outfit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {myPosts.map((post) => {
        const statusInfo = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;
        // Extract storage path from full URL for deletion
        const storagePath = post.main_image_url.includes("feed_images/")
          ? post.main_image_url.split("feed_images/")[1]?.split("?")[0]
          : undefined;

        return (
          <GlassCard key={post.id} className="p-0 overflow-hidden !rounded-2xl">
            <div
              className="aspect-[4/5] bg-muted relative cursor-pointer overflow-hidden rounded-t-2xl"
              onClick={() => { setSelectedItem(post); setSheetOpen(true); }}
            >
              <SafeImage src={post.main_image_url} alt={post.description} aspectRatio="" wrapperClassName="w-full h-full" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

              {/* Status Badge */}
              <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm ${statusInfo.className}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </span>
            </div>

            <div className="p-3.5 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground font-outfit truncate min-w-0">{post.description}</p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-destructive/10 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. The post and image will be permanently removed.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ postId: post.id, imagePath: storagePath })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </GlassCard>
        );
      })}

      <FeedOutfitSheet item={selectedItem} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
};
