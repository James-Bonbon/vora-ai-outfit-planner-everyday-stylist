import { useState, useCallback } from "react";
import GlassCard from "@/components/GlassCard";
import { Search, Loader2, Star, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrowseProduct {
  name: string;
  brand: string;
  product_type: string;
  price: string;
  rating: number;
  key_ingredients: string[];
  description: string;
  routine_step: string;
}

const BROWSE_CATEGORIES = [
  "All Skincare",
  "Cleanser",
  "Moisturiser",
  "SPF",
  "Serum",
  "Toner",
  "Exfoliant",
  "Eye Cream",
  "Mask",
];

interface ProductLibraryProps {
  onAddToShelf: (product: BrowseProduct) => void;
  addingProduct: string | null;
}

const ProductLibrary = ({ onAddToShelf, addingProduct }: ProductLibraryProps) => {
  const [category, setCategory] = useState("All Skincare");
  const [products, setProducts] = useState<BrowseProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BrowseProduct | null>(null);

  const fetchProducts = useCallback(async (cat: string) => {
    setLoading(true);
    setSelectedProduct(null);
    try {
      const { data, error } = await supabase.functions.invoke("browse-products", {
        body: { category: cat === "All Skincare" ? "skincare" : cat },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProducts(data.products || []);
      setHasLoaded(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    fetchProducts(cat);
  };

  if (!hasLoaded && !loading) {
    return (
      <div className="space-y-4">
        <GlassCard className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Discover Products</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
            Browse curated skincare products available in the UK. Find what works for your routine.
          </p>
          <Button className="mt-4 rounded-xl gap-2" onClick={() => fetchProducts(category)}>
            <Search className="w-4 h-4" />
            Browse Products
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {BROWSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[36px] ${
              category === cat
                ? "bg-primary text-primary-foreground border border-primary"
                : "border border-border text-muted-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Finding products…</p>
        </div>
      ) : selectedProduct ? (
        /* Product Detail View */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <GlassCard className="p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-foreground font-outfit">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground">{selectedProduct.brand}</p>
              </div>
              <span className="text-lg font-bold text-primary">{selectedProduct.price}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm font-medium text-foreground">{selectedProduct.rating}</span>
              <span className="text-xs text-muted-foreground">/ 5</span>
            </div>
            <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Key Ingredients</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedProduct.key_ingredients.map((ing, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 rounded-xl gap-2"
                onClick={() => onAddToShelf(selectedProduct)}
                disabled={addingProduct === selectedProduct.name}
              >
                {addingProduct === selectedProduct.name ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add to My Shelf
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedProduct(null)}>
                Back
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : (
        /* Product Grid */
        <div className="grid grid-cols-2 gap-3">
          {products.map((product, i) => (
            <GlassCard
              key={i}
              className="p-3.5 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedProduct(product)}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2.5">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{product.brand}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-primary">{product.price}</span>
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-[10px] text-muted-foreground">{product.rating}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductLibrary;
