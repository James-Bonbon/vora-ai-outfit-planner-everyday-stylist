

# VORA — Complete Implementation Plan

## Phase 1: Design System & UI Shell
Build the visual foundation — no backend, zero risk of errors.

- **Theme**: OLED Black (`#000000`) background, Cyber Lime (`#CCFF00`) accents across all CSS variables
- **Glassmorphism Components**: Reusable bento-grid cards with semi-transparent blur, lime borders, and subtle glow effects
- **Bottom Tab Bar**: Native-style fixed navigation with 5 tabs — **Home, Wardrobe, AI Mirror, Beauty, Profile** — with active state highlighting in Cyber Lime
- **Safe Area Handling**: Padding for iPhone Dynamic Island, notch, home indicator, and Android punch-hole cameras
- **Page Shells**: All 5 tab pages created with placeholder content and smooth transitions
- **Landing Page**: Bold VORA branding on pure black with a "Join VORA with Google" CTA button
- **Touch Targets**: All interactive elements minimum 44×44px
- **App Assets**: Placeholder app icon (1024×1024) and splash screen layout

---

## Phase 2: Authentication & Legal Compliance
Connect Supabase with Google OAuth and implement required consent flows.

- **Google OAuth**: "Join VORA with Google" button on landing page
- **Protected Routes**: Redirect unauthenticated users to landing
- **Biometric Consent Modal**: Mandatory toggle before any image processing features — *"Your images are used solely for AI styling and are not stored as biometric data."*
- **Settings Page**: "Delete My Data" button for GDPR compliance, account management
- **Profiles Table**: Supabase table linked to auth users for storing all user data

---

## Phase 3: Onboarding & Profile Setup
Guided 3-step flow after first login.

- **Step 1 — Selfie Upload**: Capture or upload a reference photo (stored in Supabase Storage, never in DB)
- **Step 2 — Personal Info**: Name, DOB, Sex, Height, Weight
- **Step 3 — Body Shape Selector**: Visual icon cards — Hourglass, Pear, Athletic, Rectangle, Round
- **Profile saved** to `profiles` table, editable from Profile tab

---

## Phase 4: Smart Closet (Wardrobe Tab)
The core garment management system.

- **Closet Grid**: Bento-style card layout displaying all saved clothing items
- **Add Item via Photo**: Upload clothing photo → Gemini Vision AI auto-tags **category, color, material, and brand**
- **Manual Edit**: Form fallback to correct or add item details
- **Category Filters**: Tops, Bottoms, Shoes, Accessories, Outerwear
- **Garment Detail Page**: Full-screen view of each item with material, brand, color info
- **Storage**: Item images in Supabase Storage, metadata in `closet_items` table

### 4a: "Wash It" — Laundry Care Modal *(Pro Feature)*
- **Laundry Care Modal** opens from garment detail page
- **Visual Laundry Symbols**: Digital icons for water temp, ironing, bleaching, drying
- **"VORA Warning: What NOT to Do"**: Red-highlighted danger section (e.g., "NEVER tumble dry")
- **"Scan Tag" Button**: If care data is missing, user photographs the garment's care label → Gemini Vision reads symbols and saves them

### 4b: "Help Me Clean" — AI Stain Removal *(Pro Feature)*
- **Stain/Dirt Menu**: User selects stain type — Red Wine, Coffee, Sweat, Grease, Makeup, Ink, Mud, Blood
- **AI-Powered Guide**: Based on the garment's stored **material** (Silk, Cotton, Polyester, etc.) + selected stain, Gemini generates a step-by-step safe removal guide
- **Example Output**: *"For this Silk blouse with a Red Wine stain: 1) Blot immediately with a clean cloth. 2) Apply cold water — do NOT rub. 3) Use a drop of mild detergent. 4) Air dry only."*

---

## Phase 5: AI Virtual Try-On (AI Mirror Tab)
Photorealistic 2D outfit visualization using Gemini image generation.

- **Try-On Flow**: User selects garment(s) from closet → combined with their reference selfie → Gemini generates a realistic composite image of the user wearing the outfit
- **"Style Me" Prompt**: User picks an occasion (Casual, Date Night, Work, Party) → AI selects items from their closet and generates the look
- **Look Gallery**: Save, browse, and compare generated outfit images
- **Saved Looks**: `looks` table in Supabase, generated images in Storage

> **Note on AI Video "Catwalk"**: Since we're using Lovable AI (Gemini) without external video APIs, the Catwalk motion feature will be deferred to a future phase when external API integration is added. The Mirror tab will focus on high-quality still try-on images.

---

## Phase 6: Beauty & Skincare Concierge (Beauty Tab)
AI-powered skincare and makeup management.

- **Product Scan**: Upload product photo → Gemini identifies product name, brand, type, and key active ingredients
- **Product Inventory**: Grid view of all scanned beauty products
- **AI Routine Builder**: Visual step-by-step timeline — Cleanser → Toner → Serum → Moisturizer → SPF
- **"Why This Works"**: Educational snippet for each step explaining ingredient benefits
- **Gap Analysis**: AI detects missing critical steps (e.g., no SPF, no serum) and recommends products in the user's price bracket

---

## Phase 7: Monetization — VORA Pro (Stripe)
Subscription management and feature gating.

- **VORA Pro**: $9.99/month via Stripe
- **Free Tier**: Browse closet (limited items), view basic garment info, onboarding
- **Pro-Gated Features**:
  - "Wash It" laundry care guide
  - "Help Me Clean" AI stain removal
  - AI Virtual Try-On (Mirror tab)
  - Unlimited wardrobe items
  - Full beauty routine analysis & gap detection
- **Upgrade Prompts**: Sleek Cyber Lime upgrade cards when free users tap locked features
- **Subscription Management**: Cancel/manage in Profile settings

---

## Architecture Summary
| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind CSS (PWA) |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| AI | Lovable AI Gateway → Gemini (Vision, Text, Image Gen) |
| Payments | Stripe (subscriptions) |
| Storage | Supabase Storage (all user photos, garment images, generated images) |

