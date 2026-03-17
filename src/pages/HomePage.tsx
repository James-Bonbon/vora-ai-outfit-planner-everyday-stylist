import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/GlassCard";
import SafeImage from "@/components/ui/SafeImage";
import { CalendarDays, DoorOpen, ExternalLink, HeartPulse, User } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { WeatherWidget } from "@/components/WeatherWidget";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import OutfitCalendar from "@/components/home/OutfitCalendar";
import UserProfileButton from "@/components/UserProfileButton";
import { OutfitCalendarSheet } from "@/components/calendar/OutfitCalendarSheet";
import { DiscoverFeed } from "@/components/feed/DiscoverFeed";


const TRENDING_FEMALE = [
  {
    name: "Pleated Midi Skirt",
    brand: "& Other Stories",
    price: "£69",
    image: "https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Leather Loafers",
    brand: "COS",
    price: "£109",
    image: "https://images.unsplash.com/photo-1610398752800-146f269dfcc8?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Cashmere Knit",
    brand: "Reiss",
    price: "£148",
    image: "https://images.unsplash.com/photo-1631541909061-71e349d1f203?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Wide Leg Trousers",
    brand: "Arket",
    price: "£59",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Silk Camisole",
    brand: "& Other Stories",
    price: "£45",
    image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Quilted Bag",
    brand: "Mango",
    price: "£35",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Linen Blazer",
    brand: "Arket",
    price: "£119",
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Chunky Gold Hoops",
    brand: "COS",
    price: "£29",
    image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Wrap Dress",
    brand: "Reiss",
    price: "£168",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Ankle Boots",
    brand: "AllSaints",
    price: "£199",
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Oversized Sunglasses",
    brand: "& Other Stories",
    price: "£25",
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Ribbed Tank Top",
    brand: "COS",
    price: "£19",
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Tailored Coat",
    brand: "Reiss",
    price: "£298",
    image: "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Satin Skirt",
    brand: "Mango",
    price: "£39",
    image: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Strappy Sandals",
    brand: "& Other Stories",
    price: "£79",
    image: "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Cropped Cardigan",
    brand: "Arket",
    price: "£65",
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cda3a30?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "High-Waist Jeans",
    brand: "COS",
    price: "£79",
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Pearl Necklace",
    brand: "Reiss",
    price: "£55",
    image: "https://images.unsplash.com/photo-1515562141589-67f0d569b6c4?w=300&h=400&fit=crop",
    link: "#",
  },
];

const TRENDING_MALE = [
  {
    name: "Oversized Blazer",
    brand: "Reiss",
    price: "£228",
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Chelsea Boots",
    brand: "COS",
    price: "£150",
    image: "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Merino Polo",
    brand: "Arket",
    price: "£55",
    image: "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Slim Chinos",
    brand: "Ted Baker",
    price: "£89",
    image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Denim Jacket",
    brand: "AllSaints",
    price: "£158",
    image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "White Sneakers",
    brand: "COS",
    price: "£89",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Wool Overcoat",
    brand: "Reiss",
    price: "£348",
    image: "https://images.unsplash.com/photo-1544923246-77307dd270b5?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Oxford Shirt",
    brand: "Arket",
    price: "£49",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Suede Loafers",
    brand: "Ted Baker",
    price: "£120",
    image: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Linen Trousers",
    brand: "COS",
    price: "£69",
    image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Leather Belt",
    brand: "Reiss",
    price: "£55",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Crew Neck Jumper",
    brand: "Arket",
    price: "£59",
    image: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Cargo Trousers",
    brand: "AllSaints",
    price: "£109",
    image: "https://images.unsplash.com/photo-1517438476312-10d79c077509?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Aviator Sunglasses",
    brand: "& Other Stories",
    price: "£29",
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Harrington Jacket",
    brand: "Ted Baker",
    price: "£195",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Canvas Tote",
    brand: "COS",
    price: "£35",
    image: "https://images.unsplash.com/photo-1622560480654-996b3d2e3a82?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Knit Beanie",
    brand: "Arket",
    price: "£19",
    image: "https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=300&h=400&fit=crop",
    link: "#",
  },
  {
    name: "Track Pants",
    brand: "Reiss",
    price: "£78",
    image: "https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=300&h=400&fit=crop",
    link: "#",
  },
];

