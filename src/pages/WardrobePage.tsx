import GlassCard from "@/components/GlassCard";
import { Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

const WardrobePage = () => {
  return (
    <div className="pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Wardrobe</h1>
        <Button size="icon" className="rounded-xl h-10 w-10">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {["All", "Tops", "Bottoms", "Shoes", "Accessories", "Outerwear"].map((cat) => (
          <button
            key={cat}
            className="px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] border border-border text-muted-foreground first:bg-primary first:text-primary-foreground first:border-primary"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Empty State */}
      <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Plus className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Your closet is empty</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
          Add your first item by tapping the + button above
        </p>
      </GlassCard>
    </div>
  );
};

export default WardrobePage;
