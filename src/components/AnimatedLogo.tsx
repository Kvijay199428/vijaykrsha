import { useState } from "react";

interface AnimatedLogoProps {
  className?: string;
  alt?: string;
  size?: number;
}

export default function AnimatedLogo({
  className = "",
  alt = "Vijay Kumar Sharma",
  size = 120,
}: AnimatedLogoProps) {
  const [hasError, setHasError] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  if (prefersReducedMotion || hasError) {
    return (
      <div
        className={`animated-logo flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="flex items-center justify-center w-full h-full rounded-2xl bg-glow-500/10 border border-glow-500/20">
          <span className="text-3xl font-bold text-glow-600 dark:text-glow-400">
            VK
          </span>
        </div>
      </div>
    );
  }

  return (
    <img
      src="/logo/animated-logo.gif"
      alt={alt}
      className={`animated-logo ${className}`}
      style={{ width: size, height: size }}
      onError={() => setHasError(true)}
      aria-label={alt}
      role="img"
    />
  );
}
