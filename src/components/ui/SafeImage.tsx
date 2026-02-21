import { useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Aspect ratio class e.g. "aspect-square", "aspect-[3/4]" */
  aspectRatio?: string;
  /** object-fit style */
  fit?: "cover" | "contain" | "fill";
  /** Additional wrapper className */
  wrapperClassName?: string;
  /** Skeleton border radius class override */
  skeletonClassName?: string;
}

const SafeImage = ({
  src,
  alt,
  className,
  aspectRatio = "aspect-square",
  fit = "cover",
  wrapperClassName,
  skeletonClassName,
  ...props
}: SafeImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", aspectRatio, wrapperClassName)}>
      {/* Skeleton shown while loading */}
      {!isLoaded && !hasError && (
        <Skeleton className={cn("absolute inset-0 w-full h-full", skeletonClassName)} />
      )}

      {/* Actual image - hidden until loaded, then fades in */}
      {!hasError && src && (
        <img
          src={src}
          alt={alt || ""}
          className={cn(
            "w-full h-full transition-opacity duration-300 ease-out",
            fit === "cover" && "object-cover",
            fit === "contain" && "object-contain",
            fit === "fill" && "object-fill",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          {...props}
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center">
          <span className="text-muted-foreground text-xs">No image</span>
        </div>
      )}
    </div>
  );
};

export { SafeImage };
export default SafeImage;
