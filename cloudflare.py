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

file_count = 0
total_bytes = 0

with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            local_path = os.path.join(root, file)
            arcname = os.path.relpath(local_path, DIST_DIR).replace("\\", "/")
            zipf.write(local_path, arcname=arcname)
            file_count += 1
            total_bytes += os.path.getsize(local_path)

print(f"Done: {file_count} files, {total_bytes:,} bytes")
print(f"ZIP size: {os.path.getsize(ZIP_FILE):,} bytes")
