"""
Live dashboard for the RemotePass test-migration agentic system.

Layout:
  - Hero: title + big progress bar + 4 KPI cards (Done / In flight / Blocked / Remaining)
  - Tabs: Features · Agents · Blockers · Velocity

Data sources (all written by agents via `progress-tracking` skill):
  - ../inventory.json         : full catalog of legacy tests (per-test detail)
  - ../progress.json          : per-feature rollup + global summary
  - state/activity.jsonl      : append-only agent event stream
  - git log on progress.json  : velocity / burndown
"""

from __future__ import annotations

import json
import subprocess
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import streamlit as st
from streamlit_autorefresh import st_autorefresh

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
STATE_DIR = HERE / "state"
MIGRATION_DIR = HERE.parent
REPO_ROOT = HERE.parent.parent.parent  # playwright-e2e/

ACTIVITY_LOG = STATE_DIR / "activity.jsonl"
INVENTORY = MIGRATION_DIR / "inventory.json"
PROGRESS = MIGRATION_DIR / "progress.json"

DEFAULT_REFRESH_SECONDS = 5

STATUS_ORDER_TESTS = {
    "failed_review": 0,
    "blocked": 1,
    "in_progress": 2,
    "pending": 3,
    "migrated": 4,
    "rewritten": 4,
    "merged": 5,
    "done": 6,
    "skipped_obsolete": 7,
}

DONE_STATUSES = {"migrated", "rewritten", "skipped_obsolete", "done", "merged"}

