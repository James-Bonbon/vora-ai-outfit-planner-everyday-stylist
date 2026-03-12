import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const UserProfileButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/profile')}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:bg-muted text-muted-foreground transition-colors shrink-0"
    >
      <User className="w-[19px] h-[19px] stroke-[1.5]" />
    </button>
  );
};

export default UserProfileButton;
