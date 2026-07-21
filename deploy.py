import os
import sys
import subprocess
import argparse
import zipfile

try:
    import paramiko
except ImportError:
    paramiko = None

try:
    import yaml
except ImportError:
    yaml = None


# ── Configuration ─────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_DIR = BASE_DIR
ZIP_FILE = os.path.join(BASE_DIR, "update.zip")
DIST_DIR = os.path.join(BASE_DIR, "dist")
CLOUDFLARE_YML = os.path.join(BASE_DIR, "cloudflare.yml")

# Docker server
DOCKER_HOST = "192.168.1.50"
DOCKER_USER = "vega"
DOCKER_PASSWORD = "1010"
REMOTE_ZIP = "/home/vega/update.zip"
REMOTE_DIR = "/home/vega/vijaykrsha.online"

EXCLUDE_DIRS = {
    "__pycache__",
    ".git",
    "node_modules",
    "dist",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def build():
    print("\n[1/3] Building frontend application...")
    result = subprocess.run("npm install && npm run build", cwd=LOCAL_DIR, shell=True)
    if result.returncode != 0:
        print("\nERROR: Build failed")
        sys.exit(1)
    print("Build completed successfully.")


def prompt_target():
    print("\n" + "=" * 45)
    print(" SELECT DEPLOYMENT TARGET")
    print("=" * 45)
    print("  1. Docker    — Deploy to Docker server (192.168.1.50)")
    print("  2. Cloudflare — Deploy to Cloudflare Pages")
    print("  3. Both       — Deploy to Docker + Cloudflare")
    print("=" * 45)

    while True:
        choice = input("\nEnter choice [1/2/3]: ").strip()
        if choice in ("1", "2", "3"):
            return {"1": "docker", "2": "cloudflare", "3": "both"}[choice]
        print("Invalid choice. Enter 1, 2, or 3.")


def read_cloudflare_config():
    if not os.path.exists(CLOUDFLARE_YML):
        print(f"\nERROR: {CLOUDFLARE_YML} not found.")
        print("Create cloudflare.yml with your Cloudflare credentials.")
        sys.exit(1)

    if yaml is None:
        # Fallback: simple YAML parser
        config = {}
        with open(CLOUDFLARE_YML, "r") as f:
            for line in f:
                line = line.strip()
                if ":" in line and not line.startswith("#"):
                    key, val = line.split(":", 1)
                    config[key.strip()] = val.strip().strip('"').strip("'")
        return config

    with open(CLOUDFLARE_YML, "r") as f:
        return yaml.safe_load(f)


# ── Docker Deployment ─────────────────────────────────────────────────────────

def deploy_docker(clean=False):
    if paramiko is None:
        print("\nERROR: paramiko not installed. Run: pip install paramiko")
        sys.exit(1)

    print("\n" + "=" * 45)
    print(" DOCKER DEPLOYMENT")
    print("=" * 45)

    # Zip source
    if os.path.exists(ZIP_FILE):
        os.remove(ZIP_FILE)

    print(f"\nZipping project -> {ZIP_FILE}")
    with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(LOCAL_DIR):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            if any(part in EXCLUDE_DIRS for part in root.replace("\\", "/").split("/")):
                continue
            for file in files:
                if file.endswith(".zip"):
                    continue
                local_path = os.path.join(root, file)
                arcname = os.path.relpath(local_path, LOCAL_DIR).replace("\\", "/")
                zipf.write(local_path, arcname=arcname)

    print("ZIP created.")

    # Connect
    print(f"\nConnecting to {DOCKER_USER}@{DOCKER_HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(DOCKER_HOST, username=DOCKER_USER, password=DOCKER_PASSWORD)

    # Upload
    print("Uploading...")
    def progress(t, total):
        if total > 0:
            sys.stdout.write(f"\r  {int(t/total*100)}%")
            sys.stdout.flush()

    sftp = ssh.open_sftp()
    sftp.put(ZIP_FILE, REMOTE_ZIP, callback=progress)
    sftp.close()
    print("\nUpload completed.")

    # Commands
    commands = []
    if clean:
        print("\n[CLEAN] Removing old containers/images/volumes...")
        commands.extend([
            f"cd {REMOTE_DIR} && docker compose down --rmi all -v --remove-orphans || true",
            f"echo '{DOCKER_PASSWORD}' | sudo -S rm -rf {REMOTE_DIR}",
            f"mkdir -p {REMOTE_DIR}",
            f"python3 -c \"import zipfile; zipfile.ZipFile('{REMOTE_ZIP}','r').extractall('{REMOTE_DIR}')\"",
            f"rm -f {REMOTE_ZIP}",
            f"cd {REMOTE_DIR} && cat > .dockerignore <<'EOF'\nnode_modules/\ndist/\n.git/\n__pycache__/\nEOF",
            "docker builder prune -af",
            f"cd {REMOTE_DIR} && docker compose build --no-cache",
            f"cd {REMOTE_DIR} && docker compose up -d --force-recreate",
        ])
    else:
        print("\n[NORMAL] Updating files and rebuilding...")
        commands.extend([
            f"mkdir -p {REMOTE_DIR}",
            f"python3 -c \"import zipfile; zipfile.ZipFile('{REMOTE_ZIP}','r').extractall('{REMOTE_DIR}')\"",
            f"rm -f {REMOTE_ZIP}",
            f"cd {REMOTE_DIR} && cat > .dockerignore <<'EOF'\nnode_modules/\ndist/\n.git/\n__pycache__/\nEOF",
            f"cd {REMOTE_DIR} && docker compose build",
            f"cd {REMOTE_DIR} && docker compose up -d",
        ])

    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
        while True:
            data = stdout.channel.recv(4096)
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.flush()
        if stdout.channel.recv_exit_status() != 0:
            print(f"\nERROR: Command failed")
            ssh.close()
            sys.exit(1)

    ssh.close()
    print("\nDocker deployment completed.")


# ── Cloudflare Pages Deployment ───────────────────────────────────────────────

def deploy_cloudflare():
    print("\n" + "=" * 45)
    print(" CLOUDFLARE PAGES DEPLOYMENT")
    print("=" * 45)

    config = read_cloudflare_config()
    account_id = config.get("account_id", "")
    api_token = config.get("api_token", "")
    project_name = config.get("project_name", "vijaykrsha-website")

    if not account_id or not api_token:
        print("\nERROR: account_id and api_token required in cloudflare.yml")
        sys.exit(1)

    if not os.path.exists(DIST_DIR):
        print(f"\nERROR: dist/ not found. Run build first.")
        sys.exit(1)

    print(f"\nProject: {project_name}")
    print(f"Account: {account_id[:8]}...")

    # Set env vars for wrangler
    env = os.environ.copy()
    env["CLOUDFLARE_ACCOUNT_ID"] = account_id
    env["CLOUDFLARE_API_TOKEN"] = api_token

    print("\nDeploying to Cloudflare Pages...")
    result = subprocess.run(
        f"npx wrangler pages deploy dist --project-name={project_name}",
        cwd=LOCAL_DIR,
        shell=True,
        env=env,
    )

    if result.returncode != 0:
        print("\nERROR: Cloudflare deployment failed")
        sys.exit(1)

    print("\nCloudflare deployment completed.")
    print(f"  https://{project_name}.pages.dev")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Deploy vijaykrsha.online")
    parser.add_argument(
        "--target",
        choices=["docker", "cloudflare", "both"],
        help="Deployment target (interactive prompt if omitted)",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Clean deploy (Docker only): remove all containers/images/volumes first.",
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="Only build, skip deployment.",
    )
    args = parser.parse_args()

    # Build
    build()

    if args.build_only:
        print("\nBuild-only mode. Skipping deployment.")
        return

    # Target selection
    target = args.target or prompt_target()

    # Deploy
    if target in ("docker", "both"):
        deploy_docker(clean=args.clean)

    if target in ("cloudflare", "both"):
        deploy_cloudflare()

    # Cleanup
    if os.path.exists(ZIP_FILE):
        os.remove(ZIP_FILE)

    print("\n" + "=" * 45)
    print(" ALL DEPLOYMENTS COMPLETED")
    print("=" * 45)


if __name__ == "__main__":
    main()
