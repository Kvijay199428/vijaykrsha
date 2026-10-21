#!/usr/bin/env node
// Smoke-test the negotiated Content-Encoding of a deployed site.
//
// For every target URL this issues HEAD requests under a matrix of
// Accept-Encoding values and asserts that the server never returns an encoding
// the client did not offer, that cacheable encoded responses carry
// `Vary: Accept-Encoding`, and that sensitive (admin API) targets are neither
// compressed nor cacheable.
//
// Document targets are discovered automatically: a GET with `Accept-Encoding:
// identity` is parsed for /assets/*.js|css links, which are then checked too —
// that is where the "cache variants must not be confused" rule actually bites.
//
// Usage:
//   node scripts/check-encoding.mjs
//   node scripts/check-encoding.mjs \
//     --target=https://vijaykrsha.online/ \
//     --target=https://api.vijaykrsha.online/vega/api/...
//
// Options:
//   --target=<url>     repeatable; default https://vijaykrsha.online/
//   --strict           treat network/timeout errors as failures (default: warn)
//   --no-discover      do not follow /assets/* links found in document targets
//   --require-vary     fail when an encoded response lacks Vary: Accept-Encoding
//                      (use against the origin you control; the Cloudflare edge
//                      omits it on cache hits, which is a note by default)
//   --timeout=<ms>     per-request timeout, default 10000
//
// It uses raw node:https so the Content-Encoding header is read exactly as the
// wire delivered it — fetch()/undici would transparently decode the body and
// blur what the CDN actually negotiated.

import http from "node:http";
import https from "node:https";

const DEFAULT_TARGETS = ["https://vijaykrsha.online/"];
const ACCEPT_ENCODING_CASES = [
  { label: "br, zstd, gzip", value: "br, zstd, gzip" },
  { label: "gzip", value: "gzip" },
  { label: "identity", value: "identity" },
  { label: "(absent)", value: undefined },
];
// Targets matching this carry sensitive dynamic data: compression there is a
// BREACH-class risk and caching is forbidden.
const SENSITIVE_RE = /\/admin\/api\/|\/vega\/api\/.*admin/i;
const ASSET_RE = /\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g;
const MAX_DISCOVERED = 2;

function parseArgs(argv) {
  const args = { targets: [], strict: false, discover: true, requireVary: false, timeout: 10000 };
  for (const raw of argv) {
    if (raw === "--strict") args.strict = true;
    else if (raw === "--no-discover") args.discover = false;
    else if (raw === "--require-vary") args.requireVary = true;
    else {
      const [key, value] = raw.replace(/^--/, "").split("=");
      if (key === "target" && value) args.targets.push(value);
      else if (key === "timeout" && value) args.timeout = Number(value);
    }
  }
  if (args.targets.length === 0) args.targets = DEFAULT_TARGETS;
  return args;
}

function request(url, method, acceptEncoding, timeout) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    const req = lib.request(
      url,
      {
        method,
        timeout,
        headers: acceptEncoding ? { "Accept-Encoding": acceptEncoding } : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error(`timeout after ${timeout}ms`)));
    req.on("error", reject);
    req.end();
  });
}

const offeredSet = (acceptEncoding) =>
  new Set(
    (acceptEncoding ?? "")
      .split(",")
      .map((s) => s.trim().split(";")[0].toLowerCase())
      .filter(Boolean)
  );

function isDocumentTarget(url) {
  const { pathname } = new URL(url);
  return pathname === "/" || pathname.endsWith("/") || pathname.endsWith(".html") || !/\.[a-z0-9]+$/i.test(pathname);
}

async function discoverAssets(target, timeout) {
  try {
    const res = await request(target, "GET", "identity", timeout);
    const html = res.body.toString("utf8");
    const found = new Set();
    for (const m of html.matchAll(ASSET_RE)) {
      found.add(new URL(m[0], target).toString());
      if (found.size >= MAX_DISCOVERED) break;
    }
    return [...found];
  } catch {
    return [];
  }
}

async function checkTarget(url, { strict, timeout, requireVary, warnings }, failures) {
  const sensitive = SENSITIVE_RE.test(new URL(url).pathname);
  console.log(`\n${url}${sensitive ? "  [sensitive]" : ""}`);
  console.log(
    `  ${"accept-encoding".padEnd(16)} ${"status".padEnd(6)} ${"content-encoding".padEnd(18)} vary`
  );

  for (const c of ACCEPT_ENCODING_CASES) {
    let res;
    try {
      res = await request(url, "HEAD", c.value, timeout);
    } catch (err) {
      if (strict) failures.push(`${url} [${c.label}]: ${err.message}`);
      else warnings.push(`${url} [${c.label}]: ${err.message}`);
      console.log(`  ${c.label.padEnd(16)} ERROR  ${err.message}`);
      continue;
    }

    const ce = (res.headers["content-encoding"] || "").toLowerCase();
    const vary = (res.headers["vary"] || "").toLowerCase();
    const cacheControl = (res.headers["cache-control"] || "").toLowerCase();
    const cacheStatus = (res.headers["cf-cache-status"] || "").toLowerCase();
    console.log(
      `  ${c.label.padEnd(16)} ${String(res.status).padEnd(6)} ${(ce || "-").padEnd(18)} ${vary || "-"}`
    );

    if (ce) {
      const offered = offeredSet(c.value);
      for (const token of ce.split(",").map((s) => s.trim())) {
        if (!offered.has(token)) {
          failures.push(
            `${url} [${c.label}]: server sent Content-Encoding "${token}" the client did not accept`
          );
        }
      }
      if (!vary.includes("accept-encoding")) {
        // Vary is shared-cache hygiene. The Cloudflare edge omits it on cache
        // hits (cf-cache-status: HIT) even though it negotiates the encoding per
        // client, so this is a note by default and a failure only with
        // --require-vary (intended for the origin you control).
        const msg = `${url} [${c.label}]: encoded response without Vary: Accept-Encoding` +
          (cacheStatus ? ` (cf-cache-status: ${cacheStatus})` : "");
        if (requireVary) failures.push(msg);
        else warnings.push(msg);
      }
    }

    if (sensitive) {
      if (ce) failures.push(`${url} [${c.label}]: sensitive admin response must not be compressed`);
      if (!cacheControl.includes("no-store")) {
        failures.push(`${url} [${c.label}]: sensitive admin response missing Cache-Control: no-store`);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  const warnings = [];

  const targets = [...new Set(args.targets)];
  if (args.discover) {
    for (const t of [...targets]) {
      if (isDocumentTarget(t)) targets.push(...(await discoverAssets(t, args.timeout)));
    }
  }

  for (const target of [...new Set(targets)]) {
    await checkTarget(target, { ...args, warnings }, failures);
  }

  if (warnings.length > 0) {
    console.log(`\n[check:encoding] ${warnings.length} note(s):`);
    for (const w of warnings) console.log(`  ~ ${w}`);
  }
  if (failures.length > 0) {
    console.error(`\n[check:encoding] FAILED with ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\n[check:encoding] OK");
}

main();
