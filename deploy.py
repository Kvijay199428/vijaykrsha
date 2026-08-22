"""
vijaykrsha.online deployment script
====================================

Usage:
  python deploy.py --dev --local              # Dev: upload + rebuild dev containers
  python deploy.py --dev --tailscale          # Dev via Tailscale
  python deploy.py --prod --local             # Prod: rebuild backend + push to GitHub (prod branch)
  python deploy.py --prod --tailscale         # Prod via Tailscale + push to GitHub
  python deploy.py --prod --cloudflare        # Prod: rebuild + direct Cloudflare Pages deploy
  python deploy.py --prod --local --clean     # Full clean redeploy
"""

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

# Network hosts
LOCAL_HOST = "192.168.1.50"
TAILSCALE_HOST = "100.107.83.28"
SSH_PORT = 22009
SSH_USER = "vega"
SSH_PASSWORD = "1010"

REMOTE_ZIP = "/home/vega/update.zip"
REMOTE_DIR = "/home/vega/vijaykrsha.online"

EXCLUDE_DIRS = {
    "__pycache__",
    ".git",
    "node_modules",
    "dist",
    ".opencode",
}

EXCLUDE_FILES = {
    "env/.env.prod",
    "env/.env.dev",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def ssh_connect(host):
    if paramiko is None:
        print("\nERROR: paramiko not installed. Run: pip install paramiko")
        sys.exit(1)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"\nConnecting to {SSH_USER}@{host}:{SSH_PORT}...")
    ssh.connect(host, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD, timeout=30)
    print("Connected.")
    return ssh


