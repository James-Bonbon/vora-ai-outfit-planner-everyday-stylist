import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Database, Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BATCH_01_GARMENTS = [
  {
    title: "Cashmere Turtleneck Sweater",
    brand: "Loro Piana",
    price: "1,450",
    category: "Tops",
    image_url: "https://images.unsplash.com/photo-1580331451062-99ff652288d7?w=800&auto=format&fit=crop&q=80",
    product_link: "#",
  },
  {
    title: "Wool Gabardine Trousers",
    brand: "The Row",
    price: "990",
    category: "Bottoms",
    image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80",
    product_link: "#",
  },
  {
    title: "Madame Camel Coat",
    brand: "Max Mara",
    price: "3,890",
    category: "Outerwear",
    image_url: "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=800&auto=format&fit=crop&q=80",
    product_link: "#",
  },
  {
    title: "Flow Runner Sneakers",
    brand: "Loewe",
    price: "790",
    category: "Shoes",
    image_url: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&auto=format&fit=crop&q=80",
    product_link: "#",
  },
  {
    title: "Silk Charmeuse Blouse",
    brand: "Khaite",
    price: "880",
    category: "Tops",
    image_url: "https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?w=800&auto=format&fit=crop&q=80",
    product_link: "#",
  },
];

const AdminPage = () => {
  const navigate = useNavigate();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleRestockLibrary = async () => {
    setIsSeeding(true);
    try {
      // 1. Insert the items into the Supabase table
      const { error } = await supabase.from("trending_clothes").insert(BATCH_01_GARMENTS);

      if (error) throw error;

      toast.success("Library restocked successfully! ✨");
    } catch (err: any) {
      console.error("Restock error:", err);
      toast.error(`Failed to restock: ${err.message}`);
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
            <h2 className="text-lg font-bold text-foreground font-outfit">Library Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Push the VORA Batch 01 catalog to the live database. This will immediately populate the Wishlist / Library
              tab for all users.
            </p>
          </div>

          <Button
            onClick={handleRestockLibrary}
            disabled={isSeeding}
            className="w-full rounded-xl gap-2 h-12 text-md font-semibold"
          >
            {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackagePlus className="w-5 h-5" />}
            {isSeeding ? "Pushing Data..." : "Restock Garment Library"}
          </Button>
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminPage;
