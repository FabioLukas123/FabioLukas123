"""Claude Code usage limits — the same numbers ``/status`` shows.

Primary source: the official OAuth usage endpoint
(``GET https://api.anthropic.com/api/oauth/usage``) queried with the token
Claude Code stores in ``~/.claude/.credentials.json``. That is where
``/status`` / ``/usage`` get their utilization percentages and reset times,
so when it is reachable the meters here match them exactly.

Fallback (no credentials, expired token, offline): estimate from the local
transcripts, like the community ccusage tool — read the per-message token
usage Claude Code records in ``~/.claude/projects/**/*.jsonl`` and
reconstruct the current 5-hour block and rolling 7-day window, calibrating
the budget to the largest block/window seen in the last ~60 days (or pinned
via ``limit_5h_tokens`` / ``limit_week_tokens`` in config.json). Estimated
lines are labelled "(estimado)".

Transcript parsing is incremental: each file's events are cached against
(mtime, size), so only changed transcripts are re-read.
"""

import json
import os
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECTS_DIR = Path.home() / ".claude" / "projects"
CREDENTIALS_PATH = Path.home() / ".claude" / ".credentials.json"
USAGE_URL = "https://api.anthropic.com/api/oauth/usage"

BLOCK_HOURS = 5
SCAN_DAYS = 60          # history window for calibration
REFRESH_SECS = 60.0

_file_cache = {}        # path -> (mtime, size, [(epoch, tokens), ...])
_result_cache = {"at": 0.0, "data": None}
_api_cache = {"at": 0.0, "data": None, "good_at": 0.0}

# keep serving the last successful API answer through transient failures
# (network blip, token mid-refresh) instead of flapping to anything else
API_STALE_GRACE = 30 * 60


# --- official API (what /status shows) --------------------------------------

def _read_oauth_token():
    """Access token from Claude Code's credentials file, if still valid."""
    try:
        with CREDENTIALS_PATH.open("r", encoding="utf-8") as fh:
            creds = json.load(fh)
    except Exception:
        return None
    oauth = creds.get("claudeAiOauth") or {}
    token = oauth.get("accessToken")
    expires = oauth.get("expiresAt")
    if token and expires and expires / 1000.0 < time.time() + 60:
        return None  # expired; let the estimator take over
    return token


def _parse_reset(iso):
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except Exception:
        return None


def api_snapshot():
    """Utilization windows from the official endpoint, or None.

    Returns {"five_hour": {"pct": float, "resets_at": datetime|None},
             "seven_day": {...}, "seven_day_opus": {...}, ...} — only the
    windows the API actually reported. Cached for REFRESH_SECS; every
    failure path degrades silently to None (the transcript estimator).
    """
    now = time.time()
    if now - _api_cache["at"] < REFRESH_SECS:
        return _api_cache["data"]
    _api_cache["at"] = now

    def _fail():
        # transient failure: keep the last good answer for a grace period
        if now - _api_cache["good_at"] > API_STALE_GRACE:
            _api_cache["data"] = None
        return _api_cache["data"]

    token = _read_oauth_token()
    if not token:
        return _fail()

    try:
        ctx = ssl.create_default_context(
            cafile=os.environ.get("SSL_CERT_FILE")
            or os.environ.get("REQUESTS_CA_BUNDLE") or None)
        req = urllib.request.Request(USAGE_URL, headers={
            "Authorization": "Bearer " + token,
            "anthropic-beta": "oauth-2025-04-20",
            "Content-Type": "application/json",
            "User-Agent": "claude-status-bar",
        })
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            payload = json.load(resp)
    except Exception:
        return _fail()

    windows = {}

    def add(name, obj):
        if isinstance(obj, dict) and obj.get("utilization") is not None:
            try:
                windows[name] = {
                    "pct": float(obj["utilization"]),
                    "resets_at": _parse_reset(obj.get("resets_at")),
                }
            except (TypeError, ValueError):
                pass

    if isinstance(payload, dict):
        for key, value in payload.items():
            add(key, value)
    if windows:
        _api_cache["data"] = windows
        _api_cache["good_at"] = now
        return windows
    return _fail()


def _parse_ts(ts):
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None


def _events_from_file(path, cutoff):
    """[(epoch, weighted_tokens)] for assistant messages in one transcript."""
    try:
        st = path.stat()
    except OSError:
        return []
    cached = _file_cache.get(path)
    if cached and cached[0] == st.st_mtime and cached[1] == st.st_size:
        return cached[2]

    events = []
    seen = set()
    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if '"assistant"' not in line or '"usage"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                if d.get("type") != "assistant":
                    continue
                msg = d.get("message") or {}
                usage = msg.get("usage") or {}
                if not usage:
                    continue
                # The same API response can be logged on several lines
                # (streaming); dedupe by request/message id.
                key = (d.get("requestId"), msg.get("id"))
                if key in seen:
                    continue
                seen.add(key)
                ts = _parse_ts(d.get("timestamp", ""))
                if ts is None or ts < cutoff:
                    continue
                tokens = (
                    usage.get("input_tokens", 0)
                    + usage.get("output_tokens", 0)
                    + usage.get("cache_creation_input_tokens", 0)
                )
                if tokens:
                    events.append((ts, tokens))
    except OSError:
        return []
    _file_cache[path] = (st.st_mtime, st.st_size, events)
    return events


