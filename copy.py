r"""
script-copier.py
Recursively scans vijaykrsha.online source files,
reads every source file, and writes their contents into vijaykrsha.online.md
with clear file-path headers and fenced code blocks.

Usage:
    python copy.py                # whole project (backend + frontend)
    python copy.py --backend      # backend only (+ shared configs)
    python copy.py --frontend     # frontend only (+ shared configs)
    python copy.py --dry-run      # preview what would be copied
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Windows console encoding fix for emojis
import io
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ── Configuration ──────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent

FRONTEND_PATHS = [
    "src",
    "public",
    ".cloudflare",
    "functions",
    "index.html",
]

BACKEND_PATHS = [
    "backend",
    "rbac_migration.sql",
]

# Shared by both stacks
COMMON_FILES = [
    "docker-compose.yml",
    "docker-compose.dev.yml",
    "docker-compose.prod.yml",
    "Dockerfile",
    "nginx.conf",
    "nginx.api-gateway.prod.conf",
    "vite.config.ts",
    "tsconfig.json",
    "package.json",
    ".env.example",
    ".dockerignore",
    "README.md",
]

# Directories to exclude from scanning
EXCLUDE_DIR_PATHS = [
    "node_modules",
    "dist",
    ".git",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    ".wrangler",
]

# Files to exclude
EXCLUDE_FILE_PATHS = [
    "deploy.py",
    "copy.py",
    "logs.py",
    "cloudflare.zip",
]

# ── Hard denylist — never sweep these into the document ────────────────────────
DENY_DIR_NAMES = {
    "env",               # real POSTGRES_PASSWORD / MINIO_ROOT_PASSWORD
    "cloudflared",       # tunnel credentials
    "jws_keys",          # generated signing keys
    ".keys",             # local RS256 signing PEM pair
}
DENY_FILE_NAMES = {
    "cloudflare.yml",
    ".env",
}
DENY_SUFFIXES = {".pem", ".key", ".zip"}

OUTPUT_FILE = BASE_DIR / "vijaykrsha.online.md"

# Map file extensions -> markdown code-fence language tags
EXTENSION_LANG = {
    ".java":       "java",
    ".py":         "python",
    ".js":         "javascript",
    ".ts":         "typescript",
    ".jsx":        "jsx",
    ".tsx":        "tsx",
    ".json":       "json",
    ".xml":        "xml",
    ".yaml":       "yaml",
    ".yml":        "yaml",
    ".properties": "properties",
    ".sql":        "sql",
    ".sh":         "bash",
    ".bat":        "batch",
    ".gradle":     "groovy",
    ".kt":         "kotlin",
    ".scala":      "scala",
    ".proto":      "protobuf",
    ".html":       "html",
    ".css":        "css",
    ".md":         "markdown",
    ".txt":        "text",
    ".cfg":        "ini",
    ".ini":        "ini",
    ".toml":       "toml",
    ".conf":       "conf",
    ".svg":        "xml",
}

# Extensions to skip (binary / non-script files)
SKIP_EXTENSIONS = {".jar", ".class", ".war", ".ear", ".zip", ".gz", ".tar",
                   ".png", ".jpg", ".jpeg", ".gif", ".ico", ".pyc", ".ttf",
                   ".exe", ".dll", ".so", ".dylib", ".pdf", ".doc", ".docx",
                   ".mp4", ".mov", ".webm", ".mp3", ".wav", ".woff", ".woff2"}

# Language-appropriate first-line comment inside each fenced block.
# JSON has no comment syntax, so it yields no header line.
def build_comment_prefix(tag: str, rel: str) -> str:
    if tag in ("html", "xml", "markdown"):
        return f"<!-- File: {rel} -->"
    if tag in ("json", "jsonc"):
        return ""
    if tag in ("yaml", "yml", "toml", "ini", "conf", "bash", "sh", "text", "dockerfile"):
        return f"# File: {rel}"
    if tag in ("sql", "groovy", "protobuf"):
        return f"-- File: {rel}"
    if tag == "css":
        return f"/* File: {rel} */"
    return f"// File: {rel}"


def collect_files(sources: list[Path]) -> list[tuple[Path, Path]]:
    """Recursively collect all script/source files, sorted by path."""
    files = []
    for source_dir in sources:
        if not source_dir.exists():
            print(f"Source not found: {source_dir}")
            continue

        if source_dir.is_file():
            if source_dir.resolve() in EXCLUDE_FILES:
                continue
            if source_dir.suffix.lower() in SKIP_EXTENSIONS:
                continue
            if is_denied(source_dir):
                print(f"  !! DENIED by denylist (skipped): {source_dir.relative_to(BASE_DIR)}")
                continue
            files.append((source_dir, BASE_DIR))
            continue

        for root, dirs, filenames in os.walk(source_dir):
            # Prune excluded + denied directories in-place so os.walk skips them
            rootp = Path(root)
            dirs[:] = [
                d for d in dirs
                if (rootp / d).name not in DENY_DIR_NAMES
                and (rootp / d).name not in EXCLUDE_DIR_PATHS
                and (rootp / d).resolve() not in EXCLUDE_DIRS
            ]
            for fname in filenames:
                fpath = rootp / fname
                if fpath.resolve() in EXCLUDE_FILES:
                    continue
                if fpath.suffix.lower() in SKIP_EXTENSIONS:
                    continue
                if is_denied(fpath):
                    print(f"  !! DENIED by denylist (skipped): {fpath.relative_to(BASE_DIR)}")
                    continue
                files.append((fpath, source_dir))
    files.sort(key=lambda x: x[0])
    return files


def is_denied(path: Path) -> bool:
    if path.name in DENY_FILE_NAMES:
        return True
    if path.suffix.lower() in DENY_SUFFIXES:
        return True
    # Any path component matching a denied dir name
    for part in path.resolve().parts:
        if part in DENY_DIR_NAMES:
            return True
    # Bare dot-env files other than the example
    if path.name.startswith(".env") and path.name != ".env.example":
        return True
    return False


def lang_tag(filepath: Path) -> str:
    """Return the markdown language tag for a file."""
    name = filepath.name
    if name == "Dockerfile" or name.endswith(".Dockerfile"):
        return "dockerfile"
    if name.endswith("Dockerfile.dev") or name == "Dockerfile.dev":
        return "dockerfile"
    return EXTENSION_LANG.get(filepath.suffix.lower(), "")


def build_markdown(files: list[tuple[Path, Path]]) -> str:
    """Build the full markdown string with all file contents."""
    lines: list[str] = []

    for fpath, source_dir in files:
        rel = fpath.relative_to(BASE_DIR)
        tag = lang_tag(fpath)

        try:
            content = fpath.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            # Skip files that aren't valid UTF-8 (likely binary)
            print(f"  Skipped (binary): {rel}")
            continue

        lines.append(f"```{tag}")
        header = build_comment_prefix(tag, str(rel))
        if header:
            lines.append(header)
        lines.append(content.rstrip())
        lines.append("```")
        lines.append("")  # blank line between files

    return "\n".join(lines)


# Resolve shared exclude structures once
EXCLUDE_DIRS = {(BASE_DIR / p).resolve() for p in EXCLUDE_DIR_PATHS if (BASE_DIR / p).exists()}
EXCLUDE_FILES = {(BASE_DIR / p).resolve() for p in EXCLUDE_FILE_PATHS if (BASE_DIR / p).exists()}


def sources_for(args) -> list[Path]:
    if args.backend and args.frontend:
        groups = FRONTEND_PATHS + BACKEND_PATHS + COMMON_FILES
    elif args.backend:
        groups = BACKEND_PATHS + COMMON_FILES
    elif args.frontend:
        groups = FRONTEND_PATHS + COMMON_FILES
    else:
        groups = FRONTEND_PATHS + BACKEND_PATHS + COMMON_FILES

    if args.source:
        return [Path(s) for s in args.source]
    return [BASE_DIR / g for g in groups]


def main():
    parser = argparse.ArgumentParser(description="Copy source scripts into a markdown file.")
    parser.add_argument("--dry-run", action="store_true",
                        help="List files that would be copied without writing.")
    parser.add_argument("--backend", action="store_true",
                        help="Only include the backend (plus shared config files).")
    parser.add_argument("--frontend", action="store_true",
                        help="Only include the frontend (plus shared config files).")
    parser.add_argument("--source", type=str, nargs="*", default=None,
                        help="Override source paths to scan.")
    parser.add_argument("--output", type=Path, default=OUTPUT_FILE,
                        help="Output markdown file.")
    args = parser.parse_args()

    if args.backend and args.frontend:
        pass  # treated as whole project

    sources = sources_for(args)
    output = args.output

    print(f"Scanning: {[str(s) for s in sources]}")
    files = collect_files(sources)
    print(f"Found {len(files)} file(s)\n")

    if not files:
        print("Nothing to copy.")
        return

    # Print summary table
    print(f"{'#':<4} {'Relative Path':<70} {'Size':>8}")
    print("-" * 84)
    total_bytes = 0
    for i, (f, src) in enumerate(files, 1):
        rel = f.relative_to(BASE_DIR)
        size = f.stat().st_size
        total_bytes += size
        print(f"{i:<4} {str(rel):<70} {size:>8}")
    print("-" * 84)
    print(f"     Total: {len(files)} files, {total_bytes:,} bytes\n")

    if args.dry_run:
        print("Dry run -- no file written.")
        return

    # Build markdown and write
    md = build_markdown(files)
    output.write_text(md, encoding="utf-8")
    print(f"Written to: {output}")
    print(f"   Output size: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
