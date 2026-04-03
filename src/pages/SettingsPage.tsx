import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, FileText, Shield, Loader2, CalendarDays, CheckCircle2, RefreshCw, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GlassCard from "@/components/GlassCard";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [isConnecting, setIsConnecting] = useState<'google' | 'apple' | null>(null);
  const [appleUrl, setAppleUrl] = useState("");
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isAppleConnected, setIsAppleConnected] = useState(false);

  const handleGoogleConnect = async () => {
    setIsConnecting('google');
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar.readonly',
        }
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Failed to connect Google Calendar");
      setIsConnecting(null);
    }
  };

  const handleAppleConnect = async () => {
    if (!appleUrl.includes("webcal://") && !appleUrl.startsWith("http")) {
      toast.error("Please enter a valid iCloud Calendar URL (must start with webcal:// or https://)");
      return;
    }
    setIsConnecting('apple');
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ apple_calendar_url: appleUrl } as any)
        .eq('user_id', user!.id);
      if (error) throw error;
      setIsAppleConnected(true);
      toast.success("Apple Calendar successfully linked!");
      setAppleUrl("");
    } catch (err: any) {
      toast.error("Failed to save Apple Calendar link");
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Account deleted. Goodbye!");
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-safe pb-10">
      <div className="max-w-lg mx-auto pt-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl min-w-[44px] min-h-[44px]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground font-outfit">Settings</h1>
        </div>

        {/* Legal Links */}
        <GlassCard className="p-0 divide-y divide-border">
          <button
            onClick={() => navigate("/legal")}
            className="flex items-center gap-3 p-4 w-full text-left min-h-[52px]"
          >
            <FileText className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Terms of Service</span>
          </button>
          <button
            onClick={() => navigate("/legal?tab=privacy")}
            className="flex items-center gap-3 p-4 w-full text-left min-h-[52px]"
          >
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Privacy Policy</span>
          </button>
        </GlassCard>

        {/* ===== Integrations Section ===== */}
        <div className="mt-8 space-y-3">
          <div>
            <h3 className="text-lg font-bold text-foreground font-outfit">Integrations</h3>
            <p className="text-xs text-muted-foreground">Sync your schedule for smarter AI outfit recommendations.</p>
          </div>

          <GlassCard className="p-4 flex flex-col gap-5">
            
            {/* Google Calendar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground font-outfit">Google Calendar</h4>
                  <p className="text-xs text-muted-foreground">{isGoogleConnected ? 'Connected' : 'Sync via Google Sign-In'}</p>
                </div>
              </div>
              <Button 
                variant={isGoogleConnected ? "outline" : "default"}
                size="sm"
                className="rounded-xl text-xs px-4"
                onClick={handleGoogleConnect}
                disabled={isConnecting === 'google' || isGoogleConnected}
              >
                {isConnecting === 'google' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : isGoogleConnected ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : 'Connect'}
              </Button>
            </div>

            <div className="h-px w-full bg-border" />

            {/* Apple Calendar */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-foreground">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm3.172 14.138c-.352.128-.84.288-1.464.288-1.956 0-3.324-1.224-3.324-3.564 0-2.316 1.488-3.792 3.612-3.792.516 0 1 .12 1.344.252l-.42 1.284c-.24-.096-.588-.18-.948-.18-1.26 0-2.076.816-2.076 2.412 0 1.44.744 2.22 1.956 2.22.456 0 .828-.096 1.104-.204l.216 1.284zM16.52 16h-1.44V8.304h1.44V16z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground font-outfit">Apple Calendar</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Paste your public iCloud Calendar link to sync events. (Open iOS Calendar app &gt; Calendars &gt; 'i' icon &gt; Public Calendar)</p>
                </div>
              </div>
              
              {!isAppleConnected && (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={appleUrl}
                    onChange={(e) => setAppleUrl(e.target.value)}
                    placeholder="webcal://p123-caldav.icloud..." 
                    className="flex-1 text-xs rounded-xl bg-muted border border-border px-3 py-2 outline-none focus:border-primary transition-colors"
                  />
                  <Button 
                    size="sm"
                    className="rounded-xl text-xs px-4"
                    onClick={handleAppleConnect}
                    disabled={isConnecting === 'apple' || appleUrl.length < 10}
                  >
                    {isConnecting === 'apple' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-4 h-4" />}
                  </Button>
                </div>
              )}
              {isAppleConnected && (
                <div className="flex items-center gap-1.5 text-green-500 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Actively syncing
                </div>
              )}
            </div>

          </GlassCard>
        </div>

        {/* Danger Zone */}
        <div className="pt-4">
          <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-3">
            Danger Zone
          </h3>
          <GlassCard className="p-5 border-destructive/20">
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account, wardrobe, looks, and all associated data. This action cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full rounded-xl gap-2" disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-outfit">Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove all your data including your wardrobe, looks, beauty products, and profile. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