def _all_events():
    now = time.time()
    cutoff = now - SCAN_DAYS * 86400
    events = []
    try:
        files = list(PROJECTS_DIR.glob("*/*.jsonl"))
    except OSError:
        return events
    for path in files:
        try:
            if path.stat().st_mtime < cutoff:
                continue
        except OSError:
            continue
        events.extend(_events_from_file(path, cutoff))
    events.sort()
    return events


def _blocks(events):
    """Group events into ccusage-style 5h blocks: [(start, end, tokens)]."""
    out = []
    span = BLOCK_HOURS * 3600
    start = end = None
    total = 0
    for ts, tokens in events:
        if start is None or ts >= end:
            if start is not None:
                out.append((start, end, total))
            anchor = datetime.fromtimestamp(ts, tz=timezone.utc).replace(
                minute=0, second=0, microsecond=0
            )
            start = anchor.timestamp()
            end = start + span
            total = 0
        total += tokens
    if start is not None:
        out.append((start, end, total))
    return out


def snapshot(settings=None):
    """Cached usage estimate.

    Returns None when there is no transcript data, else a dict with
    block_pct/week_pct (0-100 or None when uncalibratable), block_tokens,
    week_tokens, block_reset (local "HH:MM") and calibrated flags.
    """
    now = time.time()
    if _result_cache["data"] is not None and now - _result_cache["at"] < REFRESH_SECS:
        return _result_cache["data"]

    settings = settings or {}
    events = _all_events()
    if not events:
        _result_cache.update(at=now, data=None)
        return None

    blocks = _blocks(events)
    cur_start, cur_end, cur_tokens = blocks[-1]
    if now >= cur_end:  # last block already expired -> fresh block, 0 used
        cur_start, cur_end, cur_tokens = now, now + BLOCK_HOURS * 3600, 0

    week_tokens = sum(t for ts, t in events if ts >= now - 7 * 86400)

    # --- budgets -----------------------------------------------------------
    manual_5h = int(settings.get("limit_5h_tokens") or 0)
    manual_wk = int(settings.get("limit_week_tokens") or 0)

    budget_5h = manual_5h or max(t for _, _, t in blocks)
    # weekly auto-calibration: max rolling 7d window, stepped by day
    if manual_wk:
        budget_wk = manual_wk
    else:
        budget_wk = 0
        first = events[0][0]
        day = 86400
        step = first
        while step <= now:
            lo, hi = step, step + 7 * day
            budget_wk = max(budget_wk,
                            sum(t for ts, t in events if lo <= ts < hi))
            step += day

    def pct(used, budget):
        if budget < 1000:  # too little history to mean anything
            return None
        return min(100.0, 100.0 * used / budget)

    data = {
        "block_tokens": cur_tokens,
        "block_pct": pct(cur_tokens, budget_5h),
        "block_reset": datetime.fromtimestamp(cur_end).strftime("%H:%M"),
        "week_tokens": week_tokens,
        "week_pct": pct(week_tokens, budget_wk),
        "calibrated_5h": not manual_5h,
        "calibrated_week": not manual_wk,
    }
    _result_cache.update(at=now, data=data)
    return data


def bar(pct, width=10):
    """'▮▮▮▮▯▯▯▯▯▯'-style text meter for menu rows."""
    if pct is None:
        return "▯" * width
    filled = int(round(width * pct / 100.0))
    return "▮" * filled + "▯" * (width - filled)


def _fmt_tokens(n):
    if n >= 1_000_000:
        return "{:.1f}M".format(n / 1_000_000)
    if n >= 1_000:
        return "{:.0f}k".format(n / 1_000)
    return str(n)


def _fmt_reset(dt, weekly=False):
    if dt is None:
        return ""
    local = dt.astimezone()
    stamp = local.strftime("%d/%m %H:%M") if weekly else local.strftime("%H:%M")
    return " · reseta {}".format(stamp)


# API window key -> (menu label, is-weekly)
_WINDOW_LABELS = [
    ("five_hour", "5h  ", False),
    ("seven_day", "7d  ", True),
    ("seven_day_opus", "Opus", True),
    ("seven_day_sonnet", "Sonnet", True),
]


def block_percent(settings=None):
    """Current 5h utilization from the official API only, or None."""
    windows = api_snapshot()
    if windows and "five_hour" in windows:
        return windows["five_hour"]["pct"]
    return None


def menu_lines(settings=None):
    """Ready-to-display usage strings — real /status numbers ONLY.

    No transcript estimation is ever shown: when the API has no data (no
    credentials / offline past the grace window) this returns [] and the
    usage rows simply disappear instead of flapping to estimates.
    """
    windows = api_snapshot()
    if not windows:
        return []
    lines = []
    for key, label, weekly in _WINDOW_LABELS:
        w = windows.get(key)
        if not w:
            continue
        lines.append("{} {} {:.0f}%{}".format(
            label, bar(w["pct"]), w["pct"],
            _fmt_reset(w.get("resets_at"), weekly)))
    # any extra windows the API added that we don't know labels for
    for key, w in windows.items():
        if key not in {k for k, _, _ in _WINDOW_LABELS}:
            lines.append("{} {} {:.0f}%".format(key, bar(w["pct"]), w["pct"]))
    return lines