# status → (pill class, glyph)
STATUS_STYLE = {
    "done":              ("pill-green",  "●"),
    "merged":            ("pill-green",  "●"),
    "migrated":          ("pill-green",  "●"),
    "rewritten":         ("pill-green",  "●"),
    "completed":         ("pill-green",  "●"),
    "in_progress":       ("pill-yellow", "●"),
    "pending":           ("pill-grey",   "○"),
    "blocked":           ("pill-red",    "■"),
    "failed":            ("pill-red",    "■"),
    "failed_review":     ("pill-orange", "▲"),
    "skipped_obsolete":  ("pill-slate",  "—"),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        st.warning(f"Cannot parse {path.name}: {e}")
        return default


def load_jsonl(path: Path, limit: int = 200) -> list[dict]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    out = []
    for line in lines[-limit:]:
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def _md_extract(text: str, marker: str, target: str) -> str | None:
    """Return body under a heading until the next heading of the same level."""
    out: list[str] = []
    capturing = False
    for line in text.splitlines():
        stripped = line.strip().lower()
        if stripped.startswith(marker):
            if capturing:
                break
            if stripped == target or stripped.startswith(target + " "):
                capturing = True
                continue
        if capturing:
            out.append(line)
    body = "\n".join(out).strip()
    return body or None


def read_md_section(path: Path, heading: str, level: int = 2) -> str | None:
    """Extract markdown under `## heading` until the next H{level} or EOF."""
    if not path.exists():
        return None
    marker = "#" * level + " "
    target = f"{marker}{heading}".lower()
    return _md_extract(path.read_text(encoding="utf-8"), marker, target)


def read_md_subsection(path: Path, h2: str, h3: str) -> str | None:
    """Extract markdown under `## h2` -> `### h3` (until next ### / ## or EOF)."""
    section = read_md_section(path, h2, level=2)
    if not section:
        return None
    marker = "### "
    target = f"{marker}{h3}".lower()
    return _md_extract(section, marker, target)


def _join_blocks(*parts: tuple[str, str | None]) -> str | None:
    """Glue non-empty named parts as `**Name**\\n\\n<body>` blocks."""
    pieces = [f"**{name}**\n\n{body}" for name, body in parts if body]
    return "\n\n".join(pieces) if pieces else None


def status_pill(status: str) -> str:
    cls, glyph = STATUS_STYLE.get(status, ("pill-grey", "•"))
    label = status.replace("_", " ")
    return f'<span class="status-pill {cls}">{glyph} {label}</span>'


def level_icon(level: str) -> str:
    return {"info": "ℹ", "warn": "⚠", "error": "✕", "success": "✓"}.get(level, "·")


def kpi_card(label: str, value, variant: str, hint: str = "") -> str:
    hint_html = f'<div class="kpi-hint">{hint}</div>' if hint else ""
    return (
        f'<div class="kpi-card kpi-{variant}">'
        f'<div class="kpi-label">{label}</div>'
        f'<div class="kpi-value">{value}</div>'
        f"{hint_html}"
        "</div>"
    )


def git_daily_velocity(days: int = 30) -> pd.DataFrame:
    if not PROGRESS.exists():
        return pd.DataFrame()
    try:
        out = subprocess.run(
            ["git", "log", f"--since={days}.days", "--pretty=format:%cs",
             "--", str(PROGRESS)],
            cwd=str(REPO_ROOT),
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode != 0:
            return pd.DataFrame()
        dates = [d.strip() for d in out.stdout.splitlines() if d.strip()]
        if not dates:
            return pd.DataFrame()
        df = pd.DataFrame({"date": dates})
        return df.groupby("date").size().reset_index(name="commits")
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return pd.DataFrame()


def cumulative_progress_from_git(limit: int = 14) -> pd.DataFrame:
    if not PROGRESS.exists():
        return pd.DataFrame()
    try:
        log = subprocess.run(
            ["git", "log", f"-{limit}", "--pretty=format:%H|%cs",
             "--", str(PROGRESS)],
            cwd=str(REPO_ROOT),
            capture_output=True, text=True, timeout=5,
        )
        if log.returncode != 0 or not log.stdout.strip():
            return pd.DataFrame()
        rows = []
        for line in reversed(log.stdout.strip().splitlines()):
            try:
                sha, date = line.split("|", 1)
            except ValueError:
                continue
            show = subprocess.run(
                ["git", "show", f"{sha}:docs/test-migration/progress.json"],
                cwd=str(REPO_ROOT),
                capture_output=True, text=True, timeout=5,
            )
            if show.returncode != 0:
                continue
            try:
                data = json.loads(show.stdout)
                s = data.get("summary", {})
                done = (s.get("migrated", 0) + s.get("rewritten", 0)
                        + s.get("skipped", 0))
                rows.append({"date": date, "done": done})
            except json.JSONDecodeError:
                continue
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows)
        return df.groupby("date", as_index=False).last()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return pd.DataFrame()


def estimate_eta(cum_df: pd.DataFrame, remaining: int) -> str | None:
    if cum_df.empty or remaining <= 0 or len(cum_df) < 3:
        return None
    cum_df = cum_df.copy()
    cum_df["date"] = pd.to_datetime(cum_df["date"])
    cum_df = cum_df.sort_values("date").tail(7)
    if len(cum_df) < 2:
        return None
    span_days = max((cum_df["date"].iloc[-1] - cum_df["date"].iloc[0]).days, 1)
    delta = cum_df["done"].iloc[-1] - cum_df["done"].iloc[0]
    if delta <= 0:
        return None
    avg_per_day = delta / span_days
    days_left = remaining / avg_per_day
    eta_date = datetime.now() + timedelta(days=days_left)
    return f"~{days_left:.0f} days · {eta_date.strftime('%b %d')}"


def count_in_progress_tests(inv: dict) -> int:
    n = 0
    for f in inv.get("features", []) or []:
        for t in f.get("tests", []) or []:
            if t.get("status") == "in_progress":
                n += 1
    return n


# ---------------------------------------------------------------------------
# Page setup
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="RemotePass Migration",
    page_icon="🚀",
    layout="wide",
)

