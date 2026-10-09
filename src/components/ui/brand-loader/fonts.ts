import type { BrandLoaderFontConfig } from "./types";

const injected = new Set<string>();

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Resolves a font prop (string or config object) to a woff2 URL,
 * following the /.font/{name}.woff2 convention unless an explicit
 * `src` or `weight` is given.
 */
function resolveFontPath(font: string | BrandLoaderFontConfig): string {
  if (typeof font === "string") {
    return `/.font/${encodeURIComponent(font)}.woff2`;
  }

  if (font.src) {
    return font.src;
  }

  if (font.weight) {
    return `/.font/${encodeURIComponent(font.name)}/${font.weight}.woff2`;
  }

  return `/.font/${encodeURIComponent(font.name)}.woff2`;
}

/**
 * Injects a scoped @font-face rule for the given font (once per
 * font+weight) and returns the CSS font-family name to use.
 * No-ops safely during SSR.
 */
export function registerFont(font: string | BrandLoaderFontConfig): string {
  const rawName = typeof font === "string" ? font : font.name;
  const weight = typeof font === "string" ? undefined : font.weight;
  const safeName = sanitize(rawName) + (weight ? `-${weight}` : "");
  const fontFamily = `BrandLoader-${safeName}`;

  if (typeof document === "undefined") {
    return fontFamily;
  }

  const styleId = `brand-loader-font-${safeName}`;
  if (injected.has(styleId) || document.getElementById(styleId)) {
    return fontFamily;
  }

  const fontPath = resolveFontPath(font);
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
@font-face {
  font-family: "${fontFamily}";
  src: url("${fontPath}") format("woff2");
  font-weight: ${weight ?? "400 900"};
  font-display: swap;
}
`.trim();

  document.head.appendChild(style);
  injected.add(styleId);

  return fontFamily;
}
