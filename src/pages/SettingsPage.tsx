import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

        {/* Integrations */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Integrations
          </h3>
          <GlassCard className="p-0">
            <div className="flex items-center justify-between p-4 min-h-[52px]">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Google Calendar</span>
              </div>
              <Switch
                checked={false}
                onCheckedChange={() => {
                  toast.info("Calendar integration requires OAuth configuration. Coming soon.");
                }}
              />
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
