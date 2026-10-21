#!/usr/bin/env python3
"""Offline compression benchmark for vijaykrsha.online.

Measures every algorithm the project cares about — the ones we ship over HTTP
(gzip, deflate, brotli, zstandard, zopfli-as-gzip) and the ones we deliberately
do NOT expose as HTTP encodings (lz4, snappy, lzma/xz, bzip2) — against a
representative corpus plus negative controls.

Nothing in this file runs in the request path. It exists so the HTTP encoding
policy can be justified with numbers instead of folklore.

Optional engines (install with the `bench` extra from backend/pyproject.toml):

    pip install -e "backend[bench]"      # zopfli, lz4, python-snappy, brotli, zstandard

Usage:
    python benchmarks/compression_bench.py
    python benchmarks/compression_bench.py --dir dist --json benchmarks/results.json
"""

from __future__ import annotations

import argparse
import bz2
import gzip
import json
import lzma
import os
import statistics
import time
import tracemalloc
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional


# ── engine registry ──────────────────────────────────────────────────────
@dataclass
class Engine:
    name: str
    http_encoding: Optional[str]  # Content-Encoding this maps to, or None if not HTTP
    compress: Callable[[bytes], bytes]
    decompress: Callable[[bytes], bytes]
    note: str = ""


def _build_engines() -> list[Engine]:
    engines: list[Engine] = [
        Engine("gzip", "gzip", lambda d: gzip.compress(d, 9), gzip.decompress),
        Engine(
            "deflate",
            "deflate",
            _raw_deflate,
            lambda b: zlib.decompress(b, -zlib.MAX_WBITS),
        ),
        Engine("lzma/xz", None, lambda d: lzma.compress(d, preset=9), lzma.decompress),
        Engine("bzip2", None, lambda d: bz2.compress(d, 9), bz2.decompress),
    ]

    try:
        import brotli  # type: ignore

        engines.append(
            Engine(
                "brotli(q11)",
                "br",
                lambda d: brotli.compress(d, quality=11),
                brotli.decompress,
            )
        )
    except ImportError:
        pass

    try:
        import zstandard  # type: ignore

        def _zstd_compress(d: bytes) -> bytes:
            return zstandard.ZstdCompressor(level=19).compress(d)

        engines.append(
            Engine("zstandard(l19)", "zstd", _zstd_compress, zstandard.ZstdDecompressor().decompress)
        )
    except ImportError:
        pass

    try:
        import zopfli.gzip  # type: ignore

        # Zopfli emits a gzip stream: it is a *producer* of gzip, never a wire
        # encoding of its own.
        engines.append(
            Engine("zopfli", "gzip", zopfli.gzip.compress, gzip.decompress, "gzip-compatible output")
        )
    except ImportError:
        pass

    try:
        import lz4.frame  # type: ignore

        engines.append(
            Engine("lz4", None, lz4.frame.compress, lz4.frame.decompress, "internal-only")
        )
    except ImportError:
        pass

    try:
        import snappy  # type: ignore

        engines.append(Engine("snappy", None, snappy.compress, snappy.decompress, "internal-only"))
    except ImportError:
        pass

    return engines


def _raw_deflate(data: bytes) -> bytes:
    obj = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
    return obj.compress(data) + obj.flush()


# ── corpus ───────────────────────────────────────────────────────────────
def synthetic_corpus() -> dict[str, bytes]:
    lorem = (
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod "
        "tempor incididunt ut labore et dolore magna aliqua. "
    )
    html = (
        "<!doctype html><html><head><title>vijaykrsha.online</title></head>"
        "<body>" + "".join(f"<p>{lorem}</p>" for _ in range(400)) + "</body></html>"
    ).encode()
    js = (
        "function render(items){return items.map((i)=>`<li>${i.name}</li>`).join('')}"
        ";const DATA=["
        + ",".join('{"id":%d,"name":"item-%d"}' % (i, i) for i in range(2000))
        + "];"
    ).encode()
    css = ("\n".join(f".cls-{i}{{color:#a78bfa;padding:{i}px;margin:{i}px 0}}" for i in range(1500))).encode()
    json_api = json.dumps(
        {"messages": [{"id": i, "subject": lorem, "body": lorem * 4} for i in range(150)]}
    ).encode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        + "".join(f'<rect x="{i}" y="{i}" width="1" height="1"/>' for i in range(2000))
        + "</svg>"
    ).encode()
    text_export = (lorem * 12000).encode()

    return {
        "html": html,
        "javascript": js,
        "css": css,
        "json-api": json_api,
        "svg": svg,
        "text-export": text_export,
        # Negative controls: incompressible or already-compressed payloads, where
        # compression must not be applied in production.
        "random-binary (control)": os.urandom(256 * 1024),
        "gzip-archive (control)": gzip.compress(os.urandom(256 * 1024), 9),
    }


