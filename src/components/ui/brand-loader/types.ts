import type React from "react";

export type BrandLoaderAnimation =
  // original set
  | "fade"
  | "pulse"
  | "scan"
  | "glitch"
  | "typing"
  | "reveal"
  | "shimmer"
  | "bounce"
  | "flicker"
  | "wave"
  | "blur"
  | "neon"
  // motion / entrance
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "zoom-in"
  | "zoom-out"
  | "rotate-in"
  | "roll-in"
  | "drop"
  | "rise"
  // 3D / perspective (parent has perspective set)
  | "flip-x"
  | "flip-y"
  | "letter-spin"
  | "perspective-tilt"
  // playful / squash
  | "elastic"
  | "swing"
  | "rubber"
  | "jelly"
  | "heartbeat"
  | "wobble"
  | "shake-x"
  | "shake-y"
  | "tilt"
  | "squeeze"
  | "stretch"
  | "skew"
  | "skew-bounce"
  | "mirror"
  | "warp"
  // rotation / strobe
  | "spin-slow"
  | "spin-fast"
  | "flash"
  | "strobe"
  // sweep / reveal
  | "underline-sweep"
  | "gradient-shift"
  | "rainbow"
  | "peekaboo"
  | "curtain"
  | "iris"
  | "wipe-diagonal"
  // ambient / idle
  | "levitate"
  | "drift"
  | "sway"
  | "tracking-pulse"
  // texture / glitch family
  | "static-noise"
  | "chromatic"
  // per-letter sequenced
  | "typewriter"
  | "cascade"
  | "letter-fade"
  | "letter-pop"
  // directional bounce-in family
  | "bounce-in"
  | "bounce-in-up"
  | "bounce-in-down"
  | "bounce-in-left"
  | "bounce-in-right"
  // directional fade family
  | "fade-in-up"
  | "fade-in-down"
  | "fade-in-left"
  | "fade-in-right"
  | "fade-out-pulse"
  // directional flip family
  | "flip-in-x"
  | "flip-in-y"
  | "flip-out-x"
  | "flip-out-y"
  // directional zoom family
  | "zoom-in-up"
  | "zoom-in-down"
  | "zoom-in-left"
  | "zoom-in-right"
  // rotation family
  | "rotate-cw"
  | "rotate-ccw"
  | "rotate-in-corner"
  // light speed / jello / blink
  | "light-speed-in"
  | "light-speed-out"
  | "jello"
  | "blink"
  // liquid / organic
  | "liquid-wave"
  | "morph"
  | "blob"
  | "ripple"
  | "melt"
  | "drip"
  | "ooze"
  | "breathe"
  // retro / CRT / cyberpunk
  | "crt-flicker"
  | "vhs-glitch"
  | "scanlines"
  | "hologram"
  | "cyberpunk-glow"
  | "terminal-blink"
  | "pixelate"
  | "static-tv"
  | "tracking-error"
  | "neon-sign-flicker"
  // glass / material
  | "glass-shine"
  | "frosted"
  | "glossy-sheen"
  | "mica"
  | "aurora"
  | "prism"
  // paper / origami
  | "fold-in"
  | "unfold"
  | "paper-flip"
  | "crease"
  | "ribbon-wave"
  // nature-inspired
  | "flame-flicker"
  | "water-ripple"
  | "wind-sway"
  | "ember-glow"
  | "smoke-rise"
  | "cloud-drift"
  // celestial / orbit
  | "comet"
  | "shooting-star"
  | "orbit"
  | "pendulum"
  | "metronome"
  | "seesaw"
  // sequential mechanisms (letter-based where noted)
  | "accordion"
  | "zipper" // letter-based
  | "domino" // letter-based
  | "ripple-wave"
  | "pop-in"
  | "pop-out"
  | "snap-in"
  | "magnet-pulse"
  // spin / spiral
  | "vortex"
  | "spiral-in"
  | "spiral-out"
  | "tornado"
  | "earthquake"
  // glitch family expansion
  | "glitch-rgb"
  | "glitch-slice"
  | "datamosh"
  | "binary-flicker"
  | "matrix-rain" // letter-based
  | "code-scroll"
  | "dot-trail"
  // sweep / radar
  | "progress-sweep"
  | "radar-sweep"
  // mouse / pointer-interactive (see BrandLoader.tsx mouse handling)
  | "cursor-follow"
  | "magnetic-pull"
  | "tilt-3d"
  | "spotlight-cursor"
  | "cursor-glow"
  | "parallax-cursor"
  | "repel-letters" // letter-based
  | "attract-letters" // letter-based
  | "ripple-click"
  | "hover-scale"
  | "hover-glitch"
  | "hover-underline"
  // escape hatch
  | "custom";

export type BrandLoaderSize = "sm" | "md" | "lg" | "xl";

export type BrandLoaderSpeed = "slow" | "normal" | "fast";

/**
 * Advanced font descriptor. Lets you point at a specific weight or a
 * fully custom font file instead of relying on the default
 * `/.font/{name}.woff2` convention.
 */
export interface BrandLoaderFontConfig {
  /** Font name, matches the file under /.font/ (without extension). */
  name: string;
  /** Optional explicit weight. Resolves to /.font/{name}/{weight}.woff2 */
  weight?: number;
  /** Optional fully custom path, overrides the default convention entirely. */
  src?: string;
}

/**
 * React.CSSProperties plus the component's public CSS custom
 * properties, so overriding them via `style` is type-checked instead
 * of requiring an `as React.CSSProperties` cast.
 *
 * @example
 * <BrandLoader brand="VEGA" style={{ "--brand-loader-duration": "4s" }} />
 */
export type BrandLoaderCSSProperties = React.CSSProperties & {
  "--brand-loader-duration"?: string;
  "--brand-loader-color"?: string;
};

export interface BrandLoaderProps {
  /** Text to render, e.g. your brand/product name. */
  brand: string;
  /**
   * Font to use. Either a plain name ("Orbitron") which resolves to
   * /.font/Orbitron.woff2, or a BrandLoaderFontConfig for weights /
   * custom paths. Omit to fall back to the surrounding UI font.
   */
  font?: string | BrandLoaderFontConfig;
  /** Built-in animation preset. Use "custom" + className for your own. */
  animation?: BrandLoaderAnimation;
  size?: BrandLoaderSize;
  speed?: BrandLoaderSpeed;
  /** Render as a full-viewport centered overlay. */
  fullscreen?: boolean;
  /**
   * Render as a brand mark instead of a loading indicator.
   *
   * Drops `role="status"` / `aria-live="polite"` and the screen-reader-only
   * "Loading…" text, so the element exposes only the brand name. Required
   * when the loader sits inside a link — otherwise the link's accessible
   * name becomes "Loading <brand>" and screen readers re-announce it as a
   * live region on every navigation.
   */
  brandMark?: boolean;
  className?: string;
  style?: BrandLoaderCSSProperties;
  /** Accessible label read by screen readers. Defaults to `Loading {brand}`. */
  ariaLabel?: string;
}
