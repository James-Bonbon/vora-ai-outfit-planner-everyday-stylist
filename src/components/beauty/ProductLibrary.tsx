import { useState, useCallback } from "react";
import GlassCard from "@/components/GlassCard";
import { Search, Loader2, Star, Plus, ShoppingBag, ArrowLeft, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrowseProduct {
  name: string;
  brand: string;
  product_type: string;
  rating: number;
  key_ingredients: string[];
  description: string;
  how_to_use: string;
  volume: string;
  skin_type: string[];
  routine_step: string;
  image_url: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const fetchProducts = useCallback(async (cat: string, search?: string) => {
    setLoading(true);
    setSelectedProduct(null);
    setImgErrors(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("browse-products", {
        body: {
          category: cat === "All Skincare" ? "skincare" : cat,
          search: search || undefined,
        },
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
    fetchProducts(cat, searchQuery);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(category, searchQuery);
  };

  const handleImgError = (name: string) => {
    setImgErrors((prev) => new Set(prev).add(name));
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
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl h-10 bg-card border-border"
          />
        </div>
        <Button type="submit" size="sm" className="rounded-xl h-10 px-4" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </form>

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
          <GlassCard className="p-0 overflow-hidden">
            {/* Product image */}
            <div className="aspect-square bg-card relative">
              {!imgErrors.has(selectedProduct.name) && selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-full object-contain p-4"
                  onError={() => handleImgError(selectedProduct.name)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Droplets className="w-16 h-16 text-primary/20" />
                </div>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{selectedProduct.brand}</p>
                <p className="text-lg font-semibold text-foreground font-outfit mt-0.5">{selectedProduct.name}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm font-medium text-foreground">{selectedProduct.rating}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
                {selectedProduct.volume && (
                  <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                    {selectedProduct.volume}
                  </span>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>

              {selectedProduct.how_to_use && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">How to Use</p>
                  <p className="text-xs text-muted-foreground">{selectedProduct.how_to_use}</p>
                </div>
              )}

              {selectedProduct.skin_type && selectedProduct.skin_type.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-1.5">Suitable For</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.skin_type.map((st, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground">
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Key Ingredients</p>
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
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => setSelectedProduct(null)}>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      ) : (
        /* Product Grid - responsive: 2 cols mobile, 3 cols tablet, 4 cols desktop */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product, i) => (
            <GlassCard
              key={i}
              className="p-0 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedProduct(product)}
            >
              {/* Product image thumbnail */}
              <div className="aspect-square bg-card relative">
                {!imgErrors.has(product.name) && product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                    onError={() => handleImgError(product.name)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Droplets className="w-8 h-8 text-primary/15" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{product.brand}</p>
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{product.name}</p>
                <div className="flex items-center gap-1 pt-0.5">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-[10px] text-muted-foreground">{product.rating}</span>
                  {product.volume && (
                    <span className="text-[10px] text-muted-foreground ml-auto">{product.volume}</span>
                  )}
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
