import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import { Sparkles, DoorOpen, Heart, ArrowRight, ExternalLink, HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero-stylist.jpg";

const FASHION_QUOTES = [
  { quote: "Fashion is the armor to survive the reality of everyday life.", author: "Bill Cunningham" },
  { quote: "Style is a way to say who you are without having to speak.", author: "Rachel Zoe" },
  { quote: "Dress shabbily and they remember the dress; dress impeccably and they remember the woman.", author: "Coco Chanel" },
  { quote: "Fashion is about dressing according to what's fashionable. Style is more about being yourself.", author: "Oscar de la Renta" },
  { quote: "People will stare. Make it worth their while.", author: "Harry Winston" },
  { quote: "Elegance is elimination.", author: "Cristóbal Balenciaga" },
  { quote: "What you wear is how you present yourself to the world.", author: "Miuccia Prada" },
];

const TRENDING_ITEMS = [
  { name: "Oversized Blazer", brand: "Zara", price: 89.90, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&h=400&fit=crop", link: "#" },
  { name: "Leather Loafers", brand: "COS", price: 135.00, image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300&h=400&fit=crop", link: "#" },
  { name: "Cashmere Knit", brand: "& Other Stories", price: 119.00, image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300&h=400&fit=crop", link: "#" },
  { name: "Wide Leg Trousers", brand: "Arket", price: 79.00, image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300&h=400&fit=crop", link: "#" },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [closetCount, setClosetCount] = useState(0);
  const [dailyQuote, setDailyQuote] = useState(FASHION_QUOTES[0]);

  useEffect(() => {
    // Pick quote based on day of year for consistency
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setDailyQuote(FASHION_QUOTES[dayOfYear % FASHION_QUOTES.length]);
  }, []);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("closet_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (count !== null) setClosetCount(count);
  }, [user]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return (
    <div className="pt-6 space-y-5 pb-4">
      {/* ===== HERO: AI Stylist Card ===== */}
      <GlassCard
        className="relative p-0 overflow-hidden rounded-2xl"
        glowOnHover
        onClick={() => navigate("/mirror")}
      >
        <div className="relative h-[280px]">
          <img
            src={heroImage}
            alt="AI Stylist"
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Badge */}
          <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wide">
            AI Stylist
          </span>

          {/* Sparkle icon top right */}
          <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          {/* Text overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className="text-3xl font-extrabold text-white font-outfit leading-tight">
              Plan My<br />Outfit
            </h2>
            <p className="text-sm text-white/80 mt-1.5 flex items-center gap-1">
              Get a fit check instantly <ArrowRight className="w-4 h-4" />
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ===== Quick Access Cards ===== */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard
          className="flex flex-col gap-3 p-4"
          glowOnHover
          onClick={() => navigate("/wardrobe")}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm font-outfit">Wardrobe</h3>
            <p className="text-xs text-muted-foreground">{closetCount} Items</p>
          </div>
        </GlassCard>

        <GlassCard
          className="flex flex-col gap-3 p-4"
          glowOnHover
          onClick={() => navigate("/beauty")}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm font-outfit">Beauty</h3>
            <p className="text-xs text-muted-foreground">{closetCount} Items</p>
          </div>
        </GlassCard>
      </div>

      {/* ===== Daily Inspo ===== */}
      <div className="relative rounded-2xl overflow-hidden p-5" style={{ background: "linear-gradient(135deg, hsl(16 62% 45%), hsl(16 62% 60%))" }}>
        <Heart className="absolute top-4 right-4 w-5 h-5 text-white/40" />
        <h3 className="text-lg font-bold text-white font-outfit">Daily Inspo</h3>
        <p className="text-sm text-white/80 mt-3 leading-relaxed italic">
          "{dailyQuote.quote}"
        </p>
        <p className="text-xs text-white/50 mt-2">— {dailyQuote.author}</p>
      </div>

      {/* ===== Trending Items ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground font-outfit">Trending For You</h3>
          <span className="text-xs text-muted-foreground">Based on your style</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {TRENDING_ITEMS.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 w-[150px] group"
            >
              <GlassCard className="p-0 overflow-hidden">
                <div className="aspect-[3/4] bg-muted relative">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3 text-foreground" />
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] text-primary font-medium uppercase tracking-wide">{item.brand}</p>
                  <p className="text-xs font-medium text-foreground truncate mt-0.5">{item.name}</p>
                  <p className="text-sm font-bold text-foreground mt-1">${item.price.toFixed(2)}</p>
                </div>
              </GlassCard>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
