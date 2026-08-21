from fastapi import Request
from app.security.risk import RiskSignals


_BOT_UA_PATTERNS = (
    "python-requests", "python-urllib", "python-httpx", "aiohttp",
    "curl/", "wget/", "go-http-client", "java/",
    "okhttp/", "apache-httpclient", "libcurl",
    "headless", "phantom", "selenium", "puppeteer", "playwright",
    "bot", "spider", "crawler", "scraper",
)


def analyze_request_signals(request: Request) -> RiskSignals:
    signals = RiskSignals()
    ua = request.headers.get("user-agent", "")
    accept = request.headers.get("accept", "")
    sec_fetch_site = request.headers.get("sec-fetch-site", "")
    sec_fetch_mode = request.headers.get("sec-fetch-mode", "")
    sec_fetch_dest = request.headers.get("sec-fetch-dest", "")
    sec_ch_ua = request.headers.get("sec-ch-ua", "")

    if not ua:
        signals.known_bad_ua = True
    else:
        ua_lower = ua.lower()
        for pattern in _BOT_UA_PATTERNS:
            if pattern in ua_lower:
                signals.automation_indicators = True
                signals.known_bad_ua = True
                break

    has_sec_fetch = bool(sec_fetch_site or sec_fetch_mode or sec_fetch_dest)
    if not has_sec_fetch and not ua:
        signals.missing_browser_headers = True
    elif not has_sec_fetch and ua:
        ua_lower = ua.lower()
        is_browser = any(b in ua_lower for b in ("chrome", "firefox", "safari", "edge"))
        if is_browser:
            signals.missing_browser_headers = True

    if not accept:
        signals.missing_accept = True

    if sec_ch_ua and ua:
        ua_lower = ua.lower()
        if "chrome" in sec_ch_ua.lower() and "chrome" not in ua_lower:
            signals.ua_sec_ch_ua_mismatch = True
        elif "firefox" in sec_ch_ua.lower() and "firefox" not in ua_lower:
            signals.ua_sec_ch_ua_mismatch = True

    return signals