# --- CSS: shared layout & typography (light theme only) ---
st.markdown(
    """
    <style>
      /* Tighten Streamlit's default top padding */
      .block-container { padding-top: 1.5rem; padding-bottom: 3rem; max-width: 1200px; }

      /* Hero */
      .hero-title { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
      .hero-sub   { font-size: 14px; margin: 4px 0 18px 0; }

      /* Native progress bar — slightly taller */
      [data-testid="stProgress"] > div > div > div > div {
        height: 10px !important; border-radius: 999px;
      }
      [data-testid="stProgress"] > div > div > div { border-radius: 999px; }

      /* KPI cards */
      .kpi-row { display: flex; gap: 14px; margin: 18px 0 8px 0; flex-wrap: wrap; }
      .kpi-card {
        flex: 1 1 0; min-width: 160px;
        border-radius: 14px;
        padding: 16px 18px;
        border: 1px solid; border-left-width: 4px;
      }
      .kpi-label { font-size: 12px; text-transform: uppercase;
                   letter-spacing: 0.04em; font-weight: 600; }
      .kpi-value { font-size: 32px; font-weight: 700; line-height: 1.1; margin-top: 6px; }
      .kpi-hint  { font-size: 12px; margin-top: 4px; }
      .kpi-done       { border-left-color: #16a34a; }
      .kpi-flight     { border-left-color: #eab308; }
      .kpi-blocked    { border-left-color: #dc2626; }
      .kpi-remaining  { border-left-color: #94a3b8; }

      /* Status pills */
      .status-pill {
        display: inline-block; padding: 2px 10px; border-radius: 999px;
        font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
        white-space: nowrap;
      }

      /* Section headings */
      h2, h3 { letter-spacing: -0.01em; }
      h2 { margin-top: 1rem !important; }

      /* Working-now cards */
      .agent-card {
        border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;
        border: 1px solid;
      }
      .agent-card b { font-size: 14px; }
      .agent-card .muted { font-size: 12px; }

      /* Empty-state for blockers */
      .empty-ok {
        text-align: center; padding: 48px 12px;
        font-size: 18px; font-weight: 600;
        border-radius: 14px; border: 1px solid;
      }

      /* Make wide markdown tables inside expanders scroll horizontally
         instead of crushing 6-column architecture-mapping cells. */
      [data-testid="stExpander"] [data-testid="stMarkdownContainer"] {
        overflow-x: auto;
      }
      [data-testid="stExpander"] [data-testid="stMarkdownContainer"] table {
        table-layout: auto; min-width: max-content; border-collapse: collapse;
      }
      [data-testid="stExpander"] [data-testid="stMarkdownContainer"] th,
      [data-testid="stExpander"] [data-testid="stMarkdownContainer"] td {
        vertical-align: top; padding: 6px 10px;
        white-space: normal; word-wrap: break-word;
        border: 1px solid rgba(148, 163, 184, 0.2);
      }
      [data-testid="stExpander"] [data-testid="stMarkdownContainer"] code {
        word-break: break-all; white-space: normal;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

# --- CSS: light theme palette ---
st.markdown(
    """
    <style>
      [data-testid="stAppViewContainer"] { background-color: #ffffff; color: #0f172a; }
      [data-testid="stHeader"]           { background-color: #ffffff; border-bottom: 1px solid #eef0f4; }
      [data-testid="stSidebar"]          { background-color: #f8fafc; border-right: 1px solid #eef0f4; }
      .hero-sub { color: #6b7280; }
      [data-testid="stProgress"] > div > div > div { background: #eef0f4 !important; }
      .kpi-card { background: #ffffff; border-color: #e7e9ee; box-shadow: 0 1px 2px rgba(15,23,42,0.03); }
      .kpi-label { color: #6b7280; }
      .kpi-value { color: #0f172a; }
      .kpi-hint  { color: #94a3b8; }
      .pill-green  { background: #dcfce7; color: #166534; }
      .pill-yellow { background: #fef9c3; color: #854d0e; }
      .pill-red    { background: #fee2e2; color: #991b1b; }
      .pill-orange { background: #ffedd5; color: #9a3412; }
      .pill-grey   { background: #f1f5f9; color: #475569; }
      .pill-slate  { background: #e2e8f0; color: #334155; }
      .agent-card { background: #fafbfc; border-color: #eef0f4; }
      .agent-card .muted { color: #64748b; }
      .empty-ok { color: #16a34a; background: #f0fdf4; border-color: #bbf7d0; }
      [data-testid="stExpander"] { background: #ffffff; border: 1px solid #e7e9ee !important; border-radius: 8px; }
      [data-testid="stMarkdownContainer"] code { background: #f1f5f9; color: #be185d; }
    </style>
    """,
    unsafe_allow_html=True,
)

# --- Sidebar ---
with st.sidebar:
    st.subheader("Auto-refresh")
    auto_on = st.toggle("Enabled", value=True,
                        help="Soft re-run (preserves scroll, no full reload)")
    interval = st.select_slider(
        "Interval (sec)",
        options=[2, 3, 5, 10, 30],
        value=DEFAULT_REFRESH_SECONDS,
        disabled=not auto_on,
    )
    if st.button("Refresh now"):
        st.rerun()
    st.caption("Tip: pause refresh while inspecting tables.")

if auto_on:
    st_autorefresh(interval=interval * 1000, key="dashboard_autorefresh")

# ---------------------------------------------------------------------------
# Load state
# ---------------------------------------------------------------------------
inventory = load_json(INVENTORY, {"features": []})
progress = load_json(PROGRESS, {"summary": {}, "features": []})
activity = load_jsonl(ACTIVITY_LOG, limit=200)

summary = progress.get("summary", {}) or {}
features_rollup = progress.get("features", []) or []
inv_features = {f.get("name"): f for f in inventory.get("features", []) or []}

old_total = summary.get("oldTotal", 0)
migrated = summary.get("migrated", 0)
rewritten = summary.get("rewritten", 0)
skipped = summary.get("skipped", 0)
blocked = summary.get("blocked", 0)
remaining = summary.get("remaining", max(old_total - migrated - rewritten - skipped, 0))
done = migrated + rewritten + skipped
pct = (done / old_total) if old_total else 0.0

in_flight = count_in_progress_tests(inventory)
failed_review_count = sum(
    1 for f in inventory.get("features", []) or []
    for t in f.get("tests", []) or []
    if t.get("status") == "failed_review"
)
blocked_total = blocked + failed_review_count

# ---------------------------------------------------------------------------
# HERO
# ---------------------------------------------------------------------------
st.markdown('<div class="hero-title">Test migration</div>', unsafe_allow_html=True)
sub = (
    f'{done} / {old_total} tests · {int(pct * 100)}% complete'
    if old_total
    else "Waiting for orchestrator to seed inventory & progress…"
)
status_chip = "🟢 Live" if auto_on else "⏸ Paused"
st.markdown(
    f'<div class="hero-sub">{sub}  ·  {status_chip}  ·  '
    f'updated {datetime.now().strftime("%H:%M:%S")}</div>',
    unsafe_allow_html=True,
)
st.progress(min(pct, 1.0))

st.markdown(
    '<div class="kpi-row">'
    + kpi_card("Done", done, "done",
               f"{migrated} migrated · {rewritten} rewritten · {skipped} skipped")
    + kpi_card("In flight", in_flight, "flight", "tests currently in_progress")
    + kpi_card("Blocked", blocked_total, "blocked",
               f"{blocked} blocked · {failed_review_count} failed review")
    + kpi_card("Remaining", remaining, "remaining", f"of {old_total} total")
    + "</div>",
    unsafe_allow_html=True,
)

migration_seeded = bool(features_rollup) or bool(inv_features)

if not migration_seeded:
    st.info(
        "Migration not started yet. Once the orchestrator seeds "
        "`docs/test-migration/inventory.json` and `progress.json`, "
        "per-feature progress will appear in the tabs below."
    )

# ---------------------------------------------------------------------------
# AI-CONTENT DISCLAIMER — persistent, shown above every tab
# ---------------------------------------------------------------------------
st.warning(
    "⚠️ **AI-generated content — help us train it.** This dashboard (catalogue, scenarios, "
    "reviews, migration decisions) was produced by an AI investigation of the legacy test suite. "
    "It may contain bugs or inaccuracies. **If you spot any error — please report it directly to "
    "Dmytro** (this is my project). Every report gets fixed *and* becomes training feedback "
    "that sharpens the AI to match our product more precisely. Your reports directly raise the "
    "quality of this migration — don't scroll past a mistake.",
    icon="⚠️",
)

# Wide review tables scroll horizontally instead of wrapping/squashing.
st.markdown(
    "<style>"
    "div[data-testid='stExpander'] table{display:block;overflow-x:auto;white-space:nowrap;}"
    "div[data-testid='stExpander'] table td,div[data-testid='stExpander'] table th{vertical-align:top;}"
    "</style>",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# TABS
# ---------------------------------------------------------------------------
tab_features, tab_agents, tab_blockers, tab_velocity = st.tabs(
    ["Features", "Agents", "Blockers", "Velocity"]
)

# ----- Features tab -----
with tab_features:
    if not features_rollup and not inv_features:
        st.caption("No features tracked yet.")
    else:
        rows = []
        for f in features_rollup:
            old = f.get("oldTotal", 0) or 1
            d = f.get("migrated", 0) + f.get("rewritten", 0) + f.get("skipped", 0)
            rows.append({
                "Status": status_pill(f.get("status", "pending")),
                "Feature": f.get("name"),
                "Progress": f"{int(min(d / old, 1.0) * 100)}%",
                "Tests": f"{d} / {f.get('oldTotal', 0)}",
                "Remaining": f.get("remaining", 0),
                "Agent": f.get("agent") or "—",
                "Branch": f.get("branch") or "—",
                "PR": f.get("pr") or "—",
                "Updated": f.get("updatedAt", "—"),
            })
        if rows:
            st.markdown(
                pd.DataFrame(rows).to_html(escape=False, index=False,
                                            classes="features-table"),
                unsafe_allow_html=True,
            )

        # Drill-down selector
        feature_names = list(dict.fromkeys(
            [f.get("name") for f in features_rollup] + list(inv_features.keys())
        ))
        feature_names = [n for n in feature_names if n]
        if feature_names:
            st.markdown("&nbsp;", unsafe_allow_html=True)
            picked = st.selectbox(
                "Drill into feature",
                feature_names,
                index=None,
                placeholder="Pick a feature to see intent, mapping, gaps, deltas & decisions…",
            )
            if picked:
                # --- Narrative blocks from scenarios/<feature>.md + architecture-mapping.md ---
                scenario_path = MIGRATION_DIR / "scenarios" / f"{picked}.md"
                mapping_path = MIGRATION_DIR / "architecture-mapping.md"

                feature_notes = next(
                    (f.get("notes") for f in features_rollup if f.get("name") == picked),
                    None,
                )
                if feature_notes:
                    st.info(feature_notes)

                blocks: list[tuple[str, str | None]] = [
                    (
                        "🎯 Intent",
                        read_md_section(scenario_path, "User intent"),
                    ),
                    (
                        "🧭 Steps & expected outcome",
                        _join_blocks(
                            ("Steps", read_md_section(scenario_path, "Steps (intent only)")),
                            ("Expected outcome", read_md_section(scenario_path, "Expected outcome")),
                        ),
                    ),
                    (
                        "🧱 Preconditions & domain notes",
                        _join_blocks(
                            ("Preconditions", read_md_section(scenario_path, "Preconditions")),
                            ("Domain notes", read_md_section(scenario_path, "Domain notes")),
                            ("Edge cases", read_md_section(scenario_path, "Edge cases / variants")),
                        ),
                    ),
                    (
                        "🏗 Architecture mapping",
                        read_md_subsection(mapping_path, picked, "Artefact-by-artefact mapping"),
                    ),
                    (
                        "🚧 Gaps (blocking)",
                        read_md_subsection(mapping_path, picked, "Gaps blocking migration"),
                    ),
                    (
                        "⚠️ Deltas & pitfalls",
                        read_md_subsection(mapping_path, picked, "Deltas (non-blocking) worth recording"),
                    ),
                    (
                        "📝 Decision & rationale",
                        read_md_section(scenario_path, "Migration decision"),
                    ),
                    (
                        "🔄 Migration plan (as-was → as-proposed)",
                        read_md_section(scenario_path, "Migration plan — as-was vs as-proposed"),
                    ),
                    (
                        "❓ Open questions (HITL)",
                        read_md_section(scenario_path, "Open questions (HITL)"),
                    ),
                ]
                rendered_any_block = False
                for i, (title, body) in enumerate(blocks):
                    if not body:
                        continue
                    with st.expander(title, expanded=(not rendered_any_block)):
                        st.markdown(body)
                    rendered_any_block = True

                if not rendered_any_block and not feature_notes:
                    st.caption(
                        "No scenario doc or architecture-mapping section found for this feature yet."
                    )

                # --- Architecture / Logic review panels (reviews/<feature>.md) ---
                review_path = MIGRATION_DIR / "reviews" / f"{picked}.md"
                arch_review = read_md_section(review_path, "Architecture Review")
                if arch_review:
                    with st.expander(
                        "🏛 Architecture Review — patterns, SOLID, justified improvements",
                        expanded=False,
                    ):
                        st.markdown(arch_review)
                logic_review = read_md_section(review_path, "Logic & Code Review")
                if logic_review:
                    with st.expander(
                        "🧠 Logic & Code Review — duplication, likely bugs, risky patterns",
                        expanded=False,
                    ):
                        st.markdown(logic_review)

                # --- Tests catalogued (existing table) ---
                tests = (inv_features.get(picked, {}) or {}).get("tests", []) or []
                if tests:
                    st.markdown("---")
                    st.markdown("##### 📦 Tests catalogued")
                    sorted_tests = sorted(
                        tests,
                        key=lambda t: STATUS_ORDER_TESTS.get(t.get("status", "pending"), 99),
                    )
                    detail_rows = []
                    for t in sorted_tests:
                        blockers_list = t.get("blockers") or []
                        detail_rows.append({
                            "Status":   status_pill(t.get("status", "pending")),
                            "ID":       t.get("id", "—"),
                            "Title":    t.get("title", "—"),
                            "Priority": t.get("priority", "—"),
                            "Decision": t.get("migrationDecision", "—"),
                            "Old path": t.get("filePath", "—"),
                            "New path": t.get("newPath", "—"),
                            "Agent":    t.get("agent") or "—",
                            "Blockers": "; ".join(blockers_list) if blockers_list else "",
                        })
                    st.markdown(
                        pd.DataFrame(detail_rows).to_html(escape=False, index=False),
                        unsafe_allow_html=True,
                    )
                elif rendered_any_block:
                    st.caption("No per-test detail in inventory for this feature.")

                # --- PR review panel (reviews/<feature>-pr-review.md) ---
                pr_path = MIGRATION_DIR / "reviews" / f"{picked}-pr-review.md"
                if pr_path.exists():
                    st.markdown("---")
                    with st.expander(
                        "🔍 PR Review — pre-merge verdict, blockers & merge risks",
                        expanded=False,
                    ):
                        st.markdown(pr_path.read_text(encoding="utf-8"))

# ----- Agents tab -----
with tab_agents:
    col_left, col_right = st.columns([1, 2])

    with col_left:
        st.markdown("##### Currently working")
        in_progress = [f for f in features_rollup if f.get("status") == "in_progress"]
        if not in_progress:
            st.caption("No features in progress right now.")
        else:
            for f in in_progress:
                st.markdown(
                    f'<div class="agent-card">'
                    f'<b>{f.get("name", "—")}</b><br>'
                    f'<span class="muted">agent: {f.get("agent") or "—"}</span><br>'
                    f'<span class="muted">branch: {f.get("branch") or "—"}</span><br>'
                    f'<span class="muted">worktree: {f.get("worktreePath") or "—"}</span><br>'
                    f'<span class="muted">updated: {f.get("updatedAt", "—")}</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    with col_right:
        st.markdown("##### Recent activity")
        if activity:
            df = pd.DataFrame(activity)
            df = df.sort_values("ts", ascending=False).head(20)
            rows = [{
                "Time":    str(r.get("ts", ""))[11:19],
                "Level":   level_icon(r.get("level", "info")),
                "Agent":   r.get("agent", "—"),
                "Action":  r.get("action", "—"),
                "Target":  r.get("target", ""),
                "Summary": r.get("summary", ""),
            } for _, r in df.iterrows()]
            st.dataframe(pd.DataFrame(rows),
                         use_container_width=True, hide_index=True, height=360)
        else:
            st.caption("No activity yet.")

    st.markdown("##### Agent utilisation (last 7 days)")
    if activity:
        cutoff = datetime.now() - timedelta(days=7)
        counter: Counter[str] = Counter()
        for ev in activity:
            ts_raw = ev.get("ts", "")
            try:
                ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
                if ts.tzinfo is not None:
                    ts = ts.replace(tzinfo=None)
            except (ValueError, AttributeError):
                continue
            if ts < cutoff:
                continue
            counter[ev.get("agent") or "—"] += 1
        if counter:
            util_df = pd.DataFrame(
                sorted(counter.items(), key=lambda x: -x[1]),
                columns=["agent", "events"],
            )
            st.bar_chart(util_df.set_index("agent"), height=240)
        else:
            st.caption("No agent events in the last 7 days.")
    else:
        st.caption("No activity log yet.")

# ----- Blockers tab -----
with tab_blockers:
    problem_rows = []
    for f in inventory.get("features", []) or []:
        for t in f.get("tests", []) or []:
            status = t.get("status")
            if status not in ("blocked", "failed_review"):
                continue
            blockers_list = t.get("blockers") or []
            problem_rows.append({
                "_order": 0 if status == "failed_review" else 1,
                "Status":  status_pill(status),
                "Feature": f.get("name"),
                "ID":      t.get("id", "—"),
                "Title":   t.get("title", "—"),
                "Reason":  "; ".join(blockers_list) if blockers_list else (t.get("notes") or ""),
                "Agent":   t.get("agent") or "—",
                "Updated": t.get("updatedAt", "—"),
            })
    if problem_rows:
        df = pd.DataFrame(sorted(problem_rows, key=lambda r: r["_order"])).drop(columns=["_order"])
        st.markdown(df.to_html(escape=False, index=False), unsafe_allow_html=True)
    else:
        st.markdown('<div class="empty-ok">✓ No blockers · no failed reviews</div>',
                    unsafe_allow_html=True)

# ----- Velocity tab -----
with tab_velocity:
    velocity = git_daily_velocity(days=30)
    cum = cumulative_progress_from_git(limit=14)

    eta = estimate_eta(cum, remaining)
    eta_col1, eta_col2, eta_col3 = st.columns(3)
    with eta_col1:
        if eta:
            st.metric("ETA (linear, 7-day avg)", eta)
        else:
            st.metric("ETA", "—", help="Need ≥ 3 days of progress history")
    with eta_col2:
        st.metric("Done so far", done)
    with eta_col3:
        st.metric("Remaining", remaining)

    if not velocity.empty:
        st.markdown("##### Daily commits to progress.json (30 days)")
        st.bar_chart(velocity.set_index("date"), height=220)
    else:
        st.caption("No commits to progress.json yet.")

    if not cum.empty:
        st.markdown("##### Cumulative completed (last 14 commits)")
        st.line_chart(cum.set_index("date"), height=220)

# ---------------------------------------------------------------------------
# Footer
# ---------------------------------------------------------------------------
st.caption(
    "Sources: `inventory.json` + `progress.json` (written by the `progress-tracking` skill) "
    "and `state/activity.jsonl` (agent event stream). All persisted in git."
)
