import argparse
import signal
import paramiko
import sys
import re

HOST = "192.168.1.50"
PORT = 24
USER = "vega"
PASSWORD = "1010"
REMOTE_DIR = "/home/vega/vijaykrsha.online"
LOG_FILE = "vijaykrsha.log"

DEV_FILES = "-f docker-compose.dev.yml"
PROD_FILES = "-f docker-compose.prod.yml"
ALL_FILES = "-f docker-compose.dev.yml -f docker-compose.prod.yml"

COLORS = [
    '\033[96m',
    '\033[92m',
    '\033[93m',
    '\033[94m',
    '\033[95m',
]
RESET = '\033[0m'

container_colors = {}

def get_color(container_name):
    if container_name not in container_colors:
        color = COLORS[len(container_colors) % len(COLORS)]
        container_colors[container_name] = color
    return container_colors[container_name]

def colorize_line(line):
    match = re.match(r'^([^|]+?)\s*\|\s?(.*)$', line.rstrip('\r\n'))
    if match:
        container_name = match.group(1).strip()
        log_content = match.group(2)
        color = get_color(container_name)
        return f"{color}{container_name} |{RESET} {log_content}\n"
    return line

parser = argparse.ArgumentParser(description="Tail live logs from the vijaykrsha containers.")
group = parser.add_mutually_exclusive_group()
group.add_argument("--dev", action="store_true", help="Only dev containers.")
group.add_argument("--prod", action="store_true", help="Only prod containers.")
args = parser.parse_args()

compose_files = ALL_FILES
scope_label = "all (dev + prod)"
if args.dev:
    compose_files = DEV_FILES
    scope_label = "dev only"
elif args.prod:
    compose_files = PROD_FILES
    scope_label = "prod only"

print(f"Connecting to {USER}@{HOST}:{PORT}...")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

stdin = stdout = stderr = None
_stopping = False

def _handle_sigint(sig, frame):
    """Close the SSH channel on CTRL+C so readline() unblocks immediately."""
    global _stopping
    _stopping = True
    print("\nStopping log stream...")
    try:
        if stdout is not None:
            stdout.channel.close()
    except Exception:
        pass

signal.signal(signal.SIGINT, _handle_sigint)

try:
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD)
    transport = ssh.get_transport()
    transport.set_keepalive(10)

    print(f"\n--- Live Docker logs for {REMOTE_DIR} ({scope_label}) ---")
    print(f"--- Saving logs to {LOG_FILE} ---")
    print("--- Press CTRL + C to stop ---\n")

    cmd = (
        f"cd {REMOTE_DIR} && "
        f"if command -v docker-compose >/dev/null 2>&1; "
        f"then docker-compose {compose_files} logs -f --tail 50 --no-color 2>/dev/null; "
        f"else docker compose {compose_files} logs -f --tail 50 --no-color 2>/dev/null; fi"
    )

    # exec_command gives proper file-like handles that block on readline(),
    # ensuring live output is streamed continuously without premature exit.
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)

    with open(LOG_FILE, "a", encoding="utf-8") as log_f:
        for raw_line in iter(stdout.readline, ""):
            if _stopping:
                break
            log_f.write(raw_line)
            log_f.flush()

            sys.stdout.write(colorize_line(raw_line))
            sys.stdout.flush()

except Exception as e:
    if not _stopping:
        print(f"Error: {e}")

finally:
    try:
        ssh.close()
    except Exception:
        pass
    print("Done.")
    sys.exit(0)
