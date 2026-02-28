#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║              KeyVault — Full API Test Suite                  ║
║         Auth · Keys · Validate · Heartbeat · Telegram       ║
╚══════════════════════════════════════════════════════════════╝

Usage:
    python test_api.py                          # interactive mode
    python test_api.py --url http://localhost:3000 --all   # run all tests
    python test_api.py --url https://your.vercel.app --all
"""

import argparse
import json
import sys
import time
import uuid
import os
from typing import Any, Optional

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    # Fallback: no colors
    class _Dummy:
        def __getattr__(self, _): return ""
    Fore = Style = _Dummy()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE_URL = os.environ.get("KEYVAULT_URL", "https://keyauth-murex.vercel.app/")
ADMIN_EMAIL = os.environ.get("KEYVAULT_EMAIL", "admin@keyvault.io")
ADMIN_PASSWORD = os.environ.get("KEYVAULT_PASSWORD", "WzG9kkiQebJu7JF")
FAKE_HWID = f"TEST-HWID-{uuid.uuid4().hex[:12].upper()}"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Pretty helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS = 0
FAIL = 0
SKIP = 0

def header(title: str):
    w = 60
    print(f"\n{Fore.CYAN}{'━' * w}")
    print(f"  {title}")
    print(f"{'━' * w}{Style.RESET_ALL}")

def subheader(title: str):
    print(f"\n  {Fore.WHITE}{Style.BRIGHT}── {title} ──{Style.RESET_ALL}")

def ok(msg: str, detail: str = ""):
    global PASS
    PASS += 1
    d = f" {Fore.WHITE}({detail}){Style.RESET_ALL}" if detail else ""
    print(f"  {Fore.GREEN}✓{Style.RESET_ALL} {msg}{d}")

def fail(msg: str, detail: str = ""):
    global FAIL
    FAIL += 1
    d = f" {Fore.WHITE}({detail}){Style.RESET_ALL}" if detail else ""
    print(f"  {Fore.RED}✗{Style.RESET_ALL} {msg}{d}")

def skip(msg: str, detail: str = ""):
    global SKIP
    SKIP += 1
    d = f" {Fore.WHITE}({detail}){Style.RESET_ALL}" if detail else ""
    print(f"  {Fore.YELLOW}○{Style.RESET_ALL} {msg}{d}")

def info(msg: str):
    print(f"  {Fore.WHITE}  {msg}{Style.RESET_ALL}")

def dump_json(data: Any, indent: int = 4):
    print(f"{Fore.WHITE}{json.dumps(data, indent=indent, default=str)}{Style.RESET_ALL}")

def api(method: str, path: str, token: str = "", **kwargs) -> requests.Response:
    url = f"{BASE_URL}{path}"
    headers = kwargs.pop("headers", {})
    headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, url, headers=headers, timeout=15, **kwargs)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Auth
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_auth() -> Optional[str]:
    """Returns JWT token on success, None on failure."""
    header("1 · Authentication")
    token = None

    # 1.1 — Login with bad credentials
    subheader("1.1 Login — invalid credentials")
    r = api("POST", "/api/auth/login", json={"email": "nobody@test.com", "password": "wrong"})
    if r.status_code == 401:
        ok("Rejected bad credentials", f"{r.status_code}")
    else:
        fail("Expected 401", f"got {r.status_code}")

    # 1.2 — Login with missing fields
    subheader("1.2 Login — missing fields")
    r = api("POST", "/api/auth/login", json={"email": ADMIN_EMAIL})
    if r.status_code == 400:
        ok("Rejected missing password", f"{r.status_code}")
    else:
        fail("Expected 400", f"got {r.status_code}")

    # 1.3 — Login success
    subheader("1.3 Login — valid admin")
    r = api("POST", "/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        token = data["data"]["token"]
        ok("Login successful", f"token={token[:20]}...")
        info(f"User: {data['data']['user']['email']}  Role: {data['data']['user']['role']}")
    else:
        fail("Login failed", f"{r.status_code} — {data.get('error', '')}")
        return None

    # 1.4 — /api/auth/me
    subheader("1.4 GET /api/auth/me")
    r = api("GET", "/api/auth/me", token=token)
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Me endpoint works", f"email={data['data']['email']}")
    else:
        fail("Me endpoint failed", f"{r.status_code}")

    # 1.5 — Unauthorized without token
    subheader("1.5 Unauthorized check")
    r = api("GET", "/api/auth/me")
    if r.status_code == 401:
        ok("Correctly rejected unauthenticated request")
    else:
        fail("Expected 401", f"got {r.status_code}")

    return token


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Key CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_keys(token: str) -> Optional[dict]:
    """Returns created key dict on success."""
    header("2 · License Key CRUD")
    created_key = None

    # 2.1 — Create DAILY key
    subheader("2.1 Create key — DAILY plan")
    r = api("POST", "/api/keys", token=token, json={
        "plan": "DAILY",
        "count": 1,
        "maxSessions": 2,
    })
    data = r.json()
    if r.status_code == 201 and data.get("success"):
        created_key = data["data"]["keys"][0]
        ok("Key created", f"plan=DAILY  key={created_key['key']}")
        info(f"ID: {created_key['id']}")
        info(f"Mask: {created_key['mask']}")
        info(f"Expires: {created_key['expiresAt']}")
    else:
        fail("Key creation failed", f"{r.status_code} — {data.get('error', '')}")
        return None

    # 2.2 — Create WEEKLY key
    subheader("2.2 Create key — WEEKLY plan")
    r = api("POST", "/api/keys", token=token, json={"plan": "WEEKLY", "count": 1})
    data = r.json()
    if r.status_code == 201:
        k = data["data"]["keys"][0]
        ok("Key created", f"plan=WEEKLY  key={k['key']}")
    else:
        fail("WEEKLY key creation failed")

    # 2.3 — Create MONTHLY key
    subheader("2.3 Create key — MONTHLY plan")
    r = api("POST", "/api/keys", token=token, json={"plan": "MONTHLY", "count": 1})
    data = r.json()
    if r.status_code == 201:
        k = data["data"]["keys"][0]
        ok("Key created", f"plan=MONTHLY  key={k['key']}")
    else:
        fail("MONTHLY key creation failed")

    # 2.4 — Create LIFETIME key
    subheader("2.4 Create key — LIFETIME plan")
    r = api("POST", "/api/keys", token=token, json={"plan": "LIFETIME", "count": 1})
    data = r.json()
    if r.status_code == 201:
        k = data["data"]["keys"][0]
        ok("Key created", f"plan=LIFETIME  key={k['key']}")
    else:
        fail("LIFETIME key creation failed")

    # 2.5 — Create CUSTOM key (90 days)
    subheader("2.5 Create key — CUSTOM (90 days)")
    r = api("POST", "/api/keys", token=token, json={
        "plan": "CUSTOM",
        "customDays": 90,
        "count": 1,
        "note": "Test custom key"
    })
    data = r.json()
    if r.status_code == 201:
        k = data["data"]["keys"][0]
        ok("Key created", f"plan=CUSTOM/90d  key={k['key']}")
    else:
        fail("CUSTOM key creation failed", data.get("error", ""))

    # 2.6 — Create CUSTOM without customDays (should fail)
    subheader("2.6 Create CUSTOM without customDays — should fail")
    r = api("POST", "/api/keys", token=token, json={"plan": "CUSTOM", "count": 1})
    if r.status_code == 400:
        ok("Correctly rejected CUSTOM without customDays")
    else:
        fail("Expected 400", f"got {r.status_code}")

    # 2.7 — Invalid plan
    subheader("2.7 Invalid plan — should fail")
    r = api("POST", "/api/keys", token=token, json={"plan": "INVALID_PLAN", "count": 1})
    if r.status_code == 400:
        ok("Correctly rejected invalid plan")
    else:
        fail("Expected 400", f"got {r.status_code}")

    # 2.8 — Batch create (3 keys)
    subheader("2.8 Batch create — 3 DAILY keys")
    r = api("POST", "/api/keys", token=token, json={"plan": "DAILY", "count": 3})
    data = r.json()
    if r.status_code == 201 and len(data["data"]["keys"]) == 3:
        ok("Batch created 3 keys")
    else:
        fail("Batch creation failed")

    # 2.9 — List keys
    subheader("2.9 List keys")
    r = api("GET", "/api/keys?page=1&limit=5", token=token)
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        pg = data["data"]["pagination"]
        ok("Keys listed", f"total={pg['total']}  page={pg['page']}/{pg['totalPages']}")
    else:
        fail("Key listing failed")

    # 2.10 — Get single key
    if created_key:
        subheader("2.10 Get single key details")
        r = api("GET", f"/api/keys/{created_key['id']}", token=token)
        data = r.json()
        if r.status_code == 200 and data.get("success"):
            ok("Key detail retrieved", f"status={data['data']['status']}")
        else:
            fail("Key detail failed")

    # 2.11 — PATCH key (update maxSessions)
    if created_key:
        subheader("2.11 PATCH key — update maxSessions")
        r = api("PATCH", f"/api/keys/{created_key['id']}", token=token, json={"maxSessions": 5})
        data = r.json()
        if r.status_code == 200 and data.get("success"):
            ok("Key updated", "maxSessions → 5")
        else:
            fail("Key patch failed")

    # 2.12 — PATCH key (reset HWID)
    if created_key:
        subheader("2.12 PATCH key — reset HWID")
        r = api("PATCH", f"/api/keys/{created_key['id']}", token=token, json={"resetHwid": True})
        data = r.json()
        if r.status_code == 200:
            ok("HWID reset")
        else:
            fail("HWID reset failed")

    return created_key


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Validate
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_validate(raw_key: str) -> bool:
    header("3 · License Validation (/api/validate)")

    # 3.1 — Validate with correct key + HWID (should bind)
    subheader("3.1 First validation — HWID binding")
    r = api("POST", "/api/validate", json={"key": raw_key, "hwid": FAKE_HWID})
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        d = data.get("data", {})
        # Response may be encrypted; check what we can
        ok("Validation successful — HWID bound", f"plan={d.get('plan', '?')}")
        if d.get("nonce"):
            info(f"Nonce: {d['nonce'][:16]}...")
        if d.get("valid") is not None:
            info(f"Valid: {d['valid']}")
    else:
        fail("Validation failed", f"{r.status_code} — {data.get('error', '')}")
        return False

    # 3.2 — Validate again (same HWID — should pass)
    subheader("3.2 Re-validate same HWID")
    r = api("POST", "/api/validate", json={"key": raw_key, "hwid": FAKE_HWID})
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Re-validation passed (same HWID)")
    else:
        fail("Re-validation with same HWID rejected", data.get("error", ""))

    # 3.3 — Validate different HWID (should be rejected — locked)
    subheader("3.3 Different HWID — should be rejected")
    other_hwid = f"OTHER-HWID-{uuid.uuid4().hex[:12].upper()}"
    r = api("POST", "/api/validate", json={"key": raw_key, "hwid": other_hwid})
    if r.status_code == 403:
        ok("Correctly rejected different HWID")
    else:
        fail("Expected 403 for HWID mismatch", f"got {r.status_code}")

    # 3.4 — Validate missing fields
    subheader("3.4 Missing fields")
    r = api("POST", "/api/validate", json={"key": raw_key})
    if r.status_code == 400:
        ok("Rejected missing hwid")
    else:
        fail("Expected 400", f"got {r.status_code}")

    # 3.5 — Invalid key
    subheader("3.5 Invalid license key")
    r = api("POST", "/api/validate", json={"key": "TOTALLY-FAKE-KEY", "hwid": FAKE_HWID})
    if r.status_code == 401:
        ok("Rejected invalid key")
    else:
        fail("Expected 401", f"got {r.status_code}")

    return True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Heartbeat
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_heartbeat(raw_key: str):
    header("4 · Heartbeat (/api/heartbeat)")

    # 4.1 — Keep-alive
    subheader("4.1 Heartbeat — keep alive")
    r = api("POST", "/api/heartbeat", json={"key": raw_key, "hwid": FAKE_HWID})
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Heartbeat acknowledged", f"status={data['data'].get('status')}")
    else:
        fail("Heartbeat failed", f"{r.status_code}")

    # 4.2 — Wrong HWID
    subheader("4.2 Heartbeat — wrong HWID")
    r = api("POST", "/api/heartbeat", json={"key": raw_key, "hwid": "WRONG-HWID-123"})
    if r.status_code == 403:
        ok("Rejected wrong HWID")
    else:
        fail("Expected 403", f"got {r.status_code}")

    # 4.3 — Deactivate session
    subheader("4.3 Deactivate session")
    r = api("POST", "/api/heartbeat", json={"key": raw_key, "hwid": FAKE_HWID, "action": "deactivate"})
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Session deactivated")
    else:
        fail("Deactivation failed", f"{r.status_code}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Telegram API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_telegram(raw_key: str, token: str, key_id: str):
    header("5 · Telegram API (/api/telegram)")

    # First reset HWID so telegram can bind fresh
    api("PATCH", f"/api/keys/{key_id}", token=token, json={"resetHwid": True})

    tg_hwid = f"TG-PC-HWID-{uuid.uuid4().hex[:8].upper()}"

    # 5.1 — Info (no HWID — read only)
    subheader("5.1 Info — read-only lookup")
    r = api("POST", "/api/telegram", json={
        "action": "info",
        "key": raw_key,
        "telegram_id": "123456789",
    })
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        d = data["data"]
        ok("Info returned", f"valid={d.get('valid')}  plan={d.get('plan')}")
        info(f"Status: {d.get('status')}  Sessions: {d.get('sessions')}")
    else:
        fail("Info failed", data.get("error", ""))

    # 5.2 — Validate with HWID (first bind)
    subheader("5.2 Validate — bind PC HWID via Telegram")
    r = api("POST", "/api/telegram", json={
        "action": "validate",
        "key": raw_key,
        "hwid": tg_hwid,
        "telegram_id": "123456789",
        "telegram_username": "test_user",
    })
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        d = data["data"]
        ok("Telegram validate succeeded", f"plan={d.get('plan')}")
        if d.get("nonce"):
            info(f"Nonce: {d['nonce'][:16]}...")
    else:
        fail("Telegram validate failed", data.get("error", ""))

    # 5.3 — Validate again, same HWID
    subheader("5.3 Validate — same HWID again")
    r = api("POST", "/api/telegram", json={
        "action": "validate",
        "key": raw_key,
        "hwid": tg_hwid,
        "telegram_id": "123456789",
    })
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Re-validate passed (same HWID)")
    else:
        fail("Re-validate rejected", data.get("error", ""))

    # 5.4 — Validate with different HWID (should fail)
    subheader("5.4 Validate — different HWID (should fail)")
    r = api("POST", "/api/telegram", json={
        "action": "validate",
        "key": raw_key,
        "hwid": "DIFFERENT-PC-HWID-999",
        "telegram_id": "123456789",
    })
    if r.status_code == 403:
        ok("Rejected different HWID")
    else:
        fail("Expected 403 for HWID mismatch", f"got {r.status_code}")

    # 5.5 — Info with HWID (check match)
    subheader("5.5 Info with HWID — check hwid_match")
    r = api("POST", "/api/telegram", json={
        "action": "info",
        "key": raw_key,
        "hwid": tg_hwid,
    })
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        d = data["data"]
        match = d.get("hwid_match")
        if match is True:
            ok("HWID match confirmed", "hwid_match=true")
        else:
            fail("HWID should match", f"hwid_match={match}")
    else:
        fail("Info with HWID failed")

    # 5.6 — Reset HWID
    subheader("5.6 Reset HWID via Telegram")
    r = api("POST", "/api/telegram", json={
        "action": "reset_hwid",
        "key": raw_key,
        "telegram_id": "123456789",
    })
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("HWID reset via Telegram")
    else:
        fail("HWID reset failed", data.get("error", ""))

    # 5.7 — Missing action
    subheader("5.7 Missing action — should fail")
    r = api("POST", "/api/telegram", json={"key": raw_key})
    if r.status_code == 400:
        ok("Rejected missing action")
    else:
        fail("Expected 400", f"got {r.status_code}")

    # 5.8 — Invalid key
    subheader("5.8 Invalid key via Telegram")
    r = api("POST", "/api/telegram", json={"action": "info", "key": "FAKE-KEY-000"})
    if r.status_code == 404:
        ok("Rejected invalid key")
    else:
        fail("Expected 404", f"got {r.status_code}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Stats & Logs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_stats_logs(token: str):
    header("6 · Stats & Logs")

    # 6.1 — Stats
    subheader("6.1 GET /api/stats")
    r = api("GET", "/api/stats", token=token)
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        d = data["data"]
        ok("Stats retrieved")
        info(f"Keys — total: {d['keys']['total']}  active: {d['keys']['active']}  expired: {d['keys']['expired']}")
        info(f"Validations — total: {d['validations']['total']}  24h: {d['validations']['last24h']}")
        info(f"Users: {d['users']}")
        plans = ", ".join([f"{p['plan']}={p['count']}" for p in d.get("planDistribution", [])])
        if plans:
            info(f"Plans: {plans}")
    else:
        fail("Stats failed", f"{r.status_code}")

    # 6.2 — Stats unauthorized
    subheader("6.2 Stats — no token")
    r = api("GET", "/api/stats")
    if r.status_code == 401:
        ok("Rejected unauthorized stats request")
    else:
        fail("Expected 401", f"got {r.status_code}")

    # 6.3 — Logs
    subheader("6.3 GET /api/logs")
    r = api("GET", "/api/logs?page=1&limit=10", token=token)
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        pg = data["data"]["pagination"]
        logs = data["data"]["logs"]
        ok("Logs retrieved", f"total={pg['total']}  returned={len(logs)}")
        if logs:
            info(f"Latest: {logs[0]['action']}  success={logs[0]['success']}  {logs[0]['createdAt']}")
    else:
        fail("Logs failed", f"{r.status_code}")

    # 6.4 — Logs with filter
    subheader("6.4 Logs — filter by action 'validate'")
    r = api("GET", "/api/logs?action=validate&limit=5", token=token)
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Filtered logs", f"total={data['data']['pagination']['total']}")
    else:
        fail("Filtered logs failed")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Key lifecycle (ban + revoke + delete)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_key_lifecycle(token: str, key_id: str, raw_key: str):
    header("7 · Key Lifecycle (Ban / Revoke / Delete)")

    # 7.1 — Ban key
    subheader("7.1 Ban key")
    r = api("PATCH", f"/api/keys/{key_id}", token=token, json={"status": "BANNED"})
    data = r.json()
    if r.status_code == 200 and data.get("success"):
        ok("Key banned")
    else:
        fail("Ban failed", data.get("error", ""))

    # 7.2 — Try to validate banned key
    subheader("7.2 Validate banned key — should fail")
    r = api("POST", "/api/validate", json={"key": raw_key, "hwid": FAKE_HWID})
    if r.status_code in (401, 403):
        ok("Banned key rejected", f"{r.status_code}")
    else:
        fail("Expected 401/403", f"got {r.status_code}")

    # 7.3 — Re-activate
    subheader("7.3 Re-activate key")
    r = api("PATCH", f"/api/keys/{key_id}", token=token, json={"status": "ACTIVE"})
    data = r.json()
    if r.status_code == 200:
        ok("Key re-activated")
    else:
        fail("Re-activation failed")

    # 7.4 — Delete (revoke)
    subheader("7.4 Delete key")
    r = api("DELETE", f"/api/keys/{key_id}", token=token)
    if r.status_code == 200:
        ok("Key deleted")
    else:
        fail("Delete failed", f"got {r.status_code}")

    # 7.5 — Validate deleted key
    subheader("7.5 Validate deleted key — should fail")
    r = api("POST", "/api/validate", json={"key": raw_key, "hwid": FAKE_HWID})
    if r.status_code in (401, 403):
        ok("Deleted key rejected")
    else:
        fail("Expected rejection", f"got {r.status_code}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Test: Logout
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def test_logout(token: str):
    header("8 · Logout")

    subheader("8.1 POST /api/auth/logout")
    r = api("POST", "/api/auth/logout", token=token)
    if r.status_code == 200:
        ok("Logout successful")
    else:
        fail("Logout failed", f"{r.status_code}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Interactive menu
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def show_menu():
    print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════╗
║         KeyVault API Test Suite — Menu               ║
╚══════════════════════════════════════════════════════╝{Style.RESET_ALL}

  {Fore.WHITE}Server: {Fore.GREEN}{BASE_URL}{Style.RESET_ALL}
  {Fore.WHITE}Admin:  {Fore.GREEN}{ADMIN_EMAIL}{Style.RESET_ALL}
  {Fore.WHITE}HWID:   {Fore.GREEN}{FAKE_HWID}{Style.RESET_ALL}

  {Fore.WHITE}[1]{Style.RESET_ALL} Auth tests only
  {Fore.WHITE}[2]{Style.RESET_ALL} Key CRUD tests
  {Fore.WHITE}[3]{Style.RESET_ALL} Validation tests
  {Fore.WHITE}[4]{Style.RESET_ALL} Heartbeat tests
  {Fore.WHITE}[5]{Style.RESET_ALL} Telegram API tests
  {Fore.WHITE}[6]{Style.RESET_ALL} Stats & Logs tests
  {Fore.WHITE}[7]{Style.RESET_ALL} Key lifecycle (ban/revoke/delete)
  {Fore.WHITE}[A]{Style.RESET_ALL} Run ALL tests
  {Fore.WHITE}[Q]{Style.RESET_ALL} Quit
""")


