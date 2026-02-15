interface BodyShapeIconProps {
  shape: string;
  className?: string;
}

const BodyShapeIcon = ({ shape, className = "" }: BodyShapeIconProps) => {
  const color = "hsl(var(--primary))";
  
  const icons: Record<string, JSX.Element> = {
    balanced: (
      <svg viewBox="0 0 48 48" fill="none" className={className} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* Head */}
        <circle cx="24" cy="10" r="4" />
        {/* Shoulders */}
        <line x1="14" y1="20" x2="34" y2="20" />
        {/* Body */}
        <line x1="18" y1="20" x2="18" y2="34" />
        <line x1="30" y1="20" x2="30" y2="34" />
        {/* Hips */}
        <line x1="14" y1="34" x2="34" y2="34" />
        {/* Neck */}
        <line x1="24" y1="14" x2="24" y2="20" />
      </svg>
    ),
    shoulders_wider: (
      <svg viewBox="0 0 48 48" fill="none" className={className} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* Head */}
        <circle cx="24" cy="10" r="4" />
        {/* Neck */}
        <line x1="24" y1="14" x2="24" y2="18" />
        {/* Inverted triangle */}
        <path d="M10 18 L38 18 L30 38 L18 38 Z" />
      </svg>
    ),
    hips_wider: (
      <svg viewBox="0 0 48 48" fill="none" className={className} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* Head */}
        <circle cx="24" cy="10" r="4" />
        {/* Neck */}
        <line x1="24" y1="14" x2="24" y2="18" />
        {/* Triangle */}
        <path d="M18 18 L30 18 L38 38 L10 38 Z" />
      </svg>
    ),
    midsection_fuller: (
      <svg viewBox="0 0 48 48" fill="none" className={className} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* Head */}
        <circle cx="24" cy="10" r="4" />
        {/* Neck */}
        <line x1="24" y1="14" x2="24" y2="18" />
        {/* Oval/waist shape */}
        <ellipse cx="24" cy="28" rx="12" ry="10" />
      </svg>
    ),
    curvy: (
      <svg viewBox="0 0 48 48" fill="none" className={className} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {/* Head */}
        <circle cx="24" cy="10" r="4" />
        {/* Neck */}
        <line x1="24" y1="14" x2="24" y2="17" />
        {/* Hourglass outline */}
        <path d="M14 17 C14 17 14 25 24 27 C34 25 34 17 34 17" />
        <path d="M14 39 C14 39 14 31 24 29 C34 31 34 39 34 39" />
        <line x1="14" y1="17" x2="14" y2="17" />
        <line x1="34" y1="17" x2="34" y2="17" />
      </svg>
    ),
  };

  return icons[shape] || null;
};

export default BodyShapeIcon;
