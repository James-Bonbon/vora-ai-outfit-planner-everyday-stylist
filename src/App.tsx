import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import LegalPage from "./pages/LegalPage";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import WardrobePage from "./pages/WardrobePage";
import MirrorPage from "./pages/MirrorPage";
import BeautyPage from "./pages/BeautyPage";
import ProfilePage from "./pages/ProfilePage";
import OnboardingPage from "./pages/OnboardingPage";
import LibraryPage from "./pages/LibraryPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="/onboarding" element={<ProtectedRoute skipOnboarding><OnboardingPage /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/mirror" element={<MirrorPage />} />
            <Route path="/beauty" element={<BeautyPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/library" element={<LibraryPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
