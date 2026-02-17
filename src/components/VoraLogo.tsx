import { cn } from "@/lib/utils";

interface VoraLogoProps {
  className?: string;
}

const VoraLogo = ({ className }: VoraLogoProps) => {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
    >
      {/* Hanger hook – smooth cubic Bézier */}
      <path
        d="M128 24 C128 24, 152 24, 152 48 C152 64, 140 72, 128 72"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      {/* V shape (hanger body) – clean lines */}
      <path
        d="M48 88 L128 208 L208 88"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default VoraLogo;
