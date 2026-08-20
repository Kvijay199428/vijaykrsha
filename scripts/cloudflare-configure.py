"""
Cloudflare Tunnel configuration for vijaykrsha.online
======================================================

Configures the Cloudflare Tunnel to route:
  api.vijaykrsha.online -> http://backend-prod:8000

Reads credentials from cloudflare.yml in the project root.

Usage:
  python scripts/cloudflare-configure.py              # Configure tunnel + DNS
  python scripts/cloudflare-configure.py --read-only  # Only read current config
  python scripts/cloudflare-configure.py --dns-only   # Only check/create DNS
"""

import json
import os
import sys
import argparse

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLOUDFLARE_YML = os.path.join(BASE_DIR, "cloudflare.yml")

TUNNEL_ID = "d420e292-70c6-4352-ada3-62fd52d52464"
HOSTNAME = "api.vijaykrsha.online"
SERVICE = "http://backend-prod:8000"
TUNNEL_CNAME = f"{TUNNEL_ID}.cfargotunnel.com"
DOMAIN = "vijaykrsha.online"


def read_config():
    config = {}
    with open(CLOUDFLARE_YML, "r") as f:
        for line in f:
            line = line.strip()
            if ":" in line and not line.startswith("#"):
                key, val = line.split(":", 1)
                config[key.strip()] = val.strip().strip('"').strip("'")
    return config


def api_get(url, token):
    r = requests.get(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    return r.json()


def api_put(url, token, data):
    r = requests.put(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }, json=data)
    return r.json()


def api_post(url, token, data):
    r = requests.post(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }, json=data)
    return r.json()