def run_all():
    start = time.time()

    token = test_auth()
    if not token:
        print(f"\n{Fore.RED}⚠ Auth failed — cannot continue.{Style.RESET_ALL}")
        return

    key = test_keys(token)
    if not key:
        print(f"\n{Fore.RED}⚠ Key creation failed — cannot continue.{Style.RESET_ALL}")
        return

    raw_key = key["key"]
    key_id = key["id"]

    test_validate(raw_key)
    test_heartbeat(raw_key)
    test_telegram(raw_key, token, key_id)
    test_stats_logs(token)
    test_key_lifecycle(token, key_id, raw_key)
    test_logout(token)

    elapsed = time.time() - start
    print_summary(elapsed)


def print_summary(elapsed: float):
    total = PASS + FAIL + SKIP
    print(f"""
{Fore.CYAN}{'━' * 60}
  RESULTS
{'━' * 60}{Style.RESET_ALL}
  {Fore.GREEN}✓ Passed:  {PASS}{Style.RESET_ALL}
  {Fore.RED}✗ Failed:  {FAIL}{Style.RESET_ALL}
  {Fore.YELLOW}○ Skipped: {SKIP}{Style.RESET_ALL}
  ─────────────────
  Total:     {total}    Time: {elapsed:.2f}s
""")
    if FAIL == 0:
        print(f"  {Fore.GREEN}{Style.BRIGHT}ALL TESTS PASSED ✓{Style.RESET_ALL}\n")
    else:
        print(f"  {Fore.RED}{Style.BRIGHT}{FAIL} TEST(S) FAILED ✗{Style.RESET_ALL}\n")


