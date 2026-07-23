import { useRef } from "react";
import useSpriteAnimation from "@/hooks/useSpriteAnimation";
import logoConfig from "../../public/logo/logo.json";

interface AnimatedLogoProps {
  className?: string;
  alt?: string;
  size?: number;
}

export default function AnimatedLogo({
  className = "",
  alt = "Vijay Kumar Sharma",
  size,
}: AnimatedLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : true;

  const config = {
    ...logoConfig,
    scale: size ? size / logoConfig.frameWidth : logoConfig.scale,
    blendMode: logoConfig.blendMode as GlobalCompositeOperation,
  };

  useSpriteAnimation(canvasRef, config);

  const displaySize = config.frameWidth * config.scale;

  if (prefersReducedMotion) {
    return (
      <div
        className={`animated-logo flex items-center justify-center ${className}`}
        style={{ width: displaySize, height: displaySize }}
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
    <canvas
      ref={canvasRef}
      className={`animated-logo ${className}`}
      style={{ width: displaySize, height: displaySize }}
      aria-label={alt}
      role="img"
    />
  );
}
