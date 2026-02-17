import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const LibraryPage = () => {
  const navigate = useNavigate();

  return (
    <div className="pt-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground font-outfit">Clothing Library</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">Coming soon — browse thousands of items to add to your Dream List.</p>
      </div>
    </div>
  );
};

export default LibraryPage;
