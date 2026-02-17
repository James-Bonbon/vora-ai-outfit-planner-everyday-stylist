import { cn } from "@/lib/utils";

interface VoraLogoProps {
  className?: string;
}

const VoraLogo = ({ className }: VoraLogoProps) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      shapeRendering="geometricPrecision"
    >
      {/* Hanger hook */}
      <path
        d="M32 6 C32 6, 38 6, 38 12 C38 16, 34 18, 32 18"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* V shape (hanger body) */}
      <path
        d="M12 22 L32 52 L52 22"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default VoraLogo;
