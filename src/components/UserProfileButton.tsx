import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const UserProfileButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      onClick={() => navigate("/profile")}
      className="w-9 h-9 p-0 rounded-full shadow-sm bg-card border-primary/20 hover:bg-primary/5 hover:scale-105 transition-all shrink-0 flex items-center justify-center text-primary"
    >
      <User className="w-6 h-6 stroke-[1.5]" />
    </Button>
  );
};

export default UserProfileButton;
