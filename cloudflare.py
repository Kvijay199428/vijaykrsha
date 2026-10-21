import os
import zipfile
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")
ZIP_FILE = os.path.join(BASE_DIR, "cloudflare.zip")

if not os.path.exists(DIST_DIR):
    print("ERROR: dist/ folder not found. Run 'npm run build' first.")
    sys.exit(1)

if os.path.exists(ZIP_FILE):
    os.remove(ZIP_FILE)

print(f"Creating {ZIP_FILE}...")

# Precompressed sidecars are for nginx-served builds only (VITE_PRECOMPRESS=1 +
# scripts/precompress-icons.mjs). Cloudflare Pages does not serve sidecar files
# and compresses on the wire, so a .gz/.br/.zst in the upload is pure dead
# weight. Skip them defensively even if someone zips a Docker-built dist/.
# See docs/compression.md.
SIDECAR_SUFFIXES = (".gz", ".br", ".zst")

file_count = 0
total_bytes = 0
skipped_sidecars = 0

with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            if file.endswith(SIDECAR_SUFFIXES):
                skipped_sidecars += 1
                continue
            local_path = os.path.join(root, file)
            arcname = os.path.relpath(local_path, DIST_DIR).replace("\\", "/")
            zipf.write(local_path, arcname=arcname)
            file_count += 1
            total_bytes += os.path.getsize(local_path)

print(f"Done: {file_count} files, {total_bytes:,} bytes")
if skipped_sidecars:
    print(f"Skipped {skipped_sidecars} precompressed sidecar(s) (not served by Pages)")
print(f"ZIP size: {os.path.getsize(ZIP_FILE):,} bytes")
