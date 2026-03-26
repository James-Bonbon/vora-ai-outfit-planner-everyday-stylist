import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UploadOutfitModal } from "@/components/feed/UploadOutfitModal";
import { ExploreFeed } from "@/components/feed/ExploreFeed";
import { MyFeed } from "@/components/feed/MyFeed";

const TABS = ["Explore", "My Feed"] as const;
type Tab = (typeof TABS)[number];

const CommunityPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Explore");
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="pt-4 pb-20 px-4 space-y-4">
      {/* Segmented Control */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/30">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold tracking-wide rounded-lg transition-all duration-200 ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "Explore" ? <ExploreFeed /> : <MyFeed />}

      {/* FAB */}
      <button
        onClick={() => setUploadOpen(true)}
        className="fixed bottom-24 right-5 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Upload Modal */}
      <UploadOutfitModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onPublish={() => {}}
        username={user?.user_metadata?.username || user?.email?.split("@")[0] ? `@${user?.email?.split("@")[0]}` : "@you"}
      />
    </div>
  );
};

export default CommunityPage;