def get_account_id(token):
    r = requests.get(
        "https://api.cloudflare.com/client/v4/accounts",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    data = r.json()
    if data.get("success") and data.get("result"):
        return data["result"][0]["id"]
    return None


def get_zone_id(token, domain):
    r = requests.get(
        f"https://api.cloudflare.com/client/v4/zones?name={domain}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    data = r.json()
    if data.get("success") and data.get("result"):
        return data["result"][0]["id"]
    return None


def read_tunnel_config(account_id, token):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel/{TUNNEL_ID}/configurations"
    return api_get(url, token)


def update_tunnel_config(account_id, token, ingress):
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel/{TUNNEL_ID}/configurations"
    payload = {"config": {"ingress": ingress}}
    return api_put(url, token, payload)


def check_dns(zone_id, token, hostname):
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records?type=CNAME&name={hostname}"
    return api_get(url, token)


def create_dns(zone_id, token, hostname, target):
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
    payload = {
        "type": "CNAME",
        "name": hostname,
        "content": target,
        "ttl": 1,
        "proxied": True,
    }
    return api_post(url, token, payload)


def main():
    parser = argparse.ArgumentParser(description="Configure Cloudflare Tunnel for vijaykrsha.online")
    parser.add_argument("--read-only", action="store_true", help="Only read current tunnel configuration")
    parser.add_argument("--dns-only", action="store_true", help="Only check/create DNS record")
    args = parser.parse_args()

    print("=" * 50)
    print(" CLOUDFLARE TUNNEL CONFIGURATION")
    print("=" * 50)

    # Read credentials
    config = read_config()
    api_token = config.get("api_token", "")
    if not api_token:
        print("\nERROR: api_token not found in cloudflare.yml")
        sys.exit(1)

    # Get account ID from cloudflare.yml or from API
    account_id = config.get("account_id", "")
    if not account_id:
        print("\nFetching account ID from API...")
        account_id = get_account_id(api_token)
        if not account_id:
            print("ERROR: Could not fetch account ID")
            sys.exit(1)
        print(f"Account ID: {account_id}")

    print(f"Account ID: {account_id}")
    print(f"Tunnel ID:  {TUNNEL_ID}")
    print(f"Hostname:   {HOSTNAME}")
    print(f"Service:    {SERVICE}")

    # ── Step 1: Read current tunnel config ──
    print("\n--- Step 1: Reading current tunnel configuration ---")
    result = read_tunnel_config(account_id, api_token)

    if not result.get("success"):
        print(f"ERROR: {json.dumps(result, indent=2)}")
        sys.exit(1)

    current_ingress = result.get("result", {}).get("config", {}).get("ingress", [])
    print(f"Current ingress rules: {len(current_ingress)}")
    for i, rule in enumerate(current_ingress):
        hostname = rule.get("hostname", "(catch-all)")
        service = rule.get("service", "")
        print(f"  [{i}] {hostname} -> {service}")

    if args.read_only:
        print("\nRead-only mode. Exiting.")
        return

    # ── Step 2: Build new ingress ──
    print(f"\n--- Step 2: Updating tunnel ingress ---")

    # Remove existing rule for this hostname (if any)
    new_ingress = [r for r in current_ingress if r.get("hostname") != HOSTNAME]

    # Remove catch-all rule (last rule) if present
    if new_ingress and new_ingress[-1].get("service") == "http_status:404":
        new_ingress = new_ingress[:-1]

    # Add/update our rule
    new_ingress.append({
        "hostname": HOSTNAME,
        "service": SERVICE,
    })

    # Add catch-all rule at the end
    new_ingress.append({
        "service": "http_status:404",
    })

    print("New ingress rules:")
    for i, rule in enumerate(new_ingress):
        hostname = rule.get("hostname", "(catch-all)")
        service = rule.get("service", "")
        print(f"  [{i}] {hostname} -> {service}")

    # ── Step 3: PUT updated config ──
    print("\n--- Step 3: Applying tunnel configuration ---")
    result = update_tunnel_config(account_id, api_token, new_ingress)

    if not result.get("success"):
        print(f"ERROR: {json.dumps(result, indent=2)}")
        sys.exit(1)

    print("Tunnel configuration updated successfully.")

    # ── Step 4: DNS ──
    if not args.dns_only or True:
        print(f"\n--- Step 4: Checking DNS record for {HOSTNAME} ---")
        zone_id = get_zone_id(api_token, DOMAIN)
        if not zone_id:
            print(f"ERROR: Could not find zone for {DOMAIN}")
            sys.exit(1)

        print(f"Zone ID: {zone_id}")

        dns_result = check_dns(zone_id, api_token, HOSTNAME)
        existing = dns_result.get("result", [])

        if existing:
            print(f"DNS record already exists:")
            for rec in existing:
                print(f"  {rec['name']} -> {rec['content']} (proxied: {rec.get('proxied', False)})")
        else:
            print(f"Creating DNS record: {HOSTNAME} -> {TUNNEL_CNAME}")
            create_result = create_dns(zone_id, api_token, HOSTNAME, TUNNEL_CNAME)
            if create_result.get("success"):
                print("DNS record created.")
            else:
                print(f"ERROR: {json.dumps(create_result, indent=2)}")
                sys.exit(1)

    # ── Step 5: Verify ──
    print("\n--- Step 5: Verifying final configuration ---")
    result = read_tunnel_config(account_id, api_token)
    final_ingress = result.get("result", {}).get("config", {}).get("ingress", [])

    found = False
    for rule in final_ingress:
        if rule.get("hostname") == HOSTNAME:
            found = True
            print(f"  {HOSTNAME} -> {rule.get('service')}")
            break

    if not found:
        print(f"\nWARNING: {HOSTNAME} not found in final config!")
        sys.exit(1)

    print("\n" + "=" * 50)
    print(" CONFIGURATION COMPLETE")
    print("=" * 50)
    print(f"  Tunnel:  {TUNNEL_ID}")
    print(f"  Hostname: {HOSTNAME}")
    print(f"  Service:  {SERVICE}")
    print(f"  DNS:      {HOSTNAME} -> {TUNNEL_CNAME} (proxied)")
    print()
    print("Test:")
    print(f"  curl https://{HOSTNAME}/admin/api/health")
    print(f"  curl https://{DOMAIN}/api/admin/api/health")
    print("=" * 50)


if __name__ == "__main__":
    main()
