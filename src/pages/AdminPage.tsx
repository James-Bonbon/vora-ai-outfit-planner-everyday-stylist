import { useNavigate } from "react-router-dom";
import { ArrowLeft, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";

const AdminPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-safe pb-10">
      <div className="max-w-lg mx-auto pt-4 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl min-w-[44px] min-h-[44px]" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground font-outfit">Admin Dashboard</h1>
        </div>

        <GlassCard className="p-8 flex flex-col items-center gap-4 text-center">
          <HardHat className="w-12 h-12 text-primary" />
          <h2 className="text-lg font-bold text-foreground font-outfit">Construction Zone</h2>
          <p className="text-sm text-muted-foreground">The Admin Dashboard is under construction. Check back soon!</p>
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminPage;
