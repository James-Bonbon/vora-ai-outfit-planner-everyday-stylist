import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function StyleAnalytics() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sleek Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Wardrobe
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Style Analytics</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My Style DNA</h1>
          <p className="mt-2 text-muted-foreground">
            Discover patterns and insights about your personal style.
          </p>
        </div>

        {/* Placeholder for future analytics content */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-4 h-12 w-12 text-primary/50" />
            <h2 className="text-lg font-medium">Coming Soon</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your style insights and analytics will appear here. Check back later for updates.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
