import { useState, useEffect, useCallback, useRef } from "react";
import SafeImage from "@/components/ui/SafeImage";
import GlassCard from "@/components/GlassCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HeartPulse,
  Camera,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Sun,
  Moon,
  AlertTriangle,
  ChevronRight,
  ShoppingBag,
  Send,
  ExternalLink,
  Droplets,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import ProductLibrary from "@/components/beauty/ProductLibrary";

interface BeautyProduct {
  id: string;
  image_url: string;
  name: string | null;
  brand: string | null;
  product_type: string | null;
  ingredients: string[] | null;
  routine_step: string | null;
  notes: string | null;
  created_at: string;
}

interface RoutineStep {
  step: string;
  product_name: string;
  why: string;
}

interface GapItem {
  step: string;
  recommendation: string;
}

interface RoutineData {
  am_routine: RoutineStep[];
  pm_routine: RoutineStep[];
  gaps: GapItem[];
}

interface ShoppingProduct {
  title: string;
  imageUrl: string;
  link: string;
  price?: string;
  source?: string;
}

interface ShoppingGroup {
  term: string;
  products: ShoppingProduct[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  shopping?: ShoppingGroup[];
  quickReplies?: string[];
}

const STEP_LABELS: Record<string, string> = {
  "1-Cleanse": "Cleanse",
  "2-Tone": "Tone",
  "3-Treat": "Treat",
  "4-Moisturise": "Moisturise",
  "5-Protect": "Protect",
};

/* HMR refresh */
const BeautyPage = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<BeautyProduct[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BeautyProduct | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [routineData, setRoutineData] = useState<RoutineData | null>(null);
  const [buildingRoutine, setBuildingRoutine] = useState(false);
  const [tab, setTab] = useState<"shelf" | "browse" | "advice">("shelf");
  const [addingBrowseProduct, setAddingBrowseProduct] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [adviceQuery, setAdviceQuery] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [shoppingImgErrors, setShoppingImgErrors] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("beauty_products")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setProducts(data as BeautyProduct[]);
      const urls: Record<string, string> = {};
      const pathsToSign: string[] = [];

      data.forEach((item: BeautyProduct) => {
        if (item.image_url.startsWith("http")) {
          urls[item.id] = item.image_url;
        } else {
          pathsToSign.push(item.image_url);
        }
      });

      if (pathsToSign.length > 0) {
        const { data: urlData } = await supabase.storage
          .from("beauty-products")
          .createSignedUrls(pathsToSign, 3600);
          
        if (urlData) {
          const unsignedItems = data.filter((item: BeautyProduct) => !item.image_url.startsWith("http"));
          urlData.forEach((u, index) => {
            if (u.signedUrl) urls[unsignedItems[index].id] = u.signedUrl;
          });
        }
      }
      setImageUrls(urls);
    }
  }, [user]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleScanProduct = async (file: File) => {
    if (!user) return;
    setScanning(true);
    try {
      // Upload image
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("beauty-products").upload(path, file);
      if (uploadErr) throw uploadErr;

      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      // AI scan
      const { data: aiData, error: aiErr } = await supabase.functions.invoke("scan-product", {
        body: { imageBase64: base64 },
      });
      if (aiErr) throw aiErr;

      // Save to DB
      const { error: insertErr } = await supabase.from("beauty_products").insert({
        user_id: user.id,
        image_url: path,
        name: aiData.name || null,
        brand: aiData.brand || null,
        product_type: aiData.product_type || null,
        ingredients: aiData.ingredients || [],
        routine_step: aiData.routine_step || null,
      });
      if (insertErr) throw insertErr;

      toast.success("Product scanned!");
      setAddOpen(false);
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to scan product");
    } finally {
      setScanning(false);
    }
  };

  const handleDelete = async (product: BeautyProduct) => {
    if (!user) return;
    setDeleting(true);
    try {
      // Only remove from storage if it's not an external URL
      if (!product.image_url.startsWith("http")) {
        await supabase.storage.from("beauty-products").remove([product.image_url]);
      }
      await supabase.from("beauty_products").delete().eq("id", product.id);
      toast.success("Product removed");
      setDetailOpen(false);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleBuildRoutine = async () => {
    if (products.length === 0) {
      toast.error("Add some products first");
      return;
    }
    setBuildingRoutine(true);
    setRoutineOpen(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("sex").eq("user_id", user!.id).maybeSingle();

      const { data, error } = await supabase.functions.invoke("build-routine", {
        body: {
          products: products.map((p) => ({
            name: p.name,
            product_type: p.product_type,
            ingredients: p.ingredients,
          })),
          profile,
        },
      });
      if (error) throw error;
      setRoutineData(data as RoutineData);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to build routine");
      setRoutineOpen(false);
    } finally {
      setBuildingRoutine(false);
    }
  };

  const handleAddFromBrowse = async (product: {
    name: string;
    brand: string;
    product_type: string;
    key_ingredients: string[];
    routine_step: string;
    image_url?: string;
  }) => {
    if (!user) return;
    setAddingBrowseProduct(product.name);
    try {
      // Store external URL directly — no need to re-upload
      const imageUrl = product.image_url || "";

      const { data: inserted, error } = await supabase
        .from("beauty_products")
        .insert({
          user_id: user.id,
          image_url: imageUrl,
          name: product.name,
          brand: product.brand,
          product_type: product.product_type,
          ingredients: product.key_ingredients,
          routine_step: product.routine_step,
        })
        .select()
        .single();
      if (error) throw error;

      // Optimistically add to local state so image shows instantly
      if (inserted) {
        setProducts((prev) => [inserted as BeautyProduct, ...prev]);
        if (imageUrl) {
          setImageUrls((prev) => ({ ...prev, [inserted.id]: imageUrl }));
        }
      }

      toast.success(`${product.name} added to your shelf!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add product");
    } finally {
      setAddingBrowseProduct(null);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, adviceLoading]);

  const handleSendAdvice = async (text?: string) => {
    const msg = (text || adviceQuery).trim();
    if (!msg || adviceLoading) return;

    const userMessage: ChatMessage = { role: "user", content: msg };
    setChatHistory((prev) => [...prev, userMessage]);
    setAdviceQuery("");
    setAdviceLoading(true);
    setShoppingImgErrors(new Set());

    try {
      // Build messages array for the backend (full history + new message)
      const historyForApi = [...chatHistory, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("generate-beauty-advice", {
        body: {
          messages: historyForApi,
          products: products.map((p) => ({
            name: p.name,
            product_type: p.product_type,
            ingredients: p.ingredients,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message,
        shopping: data.shopping || [],
        quickReplies: data.quick_replies || [],
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to get advice");
    } finally {
      setAdviceLoading(false);
    }
  };

  const handleAdviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendAdvice();
  };

  return (
    <div className="pt-6 space-y-5">
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Beauty</h1>
        {tab === "shelf" && (
          <Button
            variant="outline"
            size="icon"
            className="w-9 h-9 rounded-xl border-border hover:bg-muted shrink-0 shadow-sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="!w-6 !h-6 text-foreground stroke-[1]" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("shelf")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[44px] ${
            tab === "shelf" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          Shelf
        </button>
        <button
          onClick={() => setTab("browse")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[44px] ${
            tab === "browse" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          Browse
        </button>
        <button
          onClick={() => setTab("advice")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[44px] ${
            tab === "advice" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          Advice
        </button>
      </div>

      {/* Browse Tab */}
      {tab === "browse" && <ProductLibrary onAddToShelf={handleAddFromBrowse} addingProduct={addingBrowseProduct} />}

      {/* Advice Tab (Chat UI) */}
      {tab === "advice" && (
        <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scrollbar-none">
            {chatHistory.length === 0 && !adviceLoading && (
              <GlassCard className="flex flex-col items-center justify-center py-14 text-center mt-4">
                <Sparkles className="w-10 h-10 text-primary/20 mb-3" />
                <p className="text-sm text-muted-foreground max-w-[240px]">
                  Ask about clinical skincare concerns, formulations, or routine gaps.
                </p>
              </GlassCard>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                      : "bg-card border border-border rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Clinical Esthetician</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {/* Shopping Grid inside Assistant Bubble */}
                  {msg.shopping && msg.shopping.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recommended Formulations</p>
                      {msg.shopping.map((group) => (
                        <div key={group.term} className="space-y-2">
                          <p className="text-xs font-medium text-foreground">{group.term}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {group.products.map((product, idx) => (
                              <a
                                key={`${i}-${group.term}-${idx}`}
                                href={product.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl border border-border bg-background overflow-hidden hover:border-primary/40 transition-all"
                              >
                                <div className="aspect-square bg-white flex items-center justify-center p-2">
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.title} className="w-full h-full object-contain" />
                                  ) : (
                                    <Droplets className="w-6 h-6 text-muted-foreground/20" />
                                  )}
                                </div>
                                <div className="p-2 space-y-1 bg-card">
                                  <p className="text-[9px] text-muted-foreground truncate">{product.source}</p>
                                  <p className="text-[10px] font-semibold text-foreground line-clamp-2 leading-tight">{product.title}</p>
                                  <p className="text-[11px] font-bold text-primary">{product.price || "Check Price"}</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {adviceLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-xs font-medium text-muted-foreground">Analysing formulation...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          {/* Fixed Bottom Input Area */}
          <div className="pt-3 mt-auto border-t border-border/50 bg-background/95 pb-2">
            {/* Quick Replies */}
            {chatHistory.length > 0 && (() => {
              const lastAssistant = [...chatHistory].reverse().find((m) => m.role === "assistant");
              if (!lastAssistant?.quickReplies?.length) return null;
              return (
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                  {lastAssistant.quickReplies.map((qr, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendAdvice(qr)}
                      disabled={adviceLoading}
                      className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              );
            })()}
            {/* Input Form */}
            <form onSubmit={handleAdviceSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Message your clinical esthetician..."
                value={adviceQuery}
                onChange={(e) => setAdviceQuery(e.target.value)}
                className="flex-1 h-12 rounded-2xl bg-card border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
              <Button type="submit" size="icon" className="rounded-2xl h-12 w-12 shrink-0 shadow-sm" disabled={adviceLoading}>
                {adviceLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Shelf Tab */}
      {tab === "shelf" && (
        <>
          {/* AI Routine Builder CTA */}
          {products.length >= 2 && (
            <button
              onClick={handleBuildRoutine}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 transition-colors active:bg-primary/20"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-semibold text-foreground">Build My Routine</p>
                <p className="text-xs text-muted-foreground">AI-powered AM & PM skincare plan</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* Products Grid */}
          {products.length === 0 ? (
            <GlassCard className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <HeartPulse className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">No products yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                Scan your first skincare product by tapping the + button
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <GlassCard
                  key={product.id}
                  className="p-0 overflow-hidden cursor-pointer"
                  onClick={() => {
                    setSelectedProduct(product);
                    setDetailOpen(true);
                  }}
                >
                  <div className="aspect-square bg-card">
                    <SafeImage
                      src={imageUrls[product.id]}
                      alt={product.name || "Product"}
                      wrapperClassName="w-full h-full"
                      aspectRatio=""
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{product.name || "Unknown"}</p>
                    {product.product_type && (
                      <span className="text-[10px] text-muted-foreground">{product.product_type}</span>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Add Product Sheet */}
          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
              <SheetHeader>
                <SheetTitle className="font-outfit">Scan Product</SheetTitle>
              </SheetHeader>
              <div className="py-6 flex flex-col items-center gap-4">
                {scanning ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Analysing product…</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Camera className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center max-w-[260px]">
                      Take a photo of your skincare or beauty product. AI will identify it and extract key ingredients.
                    </p>
                    <label className="cursor-pointer">
                      <Button className="rounded-xl gap-2 pointer-events-none">
                        <Camera className="w-4 h-4" />
                        Take Photo or Upload
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleScanProduct(file);
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Product Detail Sheet */}
          <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
            <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] overflow-y-auto">
              {selectedProduct && (
                <>
                  <SheetHeader>
                    <SheetTitle className="font-outfit">{selectedProduct.name || "Product"}</SheetTitle>
                  </SheetHeader>
                  <div className="py-4 space-y-4">
                    {imageUrls[selectedProduct.id] && (
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-card">
                        <img
                          src={imageUrls[selectedProduct.id]}
                          alt={selectedProduct.name || "Product"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="space-y-3">
                      {selectedProduct.brand && (
                        <div>
                          <p className="text-xs text-muted-foreground">Brand</p>
                          <p className="text-sm font-medium text-foreground">{selectedProduct.brand}</p>
                        </div>
                      )}
                      {selectedProduct.product_type && (
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="text-sm font-medium text-foreground">{selectedProduct.product_type}</p>
                        </div>
                      )}
                      {selectedProduct.routine_step && (
                        <div>
                          <p className="text-xs text-muted-foreground">Routine Step</p>
                          <p className="text-sm font-medium text-foreground">
                            {STEP_LABELS[selectedProduct.routine_step] || selectedProduct.routine_step}
                          </p>
                        </div>
                      )}
                      {selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Key Ingredients</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedProduct.ingredients.map((ing, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary"
                              >
                                {ing}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full rounded-xl gap-2"
                      onClick={() => handleDelete(selectedProduct)}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Remove Product
                    </Button>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          {/* Routine Sheet */}
          <Sheet open={routineOpen} onOpenChange={setRoutineOpen}>
            <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[90vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-outfit">Your Routine</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-6">
                {buildingRoutine ? (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Building your personalised routine…</p>
                  </div>
                ) : routineData ? (
                  <>
                    {/* AM Routine */}
                    {routineData.am_routine && routineData.am_routine.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sun className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">Morning Routine</h3>
                        </div>
                        <div className="space-y-2">
                          {routineData.am_routine.map((step, i) => (
                            <div key={i} className="flex gap-3 p-3 rounded-xl bg-card border border-border">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{i + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{step.product_name}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{step.why}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PM Routine */}
                    {routineData.pm_routine && routineData.pm_routine.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Moon className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-foreground">Evening Routine</h3>
                        </div>
                        <div className="space-y-2">
                          {routineData.pm_routine.map((step, i) => (
                            <div key={i} className="flex gap-3 p-3 rounded-xl bg-card border border-border">
                              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{i + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{step.product_name}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{step.why}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gap Analysis */}
                    {routineData.gaps && routineData.gaps.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          <h3 className="text-sm font-semibold text-foreground">Missing Steps</h3>
                        </div>
                        <div className="space-y-2">
                          {routineData.gaps.map((gap, i) => (
                            <div key={i} className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                              <p className="text-sm font-medium text-foreground">{STEP_LABELS[gap.step] || gap.step}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{gap.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Medical Disclaimer */}
      <div className="pt-4 pb-20 text-center px-4">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <ShieldAlert className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Disclaimer</span>
        </div>
        <p className="text-[10px] text-muted-foreground/50 leading-relaxed max-w-[320px] mx-auto">
          VORA AI provides generic cosmetic suggestions. Always patch-test new ingredients and consult a dermatologist for medical skin conditions.
        </p>
      </div>
    </div>
  );
};

export default BeautyPage;
