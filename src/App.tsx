import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ThemeProvider from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Landing from "./pages/Landing";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Auto-retry lazy imports once on failure (handles stale chunk hashes after deploys/HMR).
const lazyWithRetry = <T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    const isChunkError = (err: any) => {
      const msg = String(err?.message || "");
      return (
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module")
      );
    };

    try {
      return await factory();
    } catch (err: any) {
      if (isChunkError(err)) {
        // First retry: try once more in-place after a short delay (handles transient network blips)
        try {
          await new Promise((r) => setTimeout(r, 400));
          return await factory();
        } catch (err2: any) {
          if (isChunkError(err2)) {
            const key = "vora_chunk_reload";
            const last = Number(sessionStorage.getItem(key) || "0");
            // Allow another reload if more than 10s since last attempt (avoid infinite loops)
            if (Date.now() - last > 10_000) {
              sessionStorage.setItem(key, String(Date.now()));
              window.location.reload();
              return new Promise(() => {}) as any;
            }
          }
          throw err2;
        }
      }
      throw err;
    }
  });

const WelcomePage = lazyWithRetry(() => import("./pages/WelcomePage"));
const UnsubscribePage = lazyWithRetry(() => import("./pages/UnsubscribePage"));
const LegalPage = lazyWithRetry(() => import("./pages/LegalPage"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const SubscriptionPage = lazyWithRetry(() => import("./pages/SubscriptionPage"));
const AdminPage = lazyWithRetry(() => import("./pages/AdminPage"));
const HomePage = lazyWithRetry(() => import("./pages/HomePage"));
const WardrobePage = lazyWithRetry(() => import("./pages/WardrobePage"));
const MirrorPage = lazyWithRetry(() => import("./pages/MirrorPage"));
const BeautyPage = lazyWithRetry(() => import("./pages/BeautyPage"));
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"));
const OnboardingPage = lazyWithRetry(() => import("./pages/OnboardingPage"));
const LibraryPage = lazyWithRetry(() => import("./pages/LibraryPage"));
const CommunityPage = lazyWithRetry(() => import("./pages/CommunityPage"));
const StyleAnalytics = lazyWithRetry(() => import("./pages/StyleAnalytics"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute skipOnboarding><OnboardingPage /></ProtectedRoute>} />
              
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/wardrobe" element={<WardrobePage />} />
                <Route path="/mirror" element={<MirrorPage />} />
                <Route path="/feed" element={<CommunityPage />} />
                <Route path="/beauty" element={<BeautyPage />} />
                <Route path="/profile" element={<ProfilePage />} />
<Route path="/library" element={<LibraryPage />} />
                <Route path="/style-stats" element={<StyleAnalytics />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
