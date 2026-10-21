#!/usr/bin/env node
// Pre-compress favicon and icon assets into .gz, .br, and .zst sidecars.
//
// Nginx serves these via a location block that inspects Accept-Encoding and
// serves the best available sidecar (zstd > brotli > gzip > identity).
//
// This runs as a post-build step: after Vite has copied public/ into dist/,
// this script walks dist/ for favicon/icon files and creates compressed
// variants alongside the originals.
//
// Usage:
//   node scripts/precompress-icons.mjs [--dir=dist]
//
// Requires: Node.js ≥ 18 (for node:zlib brotli). Zstandard sidecars are
// generated only when the `fzstd` npm package is installed; otherwise they are
// silently skipped (nginx will fall back to brotli or gzip).

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Files eligible for multi-encoding pre-compression. These are favicon, icon,
// and manifest files that live at the root of the build output.
const ICON_PATTERNS = [
  /^favicon\.(png|svg|ico)$/,
  /^apple-touch-icon\.png$/,
  /^icon\d+\.png$/,
  /^site\.webmanifest$/,
];

const GZIP_LEVEL = 9;
const BROTLI_QUALITY = 11; // max quality — these files are tiny, CPU is cheap

// ---------------------------------------------------------------------------
// Zstandard support (optional)
// ---------------------------------------------------------------------------

let zstdCompress = null;
try {
  // Try the pure-JS fzstd package first (no native addons).
  const fzstd = await import("fzstd");
  zstdCompress = (buf, _level) => Buffer.from(fzstd.compress(buf));
} catch {
  try {
    // Fallback: @aspect-build/zstd (native binding).
    const { compress } = await import("@aspect-build/zstd");
    zstdCompress = (buf, level) => compress(buf, level);
  } catch {
    // No zstd library available — zst sidecars will not be created.
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dir: "dist" };
  for (const raw of argv) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    if (key === "dir") args.dir = value ?? "dist";
  }
  return args;
}

function isIconFile(filename) {
  return ICON_PATTERNS.some((re) => re.test(filename));
}

function compressGzip(buf) {
  return gzipSync(buf, { level: GZIP_LEVEL });
}

function compressBrotli(buf) {
  return brotliCompressSync(buf, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
    },
  });
}

function compressZstd(buf) {
  if (!zstdCompress) return null;
  try {
    return zstdCompress(buf, 19); // level 19 — high for small files
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { dir } = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), dir);

  if (!existsSync(root)) {
    console.error(`[precompress-icons] output directory not found: ${root}`);
    console.error("[precompress-icons] run the build first.");
    process.exit(1);
  }

  // Only process files at the root of dist/ (icon/favicon files are not in
  // subdirectories).
  const entries = readdirSync(root).filter((name) => {
    const full = path.join(root, name);
    return statSync(full).isFile() && isIconFile(name);
  });

  if (entries.length === 0) {
    console.log("[precompress-icons] no icon/favicon files found in", root);
    return;
  }

  console.log(`[precompress-icons] dir=${dir}, zstd=${zstdCompress ? "yes" : "no (skipped)"}`);

  let created = 0;
  const results = [];

  for (const name of entries.sort()) {
    const original = readFileSync(path.join(root, name));
    const entry = { file: name, originalBytes: original.length, sidecars: {} };

    // Gzip
    const gz = compressGzip(original);
    if (gz.length < original.length) {
      writeFileSync(path.join(root, `${name}.gz`), gz);
      entry.sidecars.gz = gz.length;
      created++;
    }

    // Brotli
    const br = compressBrotli(original);
    if (br.length < original.length) {
      writeFileSync(path.join(root, `${name}.br`), br);
      entry.sidecars.br = br.length;
      created++;
    }

    // Zstandard
    const zst = compressZstd(original);
    if (zst && zst.length < original.length) {
      writeFileSync(path.join(root, `${name}.zst`), zst);
      entry.sidecars.zst = zst.length;
      created++;
    }

    results.push(entry);
  }

  // Print summary
  for (const r of results) {
    const sidecars = Object.entries(r.sidecars)
      .map(([ext, size]) => {
        const pct = ((1 - size / r.originalBytes) * 100).toFixed(1);
        return `${ext}=${size}B (-${pct}%)`;
      })
      .join(", ");
    console.log(`  ${r.file} (${r.originalBytes}B) → ${sidecars || "no shrinkage"}`);
  }

  console.log(`[precompress-icons] ${created} sidecar(s) created for ${entries.length} file(s)`);
}

main();
