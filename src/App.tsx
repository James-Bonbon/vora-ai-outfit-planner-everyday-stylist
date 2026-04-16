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

// Lazy-load all non-landing routes to keep the initial bundle small.
// Landing + AppLayout + ProtectedRoute stay eager so the first paint and
// auth-gated routing remain functionally identical.
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SubscriptionPage = lazy(() => import("./pages/SubscriptionPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const WardrobePage = lazy(() => import("./pages/WardrobePage"));
const MirrorPage = lazy(() => import("./pages/MirrorPage"));
const BeautyPage = lazy(() => import("./pages/BeautyPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