def corpus_from_dir(root: Path, limit: int = 20) -> dict[str, bytes]:
    wanted = {".js", ".mjs", ".css", ".html", ".json", ".svg", ".txt"}
    found: list[tuple[int, Path]] = []
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in wanted:
            found.append((path.stat().st_size, path))
    found.sort(reverse=True)
    out: dict[str, bytes] = {}
    for size, path in found[:limit]:
        out[f"file:{path.relative_to(root).as_posix()}"] = path.read_bytes()
    return out


# ── measurement ──────────────────────────────────────────────────────────
@dataclass
class Result:
    engine: str
    http_encoding: Optional[str]
    sample: str
    original: int
    encoded: int
    ratio: float
    compress_ms: float
    decompress_ms: float
    peak_py_kb: float
    ok: bool
    error: str = ""


def measure(engine: Engine, sample: str, data: bytes, repeats: int) -> Result:
    c_times: list[float] = []
    d_times: list[float] = []
    encoded = 0
    peak = 0.0
    try:
        for _ in range(repeats):
            tracemalloc.reset_peak()
            t0 = time.perf_counter()
            blob = engine.compress(data)
            c_times.append((time.perf_counter() - t0) * 1000)
            _, pk = tracemalloc.get_traced_memory()
            peak = max(peak, pk / 1024)
            encoded = len(blob)

            t0 = time.perf_counter()
            decoded = engine.decompress(blob)
            d_times.append((time.perf_counter() - t0) * 1000)
            if decoded != data:
                raise ValueError("round-trip mismatch")
    except Exception as exc:  # noqa: BLE001 - report, never abort the run
        return Result(engine.name, engine.http_encoding, sample, len(data), 0, 0, 0, 0, peak, False, str(exc))

    return Result(
        engine.name,
        engine.http_encoding,
        sample,
        len(data),
        encoded,
        encoded / len(data) if data else 1.0,
        statistics.median(c_times),
        statistics.median(d_times),
        peak,
        True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", type=Path, default=None, help="scan this dir for real assets")
    parser.add_argument("--json", type=Path, default=Path("benchmarks/results.json"))
    parser.add_argument("--repeats", type=int, default=3)
    args = parser.parse_args()

    engines = _build_engines()
    known = {"gzip", "deflate", "brotli(q11)", "zstandard(l19)", "zopfli", "lz4", "snappy", "lzma/xz", "bzip2"}
    missing = sorted(known - {e.name for e in engines})
    if missing:
        print(f"[bench] engines unavailable (pip install -e 'backend[bench]'): {', '.join(missing)}\n")

    corpus = synthetic_corpus()
    if args.dir:
        extra = corpus_from_dir(args.dir)
        if extra:
            corpus.update(extra)
            print(f"[bench] added {len(extra)} assets from {args.dir}\n")

    tracemalloc.start()
    results: list[Result] = []
    for sample, data in corpus.items():
        print(f"=== {sample} ({len(data):,} bytes) ===")
        print(f"  {'engine':<16} {'http':<8} {'encoded':>12} {'ratio':>7} {'c(ms)':>9} {'d(ms)':>9} {'py-peak':>9}")
        for engine in engines:
            r = measure(engine, sample, data, args.repeats)
            results.append(r)
            if not r.ok:
                print(f"  {r.engine:<16} {'-':<8} {'FAILED':>12}   {r.error}")
                continue
            print(
                f"  {r.engine:<16} {(r.http_encoding or '-'):<8} {r.encoded:>12,} "
                f"{r.ratio:>7.3f} {r.compress_ms:>9.2f} {r.decompress_ms:>9.2f} {r.peak_py_kb:>8.0f}K"
            )
        print()
    tracemalloc.stop()

    args.json.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "note": "HTTP transfer size is validated end-to-end by scripts/check-encoding.mjs; "
        "lz4/snappy/lzma/bzip2 are benchmark-only and must never be sent as Content-Encoding.",
        "repeats": args.repeats,
        "results": [r.__dict__ for r in results],
    }
    args.json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"[bench] wrote {args.json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
