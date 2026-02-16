import { useState, useCallback, useEffect } from "react";
import GlassCard from "@/components/GlassCard";
import { Search, Loader2, Star, Plus, ArrowLeft, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrowseProduct {
  id: number;
  name: string;
  brand: string;
  product_type: string;
  rating: number | null;
  description: string;
  image_url: string;
  tag_list: string[];
  product_colors: { name: string; hex: string }[];
  product_link: string;
}

const BROWSE_CATEGORIES = [
  "All",
  "Foundation",
  "Lipstick",
  "Mascara",
  "Eyeshadow",
  "Blush",
  "Bronzer",
  "Eyeliner",
  "Nail Polish",
  "Lip Liner",
];

interface ProductLibraryProps {
  onAddToShelf: (product: { name: string; brand: string; product_type: string; key_ingredients: string[]; routine_step: string }) => void;
  addingProduct: string | null;
}

const ProductLibrary = ({ onAddToShelf, addingProduct }: ProductLibraryProps) => {
  const [category, setCategory] = useState("All");
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
          category: cat === "All" ? "" : cat,
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

  // Auto-load on mount
  useEffect(() => {
    if (!hasLoaded) fetchProducts("All");
  }, []);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    fetchProducts(cat, searchQuery);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts(category, searchQuery);
  };

  const handleImgError = (key: string) => {
    setImgErrors((prev) => new Set(prev).add(key));
  };

  const handleAddToShelf = (product: BrowseProduct) => {
    onAddToShelf({
      name: product.name,
      brand: product.brand,
      product_type: product.product_type,
      key_ingredients: product.tag_list.slice(0, 4),
      routine_step: "",
    });
  };

  // Strip HTML tags from description
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim();

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by brand (e.g. maybelline)…"
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
          <p className="text-sm text-muted-foreground">Loading products…</p>
        </div>
      ) : selectedProduct ? (
        /* Product Detail View */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <GlassCard className="p-0 overflow-hidden">
            <div className="aspect-square bg-card relative">
              {!imgErrors.has(String(selectedProduct.id)) && selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-full h-full object-contain p-4"
                  onError={() => handleImgError(String(selectedProduct.id))}
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

              <div className="flex items-center gap-3 flex-wrap">
                {selectedProduct.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <span className="text-sm font-medium text-foreground">{selectedProduct.rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">/ 5</span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground border border-border rounded-full px-2.5 py-0.5 capitalize">
                  {selectedProduct.product_type}
                </span>
              </div>

              {selectedProduct.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {stripHtml(selectedProduct.description).slice(0, 300)}
                  {stripHtml(selectedProduct.description).length > 300 && "…"}
                </p>
              )}

              {selectedProduct.tag_list.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.tag_list.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct.product_colors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-1.5">Available Shades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.product_colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border text-[10px]">
                        <span
                          className="w-3 h-3 rounded-full border border-border shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-muted-foreground truncate max-w-[80px]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 rounded-xl gap-2"
                  onClick={() => handleAddToShelf(selectedProduct)}
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
      ) : products.length === 0 && hasLoaded ? (
        <GlassCard className="flex flex-col items-center justify-center py-14 text-center">
          <Droplets className="w-10 h-10 text-primary/20 mb-3" />
          <p className="text-sm text-muted-foreground">No products found. Try a different brand or category.</p>
        </GlassCard>
      ) : (
        /* Product Grid */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product) => (
            <GlassCard
              key={product.id}
              className="p-0 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedProduct(product)}
            >
              <div className="aspect-square bg-card relative">
                {!imgErrors.has(String(product.id)) && product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-contain p-2"
                    loading="lazy"
                    onError={() => handleImgError(String(product.id))}
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
                  {product.rating && (
                    <>
                      <Star className="w-3 h-3 text-primary fill-primary" />
                      <span className="text-[10px] text-muted-foreground">{product.rating.toFixed(1)}</span>
                    </>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto capitalize truncate max-w-[60px]">
                    {product.product_type}
                  </span>
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
