"""Estimate Claude Code usage limits from the local transcripts.

Anthropic does not expose subscription limits through any local API, so —
like the community ccusage tool — this reads the per-message token usage that
Claude Code records in ``~/.claude/projects/**/*.jsonl`` and estimates:

- the current 5-hour block (Claude's session limit window): blocks start at
  the top of the hour of the first message after the previous block ended;
- the rolling 7-day window (approximates the weekly limit).

Percentages need a budget. By default the budget is auto-calibrated to the
largest block / 7-day window seen in the last ~60 days (assuming the user has
hit or neared the limit at least once); it can be pinned explicitly via
``limit_5h_tokens`` / ``limit_week_tokens`` in config.json. Either way this
is an estimate, and it is labelled as such in the UI.

Parsing is incremental: each file's events are cached against (mtime, size),
so only changed transcripts are re-read.
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECTS_DIR = Path.home() / ".claude" / "projects"

BLOCK_HOURS = 5
SCAN_DAYS = 60          # history window for calibration
REFRESH_SECS = 60.0

_file_cache = {}        # path -> (mtime, size, [(epoch, tokens), ...])
_result_cache = {"at": 0.0, "data": None}


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


def menu_lines(settings=None):
    """Two ready-to-display menu strings, or [] when there is no data."""
    data = snapshot(settings)
    if not data:
        return []
    if data["block_pct"] is not None:
        l1 = "5h   {} {:.0f}% · reseta {}".format(
            bar(data["block_pct"]), data["block_pct"], data["block_reset"])
    else:
        l1 = "5h   {} tokens · reseta {}".format(
            _fmt_tokens(data["block_tokens"]), data["block_reset"])
    if data["week_pct"] is not None:
        l2 = "7d   {} {:.0f}%{}".format(
            bar(data["week_pct"]), data["week_pct"],
            " (estimado)" if data["calibrated_week"] else "")
    else:
        l2 = "7d   {} tokens".format(_fmt_tokens(data["week_tokens"]))
    return [l1, l2]
