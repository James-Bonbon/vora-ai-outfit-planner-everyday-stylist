import { cn } from "@/lib/utils";

interface VoraLogoProps {
  className?: string;
}

const VoraLogo = ({ className }: VoraLogoProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
    >
      {/* Hanger hook */}
      <path
        d="M12 2C12 2 14 2 14 5C14 6 13 7 12 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* V shape (hanger body) */}
      <path
        d="M4 9 L12 20 L20 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default VoraLogo;
