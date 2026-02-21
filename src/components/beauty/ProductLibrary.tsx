import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
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
  const [localLibrary, setLocalLibrary] = useState<CatalogProduct[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [searchResults, setSearchResults] = useState<CatalogProduct[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const expandedRef = useRef<HTMLDivElement>(null);

  // 1. Supabase-first: fetch entire catalog on mount (0 API cost)
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("beauty_products_catalog")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("Library fetch error:", error);
      } else {
        setLocalLibrary((data as CatalogProduct[]) || []);
      }
      setLibraryLoaded(true);
    };
    load();
  }, []);

  // 2. Smart client-side filtering with fuzzy match + aliases
  const filteredProducts = useMemo(() => {
    if (category === "All") return localLibrary;
    const searchTerm = category.toLowerCase();
    return localLibrary.filter((p) => {
      const catMatch = p.standardized_category?.toLowerCase().includes(searchTerm) || false;
      const nameMatch = p.name?.toLowerCase().includes(searchTerm) || false;
      const descMatch = p.description?.toLowerCase().includes(searchTerm) || false;

      let aliasMatch = false;
      const productName = p.name?.toLowerCase() || "";
      const desc = p.description?.toLowerCase() || "";
      const combined = productName + " " + desc;

      if (searchTerm === "perfume") {
        aliasMatch = /fragrance|parfum|eau de|cologne/.test(combined);
      } else if (searchTerm === "skincare") {
        aliasMatch = /cream|serum|cleanser|lotion|moisturiz|spf|retinol/.test(combined);
      } else if (searchTerm === "foundation") {
        aliasMatch = /concealer|tinted moisturiz|bb cream|cc cream/.test(combined);
      } else if (searchTerm === "lipstick") {
        aliasMatch = /lip gloss|lip tint|lip liner|lip colour/.test(combined);
      } else if (searchTerm === "mascara") {
        aliasMatch = /lash|lashes/.test(combined);
      } else if (searchTerm === "eyeliner") {
        aliasMatch = /kohl|kajal|eye pencil/.test(combined);
      } else if (searchTerm === "nail polish") {
        aliasMatch = /nail lacquer|nail varnish|gel polish/.test(combined);
      }

      return catMatch || nameMatch || descMatch || aliasMatch;
    });
  }, [localLibrary, category]);

  // 3. Search triggers the edge function (costs money, only on explicit submit)
  const handleSearchFetch = useCallback(async (query: string) => {
    setSearchLoading(true);
    setExpandedId(null);
    setImgErrors(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("browse-products", {
        body: { category: "", search: query },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const products = (data.products || []) as CatalogProduct[];
      setSearchResults(products);

      // Merge search results into local library so they're available for future filtering
      if (products.length > 0) {
        setLocalLibrary((prev) => {
          const existingNames = new Set(prev.map((p) => p.name));
          const newProducts = products.filter((p) => !existingNames.has(p.name));
          return newProducts.length > 0 ? [...newProducts, ...prev] : prev;
        });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to search products");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) handleSearchFetch(searchQuery.trim());
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setSearchResults(null);
    setExpandedId(null);
  };

  // What to render
  const displayProducts = searchResults !== null ? searchResults : filteredProducts;
  const hasData = displayProducts.length > 0;
  const loading = searchLoading;

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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === "") clearSearch();
            }}
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
              category === cat && searchResults === null
                ? "bg-primary text-primary-foreground border border-primary"
                : "border border-border text-muted-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search mode indicator */}
      {searchResults !== null && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing results for "<span className="text-foreground font-medium">{searchQuery}</span>"
          </p>
          <button onClick={clearSearch} className="text-xs text-primary font-medium">
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Searching UK stores…</p>
        </div>
      ) : !libraryLoaded ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading library…</p>
        </div>
      ) : !hasData ? (
        <GlassCard className="flex flex-col items-center justify-center py-14 text-center">
          <Droplets className="w-10 h-10 text-primary/20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchResults !== null
              ? "No products found. Try a different search."
              : localLibrary.length === 0
                ? "Library is building. Use the search bar to find and add products."
                : `No ${category.toLowerCase()} found in your library yet. Search for one to add it!`}
          </p>
        </GlassCard>
      ) : (
        /* Product Grid */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {displayProducts.map((product) => (
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
                    <SafeImage
                      src={product.image_url}
                      alt={product.name}
                      fit="contain"
                      aspectRatio=""
                      wrapperClassName="w-full h-full"
                      className="p-2"
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
