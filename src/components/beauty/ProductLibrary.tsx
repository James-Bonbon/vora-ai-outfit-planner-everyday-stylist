import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import GlassCard from "@/components/GlassCard";
import { Search, Loader2, Star, Plus, Droplets, ExternalLink, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  image_url: string | null;
  price: string | null;
  rating: number | null;
  reviews: number;
  store: string | null;
  product_link: string | null;
  standardized_category: string;
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
  "Skincare",
  "Perfume",
];

interface ProductLibraryProps {
  onAddToShelf: (product: { name: string; brand: string; product_type: string; key_ingredients: string[]; routine_step: string; image_url?: string }) => void;
  addingProduct: string | null;
}

const ProductLibrary = ({ onAddToShelf, addingProduct }: ProductLibraryProps) => {
  const [category, setCategory] = useState("All");
  const [allProducts, setAllProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);

  // Fetch once on mount — triggers edge function which checks cache first
  const fetchAllProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("browse-products", {
        body: { category: "", search: "beauty makeup skincare perfume" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAllProducts(data.products || []);
      setHasLoaded(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  // Search triggers a NEW fetch via edge function (cache-first)
  const handleSearchFetch = useCallback(async (query: string) => {
    setLoading(true);
    setExpandedId(null);
    setImgErrors(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("browse-products", {
        body: { category: "", search: query },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAllProducts(data.products || []);
      setCategory("All");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to search products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) fetchAllProducts();
  }, []);

  // Client-side filtered list using standardized_category — instant, no API call
  const filteredProducts = useMemo(
    () =>
      category === "All"
        ? allProducts
        : allProducts.filter((p) => p.standardized_category === category),
    [allProducts, category]
  );

  // Close expanded card when clicking outside
  useEffect(() => {
    if (expandedId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (expandedRef.current && !expandedRef.current.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expandedId]);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setExpandedId(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) handleSearchFetch(searchQuery.trim());
  };

  const handleImgError = (key: string) => {
    setImgErrors((prev) => new Set(prev).add(key));
  };

  const fetchIngredients = useCallback(async (productName: string) => {
    setLoadingIngredients(true);
    setIngredients([]);
    try {
      const { data, error } = await supabase.functions.invoke("get-ingredients", {
        body: { productName },
      });
      if (error) throw error;
      setIngredients(data?.ingredients || []);
    } catch (err: any) {
      console.error("Ingredients fetch error:", err);
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  const handleToggleProduct = (product: CatalogProduct) => {
    if (expandedId === product.id) {
      setExpandedId(null);
    } else {
      setExpandedId(product.id);
      fetchIngredients(product.name);
    }
  };

  const handleAddToShelf = (e: React.MouseEvent, product: CatalogProduct) => {
    e.stopPropagation();
    onAddToShelf({
      name: product.name,
      brand: product.store || "",
      product_type: product.standardized_category,
      key_ingredients: [],
      routine_step: "",
      image_url: product.image_url || undefined,
    });
  };

  const isExpanded = (id: string) => expandedId === id;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products (e.g. YSL Beauty)…"
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
          <p className="text-sm text-muted-foreground">Searching UK stores…</p>
        </div>
      ) : filteredProducts.length === 0 && hasLoaded ? (
        <GlassCard className="flex flex-col items-center justify-center py-14 text-center">
          <Droplets className="w-10 h-10 text-primary/20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {category === "All"
              ? "No products found. Try a different search."
              : `No ${category.toLowerCase()} products found in trending right now. Try the search bar instead.`}
          </p>
        </GlassCard>
      ) : (
        /* Product Grid */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              ref={isExpanded(product.id) ? expandedRef : undefined}
              className={`transition-all duration-200 ${isExpanded(product.id) ? "col-span-2 md:col-span-2" : ""}`}
            >
              <GlassCard
                className={`p-0 overflow-hidden cursor-pointer transition-colors ${
                  isExpanded(product.id) ? "border-primary/30" : "hover:border-primary/30"
                }`}
                onClick={() => handleToggleProduct(product)}
              >
                {/* Image */}
                <div className={`bg-card relative flex items-center justify-center ${isExpanded(product.id) ? "h-40" : "aspect-square"}`}>
                  {!imgErrors.has(product.id) && product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain p-2"
                      loading="lazy"
                      onError={() => handleImgError(product.id)}
                    />
                  ) : (
                    <Droplets className="w-8 h-8 text-primary/15" />
                  )}
                </div>

                {/* Basic info */}
                <div className="p-3 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{product.store}</p>
                  <p className={`text-xs font-medium text-foreground leading-tight ${isExpanded(product.id) ? "" : "line-clamp-2"}`}>
                    {product.name}
                  </p>
                  <div className="flex items-center justify-between pt-0.5">
                    {product.price && (
                      <span className="text-sm font-bold text-primary">{product.price}</span>
                    )}
                    {product.rating && (
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-primary fill-primary" />
                        <span className="text-[10px] text-muted-foreground">{product.rating}</span>
                        {isExpanded(product.id) && product.reviews > 0 && (
                          <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded(product.id) && (
                  <div className="px-3 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    {product.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
                    )}

                    {/* Key Ingredients */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-semibold text-foreground">Key Ingredients</p>
                      </div>
                      {loadingIngredients ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">Analysing…</span>
                        </div>
                      ) : ingredients.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ingredients.map((ing, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                              {ing}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">No ingredient data available.</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 rounded-xl gap-1.5 h-8 text-xs"
                        onClick={(e) => handleAddToShelf(e, product)}
                        disabled={addingProduct === product.name}
                      >
                        {addingProduct === product.name ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Add to Shelf
                      </Button>
                      {product.product_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1.5 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(product.product_link!, "_blank");
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Buy
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductLibrary;
