import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Loader2, PackagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- ENTERPRISE SEED DATA DICTIONARY ---
// Images are now strictly bound to their specific garment type to prevent mismatches.
const CATALOG_BLUEPRINTS = {
  Tops: [
    {
      type: "Cashmere Sweater",
      brands: ["Loro Piana", "The Row", "Brunello Cucinelli"],
      basePrice: 1200,
      images: [
        "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80",
      ],
    },
    {
      type: "Ribbed Tank",
      brands: ["Loewe", "Toteme", "Khaite"],
      basePrice: 350,
      images: [
        "https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80",
      ],
    },
    {
      type: "Silk Charmeuse Blouse",
      brands: ["Saint Laurent", "Celine", "Khaite"],
      basePrice: 850,
      images: [
        "https://images.unsplash.com/photo-1598522325055-6b22eb5b9ddc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1603525283437-08ce91c5e408?w=800&auto=format&fit=crop&q=80",
      ],
    },
  ],
  Bottoms: [
    {
      type: "Tailored Trousers",
      brands: ["The Row", "Jil Sander", "Bottega Veneta"],
      basePrice: 950,
      images: [
        "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=800&auto=format&fit=crop&q=80",
      ],
    },
    {
      type: "Straight Leg Denim",
      brands: ["Khaite", "Loewe", "Celine"],
      basePrice: 650,
      images: [
        "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=800&auto=format&fit=crop&q=80",
      ],
    },
  ],
  Outerwear: [
    {
      type: "Tailored Blazer",
      brands: ["Saint Laurent", "The Row", "Alexander McQueen"],
      basePrice: 2800,
      images: [
        "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1604644401890-0bd678c83788?w=800&auto=format&fit=crop&q=80",
      ],
    },
    {
      type: "Madame Camel Coat",
      brands: ["Max Mara", "Loro Piana"],
      basePrice: 3900,
      images: ["https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&auto=format&fit=crop&q=80"],
    },
  ],
  Shoes: [
    {
      type: "Leather Loafers",
      brands: ["Gucci", "The Row", "Prada"],
      basePrice: 950,
      images: [
        "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80",
      ],
    },
    {
      type: "Runner Sneakers",
      brands: ["Loewe", "Balenciaga", "Bottega Veneta"],
      basePrice: 790,
      images: ["https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&auto=format&fit=crop&q=80"],
    },
  ],
};

const generateStructuredBatch = (count: number) => {
  const items = [];
  const categories = Object.keys(CATALOG_BLUEPRINTS) as Array<keyof typeof CATALOG_BLUEPRINTS>;

  for (let i = 0; i < count; i++) {
    // 1. Pick a random category
    const categoryName = categories[Math.floor(Math.random() * categories.length)];
    const categoryBlueprints = CATALOG_BLUEPRINTS[categoryName];

    // 2. Pick a specific blueprint from that category (e.g., Blazer)
    const blueprint = categoryBlueprints[Math.floor(Math.random() * categoryBlueprints.length)];

    // 3. Extract perfectly matched attributes
    const brand = blueprint.brands[Math.floor(Math.random() * blueprint.brands.length)];
    const imageUrl = blueprint.images[Math.floor(Math.random() * blueprint.images.length)];

    // 4. Generate a realistic price variance (+/- 10% of base price)
    const variance = blueprint.basePrice * 0.1;
    const finalPrice = Math.floor(blueprint.basePrice + Math.random() * variance * 2 - variance);

    items.push({
      title: `${brand} ${blueprint.type}`,
      brand: brand,
      price: finalPrice.toLocaleString("en-US"),
      category: categoryName,
      image_url: imageUrl,
      product_link: "#",
    });
  }
  return items;
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleWipeLibrary = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete ALL items from the library? This cannot be undone.",
    );
    if (!confirmed) return;

    setIsProcessing(true);
    const toastId = toast.loading("Wiping library database...");

    try {
      // Delete all records where ID is not null (clears the table)
      const { error } = await supabase
        .from("trending_clothes")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
      toast.success("Library successfully wiped clean. Ready for new seed data.", { id: toastId });
    } catch (err: any) {
      console.error("Wipe error:", err);
      toast.error(`Failed to wipe database: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestockLibrary = async () => {
    setIsProcessing(true);
    const toastId = toast.loading("Generating 500 structured items and pushing to database...");

    try {
      const massiveBatch = generateStructuredBatch(500);

      // Chunk the upload to respect API limits
      const chunkSize = 100;
      for (let i = 0; i < massiveBatch.length; i += chunkSize) {
        const chunk = massiveBatch.slice(i, i + chunkSize);
        const { error } = await supabase.from("trending_clothes").insert(chunk);

        if (error) throw error;
      }

      toast.success("500 luxury items successfully restocked! ✨", { id: toastId });
    } catch (err: any) {
      console.error("Restock error:", err);
      toast.error(`Failed to restock: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-safe pb-10">
      <div className="max-w-lg mx-auto pt-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl min-w-[44px] min-h-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground font-outfit">System Admin</h1>
        </div>

        <GlassCard className="p-8 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Database className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-outfit">Enterprise Data Seeder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage the VORA Library database. Wipe existing records to prevent duplicates, then seed structured,
              relational luxury garments.
            </p>
          </div>

          <div className="w-full space-y-3 mt-2">
            <Button
              onClick={handleWipeLibrary}
              disabled={isProcessing}
              variant="destructive"
              className="w-full rounded-xl gap-2 h-12 text-md font-semibold"
            >
              <Trash2 className="w-5 h-5" />
              Wipe Library Clean
            </Button>

            <Button
              onClick={handleRestockLibrary}
              disabled={isProcessing}
              className="w-full rounded-xl gap-2 h-12 text-md font-semibold"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
              {isProcessing ? "Processing..." : "Generate 500 Matched Items"}
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminPage;
