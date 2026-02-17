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
      // This forces the browser to calculate curves precisely, reducing blur
      shapeRendering="geometricPrecision"
      className={cn("text-primary", className)}
    >
      {/* Hanger hook - Refined curve for 24px grid */}
      <path
        d="M12 3C12 3 14.5 3 14.5 5.5C14.5 7.5 13 8 12 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* V shape - Clean coordinates */}
      <path
        d="M4.5 10 L12 21 L19.5 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

export default VoraLogo;
