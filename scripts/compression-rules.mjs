// Single source of truth for which built assets get a precompressed .gz sidecar.
//
// Imported by vite.config.ts (to drive the build plugin) and by
// scripts/verify-precompressed.mjs (to assert the sidecars exist). Keeping one
// definition is deliberate: if the verifier and the builder disagree about
// eligibility, CI fails on assets that were never supposed to be compressed.
//
// Why gzip only: our origin nginx is the stock nginx:1.27-alpine image, which
// compiles http_gzip_static_module but neither ngx_brotli nor a zstd module.
// A .br/.zst sidecar would therefore never be served by our own origin and
// would just bloat the image. Cloudflare negotiates br/zstd on the wire from
// the uncompressed asset instead. See docs/compression.md.

export const PRECOMPRESS_THRESHOLD = 1024;

// Text-like assets that actually shrink under gzip.
export const PRECOMPRESS_INCLUDE = /\.(js|mjs|css|html|svg|json|xml|txt)$/i;

// Already-compressed or binary formats: a gzip stream is at best the same size
// and often larger, so we skip them rather than ship a useless sidecar.
export const PRECOMPRESS_EXCLUDE =
  /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|zip|gz|br|zst)$/i;

// Suffix appended to an asset to hold the gzip stream.
export const GZIP_SUFFIX = ".gz";

// Extensions that must never appear in the build output FOR VITE-HASHED ASSETS.
// Brotli/zstd sidecars are dead weight under the current serving model for
// hashed assets, so their presence signals a misconfigured build.
//
// Exception: favicon/icon files at the dist root get their own .br/.zst
// sidecars via scripts/precompress-icons.mjs, served by a dedicated nginx
// location block with Accept-Encoding negotiation. See docs/compression.md.
export const FORBIDDEN_SIDECAR_SUFFIXES = [".br", ".zst"];

// Favicon/icon files that are allowed to have .br/.zst sidecars.
const ICON_SIDECAR_PATTERNS = [
  /^favicon\.(png|svg|ico)/,
  /^apple-touch-icon\.png/,
  /^icon\d+\.png/,
  /^site\.webmanifest/,
];

/**
 * Returns true if a file is an icon/favicon asset that is allowed to have
 * .br/.zst sidecars (served via nginx content-negotiation, not gzip_static).
 */
export function isIconSidecar(relPath) {
  const basename = relPath.split("/").pop() ?? relPath;
  // Strip the sidecar suffix to get the base filename.
  const base = basename.replace(/\.(gz|br|zst)$/, "");
  return ICON_SIDECAR_PATTERNS.some((re) => re.test(base));
}

/**
 * Decide whether a built asset is a candidate for a gzip sidecar.
 *
 * @param {string} relPath path relative to the build output dir, POSIX separators
 * @param {number} size    size of the original asset in bytes
 * @returns {boolean}
 */
export function isPrecompressible(relPath, size) {
  if (size < PRECOMPRESS_THRESHOLD) return false;
  if (PRECOMPRESS_EXCLUDE.test(relPath)) return false;
  return PRECOMPRESS_INCLUDE.test(relPath);
}
