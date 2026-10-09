import React, { useCallback, useMemo, useRef, useState } from "react";
import "./brand-loader.css";
import "./animations.css";
import { registerFont } from "./fonts";
import type { BrandLoaderAnimation, BrandLoaderProps } from "./types";

/**
 * Presets that render each character as its own `.brand-loader__letter`
 * span (for staggered animation-delay, or per-letter JS-driven
 * transforms) instead of plain text.
 */
const LETTER_ANIMATIONS = new Set<BrandLoaderAnimation>([
  "wave",
  "letter-spin",
  "typewriter",
  "cascade",
  "letter-fade",
  "letter-pop",
  "zipper",
  "domino",
  "matrix-rain",
  "repel-letters",
  "attract-letters",
]);

/**
 * Presets that track cursor position at the whole-loader level via the
 * --mx / --my (0-100%) and --mx-c / --my-c (-1..1) CSS custom
 * properties. The CSS for each of these reads those variables; this
 * component's only job is to keep them updated on mousemove.
 */
const MOUSE_TRACK_ANIMATIONS = new Set<BrandLoaderAnimation>([
  "cursor-follow",
  "magnetic-pull",
  "tilt-3d",
  "spotlight-cursor",
  "cursor-glow",
  "parallax-cursor",
]);

/**
 * Presets where individual letters lean toward or away from the
 * cursor. These need real per-letter geometry, so they're handled
 * with direct ref/style manipulation rather than CSS variables.
 */
const MOUSE_LETTER_ANIMATIONS = new Set<BrandLoaderAnimation>([
  "repel-letters",
  "attract-letters",
]);

const REPEL_ATTRACT_RADIUS_PX = 70;

let rippleId = 0;

/**
 * BrandLoader
 *
 * A self-contained, animated loading indicator that renders your
 * brand/product name in a custom font. 162 built-in animation presets
 * (including 12 mouse/pointer-interactive ones) plus a "custom" escape
 * hatch — see BrandLoaderAnimation in types.ts for the full list.
 *
 * Font files are expected at `/public/.font/{name}.woff2` by default
 * (see the `font` prop docs in types.ts for weighted / custom paths).
 *
 * @example
 * <BrandLoader brand="VEGA" font="Orbitron" animation="scan" />
 * <BrandLoader brand="VEGA" animation="tilt-3d" />
 * <BrandLoader brand="VEGA" animation="repel-letters" />
 */
export function BrandLoader({
  brand,
  font,
  animation = "fade",
  size = "md",
  speed = "normal",
  fullscreen = false,
  brandMark = false,
  className = "",
  style,
  ariaLabel,
}: BrandLoaderProps) {
  const fontFamily = useMemo(() => {
    if (!font) return undefined;
    return registerFont(font);
  }, [font]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [ripples, setRipples] = useState<
    { id: number; x: number; y: number }[]
  >([]);

  const isMouseTrack = MOUSE_TRACK_ANIMATIONS.has(animation);
  const isMouseLetter = MOUSE_LETTER_ANIMATIONS.has(animation);
  const isRippleClick = animation === "ripple-click";
  const usesLetters = LETTER_ANIMATIONS.has(animation);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!el) return;

      if (isMouseTrack) {
        const rect = el.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mx", `${px}%`);
        el.style.setProperty("--my", `${py}%`);
        el.style.setProperty("--mx-c", `${(px - 50) / 50}`);
        el.style.setProperty("--my-c", `${(py - 50) / 50}`);
      }

      if (isMouseLetter) {
        const sign = animation === "repel-letters" ? -1 : 1;
        const strength = animation === "repel-letters" ? 16 : 7;
        for (const letter of letterRefs.current) {
          if (!letter) continue;
          const r = letter.getBoundingClientRect();
          const lx = r.left + r.width / 2;
          const ly = r.top + r.height / 2;
          const dx = e.clientX - lx;
          const dy = e.clientY - ly;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < REPEL_ATTRACT_RADIUS_PX) {
            const force =
              (REPEL_ATTRACT_RADIUS_PX - dist) / REPEL_ATTRACT_RADIUS_PX;
            const tx = sign * (dx / dist) * force * strength;
            const ty = sign * (dy / dist) * force * strength;
            letter.style.transform = `translate(${tx}px, ${ty}px)`;
          } else {
            letter.style.transform = "";
          }
        }
      }
    },
    [animation, isMouseTrack, isMouseLetter]
  );

  const handleMouseLeave = useCallback(() => {
    const el = containerRef.current;
    if (isMouseTrack && el) {
      el.style.setProperty("--mx", "50%");
      el.style.setProperty("--my", "50%");
      el.style.setProperty("--mx-c", "0");
      el.style.setProperty("--my-c", "0");
    }
    if (isMouseLetter) {
      for (const letter of letterRefs.current) {
        if (letter) letter.style.transform = "";
      }
    }
  }, [isMouseTrack, isMouseLetter]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isRippleClick) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setRipples((prev) => [
        ...prev,
        { id: ++rippleId, x: e.clientX - rect.left, y: e.clientY - rect.top },
      ]);
    },
    [isRippleClick]
  );

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const classes = [
    "brand-loader",
    `brand-loader--${animation}`,
    `brand-loader--${size}`,
    `brand-loader--speed-${speed}`,
    fullscreen ? "brand-loader--fullscreen" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const needsMouseHandlers = isMouseTrack || isMouseLetter || isRippleClick;

  return (
    <div
      ref={containerRef}
      className={classes}
      // In `brandMark` mode the loader is a brand mark, not a status message:
      // a live region here would make a screen reader announce
      // "Loading VEGA" on every route change.
      role={brandMark ? undefined : "status"}
      aria-live={brandMark ? undefined : "polite"}
      aria-label={brandMark ? ariaLabel : ariaLabel ?? `Loading ${brand}`}
      onMouseMove={needsMouseHandlers ? handleMouseMove : undefined}
      onMouseLeave={needsMouseHandlers ? handleMouseLeave : undefined}
      onClick={isRippleClick ? handleClick : undefined}
    >
      <span
        className="brand-loader__text"
        data-brand={brand}
        style={{
          ...style,
          ...(fontFamily ? { fontFamily } : {}),
        }}
      >
        {usesLetters
          ? [...brand].map((char, i) => (
              <span
                key={i}
                ref={(el) => {
                  letterRefs.current[i] = el;
                }}
                className="brand-loader__letter"
                style={{ "--i": i } as React.CSSProperties}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))
          : brand}
      </span>
      {!brandMark && <span className="brand-loader__sr-only">Loading&hellip;</span>}
      {isRippleClick &&
        ripples.map((r) => (
          <span
            key={r.id}
            className="brand-loader__ripple"
            style={{ left: r.x, top: r.y }}
            onAnimationEnd={() => removeRipple(r.id)}
          />
        ))}
    </div>
  );
}

export default BrandLoader;