def interactive():
    """Interactive menu loop."""
    token = None
    created_key = None

    while True:
        show_menu()
        choice = input(f"  {Fore.CYAN}>{Style.RESET_ALL} ").strip().upper()

        if choice == "Q":
            print(f"\n{Fore.WHITE}Bye!{Style.RESET_ALL}\n")
            break

        if choice == "A":
            run_all()
            continue

        if choice == "1":
            token = test_auth()

        elif choice in ("2", "3", "4", "5", "6", "7"):
            if not token:
                print(f"\n  {Fore.YELLOW}⚠ Login first (run test 1){Style.RESET_ALL}")
                token = test_auth()
                if not token:
                    continue

            if choice == "2":
                created_key = test_keys(token)

            elif choice == "3":
                if not created_key:
                    print(f"\n  {Fore.YELLOW}⚠ Create a key first (run test 2){Style.RESET_ALL}")
                    created_key = test_keys(token)
                    if not created_key:
                        continue
                test_validate(created_key["key"])

            elif choice == "4":
                if not created_key:
                    print(f"\n  {Fore.YELLOW}⚠ Create and validate a key first (2 → 3){Style.RESET_ALL}")
                    continue
                test_heartbeat(created_key["key"])

            elif choice == "5":
                if not created_key:
                    print(f"\n  {Fore.YELLOW}⚠ Create a key first (run test 2){Style.RESET_ALL}")
                    created_key = test_keys(token)
                    if not created_key:
                        continue
                test_telegram(created_key["key"], token, created_key["id"])

            elif choice == "6":
                test_stats_logs(token)

            elif choice == "7":
                if not created_key:
                    print(f"\n  {Fore.YELLOW}⚠ Create a key first (run test 2){Style.RESET_ALL}")
                    created_key = test_keys(token)
                    if not created_key:
                        continue
                test_key_lifecycle(token, created_key["id"], created_key["key"])
                created_key = None  # key is deleted after this

        else:
            print(f"  {Fore.RED}Unknown option.{Style.RESET_ALL}")

        input(f"\n  {Fore.WHITE}Press Enter to continue...{Style.RESET_ALL}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Main
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def main():
    global BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD

    parser = argparse.ArgumentParser(description="KeyVault API Test Suite")
    parser.add_argument("--url", default=BASE_URL, help="Base URL of the KeyVault API")
    parser.add_argument("--email", default=ADMIN_EMAIL, help="Admin email")
    parser.add_argument("--password", default=ADMIN_PASSWORD, help="Admin password")
    parser.add_argument("--all", action="store_true", help="Run all tests non-interactively")
    args = parser.parse_args()

    BASE_URL = args.url.rstrip("/")
    ADMIN_EMAIL = args.email
    ADMIN_PASSWORD = args.password

    print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════════╗
║              KeyVault — Full API Test Suite                  ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
  Server:   {Fore.GREEN}{BASE_URL}{Style.RESET_ALL}
  Admin:    {Fore.GREEN}{ADMIN_EMAIL}{Style.RESET_ALL}
  Test HWID:{Fore.GREEN} {FAKE_HWID}{Style.RESET_ALL}
""")

    if args.all:
        run_all()
    else:
        interactive()


if __name__ == "__main__":
    main()
