/* ── Strict Type Definitions ──────────────────────────────── */

export interface Garment {
  id: string;
  category: "OUT" | "TOP" | "BOT" | "SHOE" | "ACC";
  name: string;
  brand: string;
  flat_lay_image_url: string;
}

export interface OutfitPost {
  id: string;
  username: string;
  main_image_url: string;
  description: string;
  likesCount: number;
  isLiked: boolean;
  outfit_breakdown: Garment[];
}

/* ── 10 Vision-Curated Outfits ───────────────────────────── */

export const FEED_ITEMS: OutfitPost[] = [
  /* ─── 1 · Female · Camel Coat Street Style ─────────────── */
  {
    id: "f1",
    username: "@minimal_edit",
    main_image_url:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=800",
    description: "Camel coat season. Layered neutrals in Brooklyn.",
    likesCount: 312,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "f1-g1",
        category: "OUT",
        name: "Belted Camel Coat",
        brand: "Totême",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f1-g2",
        category: "TOP",
        name: "Cream Ribbed Turtleneck",
        brand: "The Row",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f1-g3",
        category: "BOT",
        name: "Wide-Leg Tailored Trousers",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f1-g4",
        category: "SHOE",
        name: "Leather Chelsea Boots",
        brand: "Lemaire",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 2 · Male · Navy Overcoat Editorial ───────────────── */
  {
    id: "m1",
    username: "@ny_neutrals",
    main_image_url:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800",
    description: "Navy layers for the commute. Less is more.",
    likesCount: 245,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "m1-g1",
        category: "OUT",
        name: "Navy Wool Overcoat",
        brand: "Jil Sander",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m1-g2",
        category: "TOP",
        name: "White Cotton Crew Tee",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m1-g3",
        category: "BOT",
        name: "Charcoal Slim Trousers",
        brand: "Lemaire",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 3 · Female · All-Black Editorial ─────────────────── */
  {
    id: "f2",
    username: "@the_curated_wardrobe",
    main_image_url:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&q=80&w=800",
    description: "Head-to-toe black. The eternal uniform.",
    likesCount: 487,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "f2-g1",
        category: "OUT",
        name: "Structured Black Blazer",
        brand: "The Row",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f2-g2",
        category: "TOP",
        name: "Black Silk Camisole",
        brand: "Khaite",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f2-g3",
        category: "BOT",
        name: "High-Waist Black Trousers",
        brand: "Totême",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f2-g4",
        category: "SHOE",
        name: "Pointed Leather Mules",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 4 · Male · Earth Tone Casual ─────────────────────── */
  {
    id: "m2",
    username: "@studio_vora",
    main_image_url:
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=800",
    description: "Earthy tones, structured silhouettes.",
    likesCount: 198,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "m2-g1",
        category: "OUT",
        name: "Olive Cotton Chore Jacket",
        brand: "Lemaire",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m2-g2",
        category: "TOP",
        name: "Ecru Linen Shirt",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m2-g3",
        category: "BOT",
        name: "Tan Pleated Chinos",
        brand: "Jil Sander",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 5 · Female · White Dress Summer ──────────────────── */
  {
    id: "f3",
    username: "@kaelie_styles",
    main_image_url:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800",
    description: "Summer whites. Effortless and elevated.",
    likesCount: 523,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "f3-g1",
        category: "TOP",
        name: "Draped White Midi Dress",
        brand: "The Row",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f3-g2",
        category: "SHOE",
        name: "Strappy Leather Sandals",
        brand: "Khaite",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f3-g3",
        category: "ACC",
        name: "Woven Straw Tote",
        brand: "Totême",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 6 · Male · Minimal Monochrome ────────────────────── */
  {
    id: "m3",
    username: "@minimal_edit",
    main_image_url:
      "https://images.unsplash.com/photo-1480429370612-2cd0c2f04cca?auto=format&fit=crop&q=80&w=800",
    description: "Monochrome. Clean lines, zero noise.",
    likesCount: 167,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "m3-g1",
        category: "TOP",
        name: "Black Merino Crew Knit",
        brand: "Jil Sander",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1434389677669-e08b4cda3a76?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m3-g2",
        category: "BOT",
        name: "Black Straight-Leg Jeans",
        brand: "Totême",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m3-g3",
        category: "SHOE",
        name: "Black Leather Derbies",
        brand: "Lemaire",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 7 · Female · Trench Coat Classic ─────────────────── */
  {
    id: "f4",
    username: "@ny_neutrals",
    main_image_url:
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=800",
    description: "The perfect trench. Timeless Parisian energy.",
    likesCount: 401,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "f4-g1",
        category: "OUT",
        name: "Classic Beige Trench Coat",
        brand: "Totême",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f4-g2",
        category: "TOP",
        name: "Ivory Silk Blouse",
        brand: "The Row",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f4-g3",
        category: "BOT",
        name: "Navy Tailored Skirt",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f4-g4",
        category: "SHOE",
        name: "Nude Leather Pumps",
        brand: "Khaite",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 8 · Male · Smart Casual Layering ─────────────────── */
  {
    id: "m4",
    username: "@the_curated_wardrobe",
    main_image_url:
      "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&q=80&w=800",
    description: "Smart casual done right. Weekend to dinner.",
    likesCount: 289,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "m4-g1",
        category: "OUT",
        name: "Grey Cashmere Cardigan",
        brand: "The Row",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m4-g2",
        category: "TOP",
        name: "Light Blue Oxford Shirt",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m4-g3",
        category: "BOT",
        name: "Navy Wool Trousers",
        brand: "Jil Sander",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m4-g4",
        category: "SHOE",
        name: "Brown Suede Loafers",
        brand: "Lemaire",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 9 · Female · Scandi Minimalism ───────────────────── */
  {
    id: "f5",
    username: "@studio_vora",
    main_image_url:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&q=80&w=800",
    description: "Scandinavian restraint. Texture over colour.",
    likesCount: 356,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "f5-g1",
        category: "OUT",
        name: "Oatmeal Wool Coat",
        brand: "Totême",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f5-g2",
        category: "TOP",
        name: "Grey Cashmere Rollneck",
        brand: "The Row",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "f5-g3",
        category: "BOT",
        name: "Cream Wide-Leg Trousers",
        brand: "Lemaire",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },

  /* ─── 10 · Male · Weekend Minimal ──────────────────────── */
  {
    id: "m5",
    username: "@kaelie_styles",
    main_image_url:
      "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&q=80&w=800",
    description: "Off-duty ease. Weekend errands, still sharp.",
    likesCount: 134,
    isLiked: false,
    outfit_breakdown: [
      {
        id: "m5-g1",
        category: "TOP",
        name: "Stone Relaxed-Fit Tee",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m5-g2",
        category: "BOT",
        name: "Washed Khaki Chinos",
        brand: "Jil Sander",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&q=80&w=400",
      },
      {
        id: "m5-g3",
        category: "SHOE",
        name: "White Minimalist Sneakers",
        brand: "COS",
        flat_lay_image_url:
          "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=400",
      },
    ],
  },
];