def ssh_run(ssh, cmd, label=None, timeout=300):
    if label:
        print(f"\n>>> {label}")
    else:
        preview = cmd[:120] + "..." if len(cmd) > 120 else cmd
        print(f"\n>>> {preview}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True, timeout=timeout)
    exit_status = stdout.channel.recv_exit_status()
    while True:
        data = stdout.channel.recv(4096)
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.flush()
    err = stderr.read().decode("utf-8", errors="replace")
    if err:
        print(err[-2000:])
    if exit_status != 0:
        print(f"\nERROR: Command failed (exit code {exit_status})")
        return False
    return True


def create_zip():
    if os.path.exists(ZIP_FILE):
        os.remove(ZIP_FILE)

    print(f"\nZipping project -> {ZIP_FILE}")
    with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(LOCAL_DIR):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            if any(part in EXCLUDE_DIRS for part in root.replace("\\", "/").split("/")):
                continue
            for file in files:
                if file.endswith((".zip", ".pyc")):
                    continue
                local_path = os.path.join(root, file)
                arcname = os.path.relpath(local_path, LOCAL_DIR).replace("\\", "/")
                if arcname in EXCLUDE_FILES:
                    continue
                zipf.write(local_path, arcname=arcname)
    print(f"ZIP created ({os.path.getsize(ZIP_FILE) // 1024} KB).")


def cleanup_zip():
    if os.path.exists(ZIP_FILE):
        os.remove(ZIP_FILE)


def read_cloudflare_config():
    if not os.path.exists(CLOUDFLARE_YML):
        return {}
    config = {}
    with open(CLOUDFLARE_YML, "r") as f:
        for line in f:
            line = line.strip()
            if ":" in line and not line.startswith("#"):
                key, val = line.split(":", 1)
                config[key.strip()] = val.strip().strip('"').strip("'")
    return config


# ── Docker Deployment ─────────────────────────────────────────────────────────

def deploy_docker(host, env, clean=False):
    ssh = ssh_connect(host)

    create_zip()

    print("\nUploading project...")
    def progress(t, total):
        if total > 0:
            sys.stdout.write(f"\r  Upload: {int(t/total*100)}%")
            sys.stdout.flush()
    sftp = ssh.open_sftp()
    sftp.put(ZIP_FILE, REMOTE_ZIP, callback=progress)
    sftp.close()
    print("\nUpload complete.")

    compose_file = "docker-compose.dev.yml" if env == "dev" else "docker-compose.prod.yml"
    env_file = "env/.env.dev" if env == "dev" else "env/.env.prod"
    service = "backend-dev frontend-dev" if env == "dev" else "backend-prod"
    backend_service = "backend-dev" if env == "dev" else "backend-prod"

    if clean:
        print("\n[CLEAN] Removing existing containers...")
        ssh_run(ssh, f"cd {REMOTE_DIR} && docker compose -f {compose_file} --env-file {env_file} down --rmi all -v --remove-orphans || true", "Stopping containers")

    commands = [
        (f"mkdir -p {REMOTE_DIR}", "Ensuring directory exists"),
        (f"python3 -c \"import zipfile; zipfile.ZipFile('{REMOTE_ZIP}','r').extractall('{REMOTE_DIR}')\"", "Extracting files"),
        (f"rm -f {REMOTE_ZIP}", "Cleaning up zip"),
        # Build BEFORE migrating: compose run uses the existing image, so a
        # stale image would skip new migrations.
        (f"cd {REMOTE_DIR} && docker compose -f {compose_file} --env-file {env_file} build {backend_service}", f"Building {env} backend image"),
        (f"cd {REMOTE_DIR} && docker compose -f {compose_file} --env-file {env_file} run --rm {backend_service} alembic upgrade head", "Applying database migrations"),
        (f"cd {REMOTE_DIR} && docker compose -f {compose_file} --env-file {env_file} up -d {service}", f"Starting {env} containers"),
    ]

    for cmd, label in commands:
        if not ssh_run(ssh, cmd, label):
            cleanup_zip()
            ssh.close()
            sys.exit(1)

    if env == "dev":
        ssh_run(ssh, "curl -s http://localhost:26001/admin/api/health", "Verifying backend-dev health")
    else:
        ssh_run(ssh, "curl -s http://localhost:26011/admin/api/health", "Verifying backend-prod health")

    ssh.close()
    cleanup_zip()
    print(f"\n{env.upper()} Docker deployment completed.")


# ── GitHub Push ───────────────────────────────────────────────────────────────

def push_github(branch):
    print("\n" + "=" * 45)
    print(f" GITHUB PUSH (branch: {branch})")
    print("=" * 45)

    subprocess.run("git add -A", cwd=LOCAL_DIR, shell=True, check=True)

    result = subprocess.run("git status --porcelain", cwd=LOCAL_DIR, shell=True, capture_output=True, text=True)
    if not result.stdout.strip():
        print("No changes to commit.")
        return

    print(f"Changes:\n{result.stdout[:2000]}")

    msg = "deploy: update from local"
    subprocess.run(f'git commit -m "{msg}"', cwd=LOCAL_DIR, shell=True, check=True)
    print(f"Committed: {msg}")

    print(f"\nPushing to origin/{branch}...")
    result = subprocess.run(
        f"git push origin HEAD:{branch}",
        cwd=LOCAL_DIR,
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"\nERROR: Push failed\n{result.stderr}")
        sys.exit(1)

    print(f"Pushed to {branch}. Cloudflare Pages will auto-deploy.")


# ── Cloudflare Pages Direct Deploy ────────────────────────────────────────────

def deploy_cloudflare():
    print("\n" + "=" * 45)
    print(" CLOUDFLARE PAGES DIRECT DEPLOY")
    print("=" * 45)

    cf_config = read_cloudflare_config()
    account_id = cf_config.get("account_id", "")
    api_token = cf_config.get("api_token", "")
    project_name = cf_config.get("project_name", "vijaykrsha-website")

    if not account_id or not api_token:
        print("\nERROR: account_id and api_token required in cloudflare.yml")
        sys.exit(1)

    print("\nBuilding frontend...")
    result = subprocess.run("npm install && npm run build", cwd=LOCAL_DIR, shell=True)
    if result.returncode != 0:
        print("\nERROR: Build failed")
        sys.exit(1)

    if not os.path.exists(DIST_DIR):
        print("\nERROR: dist/ not found after build")
        sys.exit(1)

    env = os.environ.copy()
    env["CLOUDFLARE_ACCOUNT_ID"] = account_id
    env["CLOUDFLARE_API_TOKEN"] = api_token

    print(f"\nDeploying to Cloudflare Pages ({project_name})...")
    result = subprocess.run(
        f"npx wrangler pages deploy dist --project-name={project_name}",
        cwd=LOCAL_DIR,
        shell=True,
        env=env,
    )

    if result.returncode != 0:
        print("\nERROR: Cloudflare deployment failed")
        sys.exit(1)

    print(f"\nCloudflare Pages deployment completed.")
    print(f"  https://{project_name}.pages.dev")
    print(f"  https://vijaykrsha.online")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Deploy vijaykrsha.online",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python deploy.py --dev --local           Dev deployment via local network
  python deploy.py --dev --tailscale       Dev deployment via Tailscale
  python deploy.py --prod --local          Prod: rebuild backend + push to GitHub (prod branch)
  python deploy.py --prod --tailscale      Prod via Tailscale + push to GitHub
  python deploy.py --prod --cloudflare     Prod: rebuild + direct Cloudflare Pages deploy
  python deploy.py --prod --local --clean  Full clean redeploy
""",
    )

    network = parser.add_mutually_exclusive_group()
    network.add_argument("--local", action="store_true", help=f"Use local network ({LOCAL_HOST})")
    network.add_argument("--tailscale", action="store_true", help=f"Use Tailscale ({TAILSCALE_HOST})")

    env = parser.add_mutually_exclusive_group()
    env.add_argument("--dev", action="store_true", help="Deploy dev environment (branch: main)")
    env.add_argument("--prod", action="store_true", help="Deploy production environment (branch: prod)")

    parser.add_argument("--clean", action="store_true", help="Clean deploy: remove all containers/images/volumes first (prod only)")
    parser.add_argument("--cloudflare", action="store_true", help="Also deploy frontend directly to Cloudflare Pages (prod only)")

    args = parser.parse_args()

    if not args.dev and not args.prod:
        parser.error("Must specify --dev or --prod")

    if not args.local and not args.tailscale:
        parser.error("Must specify --local or --tailscale")

    if args.cloudflare and not args.prod:
        parser.error("--cloudflare can only be used with --prod")

    if args.clean and not args.prod:
        parser.error("--clean can only be used with --prod")

    host = LOCAL_HOST if args.local else TAILSCALE_HOST
    network_name = "local" if args.local else "tailscale"
    branch = "main" if args.dev else "prod"
    env_name = "dev" if args.dev else "prod"

    print("\n" + "=" * 45)
    print(" DEPLOYMENT CONFIGURATION")
    print("=" * 45)
    print(f"  Network:   {network_name} ({host})")
    print(f"  Env:       {env_name.upper()}")
    print(f"  Branch:    {branch}")
    print(f"  Clean:     {args.clean}")
    print(f"  Cloudflare:{' direct deploy' if args.cloudflare else ' via GitHub auto-deploy'}")
    print("=" * 45)

    deploy_docker(host, env_name, clean=args.clean)

    if args.prod:
        push_github(branch)

    if args.cloudflare:
        deploy_cloudflare()

    print("\n" + "=" * 45)
    print(" ALL DEPLOYMENTS COMPLETED")
    print("=" * 45)


if __name__ == "__main__":
    main()
