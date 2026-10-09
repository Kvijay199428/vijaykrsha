import { BrandLoader } from "./ui/brand-loader";

/**
 * The one place the brand string is defined. Rendered uppercase so screen
 * readers and `text-transform`-less contexts both announce it as shown.
 */
const BRAND_TEXT = "VIJAYKRSHA.ONLINE";

/**
 * Stagger divisor for the `typewriter` preset.
 *
 * The vendored `animations.css` hardcodes 14, which assumes a brand of ~15
 * characters or fewer. At 17 characters the last letter's delay
 * (16/14 ≈ 1.14 cycles) overflows the animation cycle, so the loop visibly
 * drifts and desyncs on each repeat. 20 places the last letter's reveal at
 * 0.8T — right about where the first letter starts wiping (0.85T) — so the
 * sequence reads as one continuous, seamless typing loop.
 */
const TYPEWRITER_DIVISOR = 20;

interface BrandLogoProps {
  /** Font size in px. Defaults to the `text-lg` (18px) used before. */
  fontSize?: number;
  /** Seconds for one full type-and-erase cycle. */
  duration?: number;
  className?: string;
}

/**
 * Animated brand mark for the header, footer and admin sidebar.
 *
 * Inherits colour from `currentColor`, so the surrounding element's text
 * colour classes (light/dark variants) apply unchanged. Renders with
 * `brandMark` so it is exposed as a plain label rather than a live region.
 */
export default function BrandLogo({
  fontSize = 18,
  duration = 2.4,
  className = "",
}: BrandLogoProps) {
  return (
    <BrandLoader
      brand={BRAND_TEXT}
      animation="typewriter"
      size="sm"
      brandMark
      className={`brand-logo ${className}`.trim()}
      ariaLabel="Vijaykrsha.online"
      style={{
        fontSize: `${fontSize}px`,
        "--brand-loader-duration": `${duration}s`,
      }}
    />
  );
}

export { BRAND_TEXT, TYPEWRITER_DIVISOR };