/** Deterministic daily shuffle: pick `count` items seeded by day-of-year */
function getDailyItems<T>(items: T[], count: number): T[] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  // Simple seeded pseudo-random using day-of-year
  const seed = dayOfYear * 2654435761; // Knuth multiplicative hash
  const shuffled = items.map((item, i) => ({
    item,
    sort: ((seed + i * 2654435761) >>> 0) % 1000000,
  }));
  shuffled.sort((a, b) => a.sort - b.sort);
  return shuffled.slice(0, count).map((s) => s.item);
}
const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [closetCount, setClosetCount] = useState(0);
  const [beautyCount, setBeautyCount] = useState(0);
  const [userSex, setUserSex] = useState<string | null>(null);
  
  const { weather, loading: weatherLoading } = useWeather();

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    const [{ count: wardrobeCount }, { count: beautyItemCount }, { data: profileData }] = await Promise.all([
      supabase.from("closet_items").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("beauty_products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("profiles").select("sex").eq("user_id", user.id).maybeSingle(),
    ]);
    if (wardrobeCount !== null) setClosetCount(wardrobeCount);
    if (beautyItemCount !== null) setBeautyCount(beautyItemCount);
    if (profileData?.sex) setUserSex(profileData.sex);
  }, [user]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const trendingItems = getDailyItems(userSex === "male" ? TRENDING_MALE : TRENDING_FEMALE, 8);

  return (
    <div className="pt-6 space-y-5 pb-4">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between h-10">
        <h1 className="text-2xl font-bold text-foreground font-outfit">Outfit Calendar</h1>
        <div className="flex items-center gap-2">
          <WeatherWidget weather={weather} loading={weatherLoading} />
          <button
            onClick={() => setIsCalendarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:bg-muted text-muted-foreground transition-colors shrink-0"
          >
            <CalendarDays className="!w-6 !h-6 stroke-[1.5]" />
          </button>
          <UserProfileButton />
        </div>
      </div>

      {/* ===== Outfit Calendar (Top Widget) ===== */}
      <div>
        <OutfitCalendar />
      </div>

      {/* ===== Quick Access Cards ===== */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="flex flex-col gap-3 p-4" glowOnHover onClick={() => navigate("/wardrobe")}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm font-outfit">Wardrobe</h3>
            <p className="text-xs text-muted-foreground">{closetCount} Items</p>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3 p-4" glowOnHover onClick={() => navigate("/beauty")}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm font-outfit">Beauty</h3>
            <p className="text-xs text-muted-foreground">{beautyCount} Items</p>
          </div>
        </GlassCard>
      </div>

      {/* ===== Trending Items ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground font-outfit">From Our Partners</h3>
          <span className="text-xs text-muted-foreground">8 picks · refreshes daily</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {trendingItems.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="shrink-0 w-[150px] group">
              <GlassCard className="p-0 overflow-hidden">
                <div className="aspect-[3/4] bg-muted relative">
                  <SafeImage
                    src={item.image}
                    alt={item.name}
                    aspectRatio=""
                    wrapperClassName="w-full h-full"
                    loading="lazy"
                  />
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3 h-3 text-foreground" />
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] text-primary font-medium uppercase tracking-wide">{item.brand}</p>
                  <p className="text-xs font-medium text-foreground truncate mt-0.5">{item.name}</p>
                  <p className="text-sm font-bold text-foreground mt-1">{item.price}</p>
                </div>
              </GlassCard>
            </a>
          ))}
        </div>
      </div>
      <OutfitCalendarSheet isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} />
    </div>
  );
};

export default HomePage;
