import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const termsItems = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using VORA, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the application. We reserve the right to update these terms at any time, and continued use constitutes acceptance of the revised terms.",
  },
  {
    id: "account",
    title: "2. Account & Eligibility",
    content:
      "You must be at least 16 years old to use VORA. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate information during registration.",
  },
  {
    id: "subscription",
    title: "3. VORA Pro Subscription",
    content:
      "VORA Pro is a paid subscription at $9.99/month, billed through Stripe. You may cancel at any time from your Profile settings. Cancellation takes effect at the end of the current billing cycle. Refunds are not provided for partial billing periods.",
  },
  {
    id: "ai-features",
    title: "4. AI-Powered Features",
    content:
      "VORA uses AI to generate styling suggestions, virtual try-on images, garment care guidance, and skincare analysis. AI-generated content is provided for informational purposes only and should not be considered professional advice. Results may vary and are not guaranteed to be accurate.",
  },
  {
    id: "user-content",
    title: "5. User Content & Uploads",
    content:
      "You retain ownership of all photos and content you upload to VORA. By uploading content, you grant VORA a limited license to process and display your content solely for the purpose of providing the service. We do not sell or share your content with third parties.",
  },
  {
    id: "prohibited",
    title: "6. Prohibited Use",
    content:
      "You may not use VORA for any unlawful purpose, to upload harmful or offensive content, to attempt to reverse-engineer our AI models, or to interfere with the service's operation. Violation may result in account termination.",
  },
  {
    id: "liability",
    title: "7. Limitation of Liability",
    content:
      "VORA is provided \"as is\" without warranty of any kind. We are not liable for any damages arising from your use of the service, including but not limited to garment damage from following AI care suggestions. Always verify care instructions with the garment manufacturer.",
  },
  {
    id: "termination",
    title: "8. Termination",
    content:
      "We may suspend or terminate your account at our discretion if you violate these terms. You may delete your account at any time from the Profile settings, which will permanently remove all your data from our systems.",
  },
];

const privacyItems = [
  {
    id: "data-collection",
    title: "1. Data We Collect",
    content:
      "We collect: account information (name, email via Google OAuth), profile data (body measurements, body shape), photos you upload (selfies, garment images, product photos), and usage data (feature interactions, preferences). We do not collect location data or contacts.",
  },
  {
    id: "biometric",
    title: "2. Biometric Data & Consent",
    content:
      "Your selfie and body measurements are used solely for AI styling features such as virtual try-on. These images are processed by our AI to generate outfit visualizations. Your images are NOT stored as biometric identifiers and are NOT used for facial recognition. You must provide explicit consent before any image processing occurs.",
  },
  {
    id: "data-use",
    title: "3. How We Use Your Data",
    content:
      "Your data is used to: provide personalized styling and care recommendations, generate virtual try-on images, build skincare routines, and improve our AI models. We do not sell your personal data to third parties. Anonymous, aggregated data may be used to improve our service.",
  },
  {
    id: "data-storage",
    title: "4. Data Storage & Security",
    content:
      "All data is stored securely using industry-standard encryption. Photos are stored in encrypted cloud storage and are never stored in our database directly. We use Supabase for secure authentication and data management with Row Level Security (RLS) policies ensuring you can only access your own data.",
  },
  {
    id: "ai-processing",
    title: "5. AI Processing",
    content:
      "Your photos and garment data are sent to AI models (Google Gemini) for processing features like auto-tagging, virtual try-on, and care guidance. These AI interactions are stateless — the AI does not retain your images after processing. Generated images are stored only in your personal account.",
  },
  {
    id: "third-party",
    title: "6. Third-Party Services",
    content:
      "VORA uses the following third-party services: Google OAuth (authentication), Stripe (payment processing), Google Gemini AI (image and text processing), and Supabase (database and storage). Each service has its own privacy policy. We share only the minimum data necessary for each service to function.",
  },
  {
    id: "your-rights",
    title: "7. Your Rights (GDPR & CCPA)",
    content:
      "You have the right to: access all data we store about you, correct inaccurate data, delete all your data (\"Right to be Forgotten\"), export your data in a portable format, and withdraw consent for image processing at any time. Use the \"Delete My Data\" button in Profile settings to exercise your deletion rights.",
  },
  {
    id: "retention",
    title: "8. Data Retention",
    content:
      "We retain your data for as long as your account is active. Upon account deletion, all personal data, photos, and generated images are permanently deleted within 30 days. Payment records may be retained as required by financial regulations.",
  },
  {
    id: "contact",
    title: "9. Contact & Updates",
    content:
      "For privacy-related inquiries, contact us at privacy@vora.app. We will notify you of material changes to this policy via email or in-app notification. This policy was last updated on February 15, 2026.",
  },
];

const LegalPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-safe pb-10">
      <div className="max-w-lg mx-auto pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl min-w-[44px] min-h-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Legal</h1>
        </div>

        <Tabs defaultValue="terms" className="w-full">
          <TabsList className="w-full bg-secondary rounded-xl h-11">
            <TabsTrigger
              value="terms"
              className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm font-medium"
            >
              Terms of Service
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm font-medium"
            >
              Privacy Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terms" className="mt-5">
            <p className="text-xs text-muted-foreground mb-4">
              Last updated: February 15, 2026
            </p>
            <Accordion type="multiple" className="space-y-2">
              {termsItems.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="glass-card rounded-xl border-0 px-4"
                >
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="privacy" className="mt-5">
            <p className="text-xs text-muted-foreground mb-4">
              Last updated: February 15, 2026
            </p>
            <Accordion type="multiple" className="space-y-2">
              {privacyItems.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="glass-card rounded-xl border-0 px-4"
                >
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                    {item.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LegalPage;
