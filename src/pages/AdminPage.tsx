import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// --- DYNAMIC DATA GENERATOR ---
const BRANDS = [
  "Loro Piana",
  "The Row",
  "Max Mara",
  "Loewe",
  "Khaite",
  "Toteme",
  "Jil Sander",
  "Bottega Veneta",
  "Brunello Cucinelli",
  "Celine",
];
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes"];

const ITEM_ATTRIBUTES = {
  Tops: {
    names: [
      "Cashmere Sweater",
      "Silk Blouse",
      "Ribbed Tank",
      "Poplin Shirt",
      "Merino Turtleneck",
      "Oversized Cardigan",
    ],
    images: [
      "https://images.unsplash.com/photo-1580331451062-99ff652288d7?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1434389678369-182cb148f321?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551028719-0c169b1fa851?w=800&auto=format&fit=crop&q=80",
    ],
  },
  Bottoms: {
    names: ["Gabardine Trousers", "Pleated Midi Skirt", "Straight Leg Jeans", "Silk Slip Skirt", "Wool Tailored Pants"],
    images: [
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80",
    ],
  },
  Outerwear: {
    names: ["Madame Camel Coat", "Oversized Blazer", "Double-breasted Trench", "Shearling Jacket", "Wool Peacoat"],
    images: [
      "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&auto=format&fit=crop&q=80",
    ],
  },
  Shoes: {
    names: ["Flow Runner Sneakers", "Leather Loafers", "Suede Ankle Boots", "Minimalist Mules", "Ballet Flats"],
    images: [
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80",
    ],
  },
};

const generateBatchData = (count: number) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)] as keyof typeof ITEM_ATTRIBUTES;
    const brand = BRANDS[Math.floor(Math.random() * BRANDS.length)];
    const nameStr = ITEM_ATTRIBUTES[category].names[Math.floor(Math.random() * ITEM_ATTRIBUTES[category].names.length)];
    const imageUrl =
      ITEM_ATTRIBUTES[category].images[Math.floor(Math.random() * ITEM_ATTRIBUTES[category].images.length)];

    // Generate a realistic luxury price between $450 and $4500
    const priceNum = Math.floor(Math.random() * (4500 - 450 + 1)) + 450;
    const priceStr = priceNum.toLocaleString("en-US");

    items.push({
      title: `${brand} ${nameStr}`, // Ensures unique-sounding titles like "The Row Cashmere Sweater"
      brand: brand,
      price: priceStr,
      category: category,
      image_url: imageUrl,
      product_link: "#",
    });
  }
  return items;
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleRestockLibrary = async () => {
    setIsSeeding(true);
    const toastId = toast.loading("Generating 500 items and pushing to database...");

    try {
      const massiveBatch = generateBatchData(500);

      // Supabase has a limit on how many rows you can insert at once,
      // so we chunk the 500 items into batches of 100 to be safe.
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
      setIsSeeding(false);
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
            <h2 className="text-lg font-bold text-foreground font-outfit">Mass Restock (500 Items)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Generate 500 unique luxury items on the fly and chunk-upload them to the live database.
            </p>
          </div>

          <Button
            onClick={handleRestockLibrary}
            disabled={isSeeding}
            className="w-full rounded-xl gap-2 h-12 text-md font-semibold"
          >
            {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
            {isSeeding ? "Pushing 500 Items..." : "Generate & Restock 500 Items"}
          </Button>
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminPage;
