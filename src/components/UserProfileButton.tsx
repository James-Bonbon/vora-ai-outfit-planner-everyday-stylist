import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const UserProfileButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => navigate("/profile")}
      className="rounded-full shadow-sm bg-card border-border hover:scale-105 transition-transform shrink-0"
    >
      <User className="w-4 h-4" />
    </Button>
  );
};

export default UserProfileButton;
