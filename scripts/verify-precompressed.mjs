#!/usr/bin/env node
// Assert that the build output's precompressed gzip sidecars match the build
// mode, and record a per-asset manifest.
//
//   --mode=nginx  every precompressible asset MUST have a matching .gz that
//                 gunzips back to the exact original bytes (Docker/dev builds,
//                 which set VITE_PRECOMPRESS=1 and serve via nginx gzip_static).
//   --mode=pages  the output MUST contain no sidecars at all (Cloudflare Pages
//                 compresses on the wire; sidecars are dead weight).
//   --mode=auto   infer from whether any .gz sidecar exists (default).
//   --dir=<path>  build output directory (default "dist").
//
// A file is a *sidecar* only when the asset it encodes also exists (foo.js.gz
// next to foo.js). A lone .gz with no sibling is an application asset and is
// left alone.
//
// Exit code 0 = pass, 1 = violation. A missing required sidecar, a corrupt one,
// or a forbidden .br/.zst all fail the run.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  FORBIDDEN_SIDECAR_SUFFIXES,
  GZIP_SUFFIX,
  isIconSidecar,
  isPrecompressible,
} from "./compression-rules.mjs";

const MANIFEST_NAME = "compression-manifest.json";
const GZIP_LEVEL = 9;

function parseArgs(argv) {
  const args = { mode: "auto", dir: "dist" };
  for (const raw of argv) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    if (key === "mode") args.mode = value ?? "auto";
    else if (key === "dir") args.dir = value ?? "dist";
  }
  return args;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const ratio = (encoded, original) => (original === 0 ? 1 : encoded / original);

function validateSidecar(root, sidecarRel, original, errors) {
  const gz = readFileSync(path.join(root, sidecarRel));
  let decoded;
  try {
    decoded = gunzipSync(gz); // throws on a truncated/corrupt stream
  } catch (err) {
    errors.push(`corrupt gzip for ${sidecarRel}: ${err.message}`);
    return gz.length;
  }
  if (!decoded.equals(original)) {
    errors.push(`gzip ${sidecarRel} does not decode to the original bytes`);
  }
  return gz.length;
}

function main() {
  const { mode: requestedMode, dir } = parseArgs(process.argv.slice(2));
  const root = path.resolve(process.cwd(), dir);

  if (!existsSync(root)) {
    console.error(`[verify:compress] output directory not found: ${root}`);
    console.error("[verify:compress] run the build first.");
    process.exit(1);
  }

  const relOf = (full) => path.relative(root, full).split(path.sep).join("/");
  const allRel = walk(root)
    .map(relOf)
    .filter((r) => r !== MANIFEST_NAME);
  const present = new Set(allRel);

  const isGz = (r) => r.endsWith(GZIP_SUFFIX);
  const originalOf = (r) => r.slice(0, -GZIP_SUFFIX.length);

  // Sidecar = a .gz that encodes an asset we also ship. Everything else is a
  // base asset (or an application-level .gz with no sibling).
  const sidecars = allRel.filter((r) => isGz(r) && present.has(originalOf(r)));
  const sidecarSet = new Set(sidecars);
  const forbidden = allRel.filter(
    (r) => FORBIDDEN_SIDECAR_SUFFIXES.some((s) => r.endsWith(s)) && !isIconSidecar(r)
  );
  const baseAssets = allRel.filter((r) => !isGz(r));

  const mode =
    requestedMode === "auto" ? (sidecars.length > 0 ? "nginx" : "pages") : requestedMode;
  const errors = [];

  console.log(`[verify:compress] dir=${dir} mode=${mode} (requested=${requestedMode})`);

  for (const r of forbidden) {
    errors.push(`forbidden sidecar present (our origin serves only gzip): ${r}`);
  }

  if (mode === "pages") {
    for (const r of sidecars) {
      errors.push(`Pages output must not contain sidecars, found: ${r} (build with VITE_PRECOMPRESS unset)`);
    }
    if (existsSync(path.join(root, MANIFEST_NAME))) {
      errors.push(`Pages output must not contain ${MANIFEST_NAME}`);
    }
  } else if (mode === "nginx") {
    const assets = [];
    for (const r of baseAssets) {
      const original = readFileSync(path.join(root, r));
      if (!isPrecompressible(r, original.length)) continue;

      // Mirror the plugin's skipIfLargerOrEqual=true: a sidecar is emitted only
      // when gzip actually shrank the asset. Re-gzipping here keeps the check
      // deterministic without trusting the plugin's bookkeeping.
      const wouldShrink = gzipSync(original, { level: GZIP_LEVEL }).length < original.length;
      const sidecarRel = `${r}${GZIP_SUFFIX}`;

      if (sidecarSet.has(sidecarRel)) {
        const gzBytes = validateSidecar(root, sidecarRel, original, errors);
        assets.push({
          path: r,
          originalBytes: original.length,
          gzipBytes: gzBytes,
          ratio: Number(ratio(gzBytes, original.length).toFixed(4)),
          sha256: sha256(original),
        });
      } else if (wouldShrink) {
        errors.push(`missing required sidecar: ${sidecarRel}`);
      }
    }

    const originalTotal = assets.reduce((n, a) => n + a.originalBytes, 0);
    const gzipTotal = assets.reduce((n, a) => n + a.gzipBytes, 0);
    const manifest = {
      mode,
      assetCount: assets.length,
      originalTotalBytes: originalTotal,
      gzipTotalBytes: gzipTotal,
      ratio: Number(ratio(gzipTotal, originalTotal).toFixed(4)),
      assets: assets.sort((a, b) => a.path.localeCompare(b.path)),
    };
    writeFileSync(path.join(root, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + "\n");
    const saved =
      originalTotal === 0 ? 0 : 100 * (1 - ratio(gzipTotal, originalTotal));
    console.log(
      `[verify:compress] ${assets.length} sidecars verified, ` +
        `${originalTotal} -> ${gzipTotal} bytes (${saved.toFixed(1)}% smaller)`
    );
  } else {
    errors.push(`unknown mode '${mode}' (expected nginx, pages, or auto)`);
  }

  if (errors.length > 0) {
    console.error(`\n[verify:compress] FAILED with ${errors.length} problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log("[verify:compress] OK");
}

main();
