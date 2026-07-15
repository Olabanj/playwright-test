# Migration Dashboard

Live dashboard for the migration of RemotePass legacy tests into the new feature-first framework. Lives **inside `docs/test-migration/`** — next to the JSON files it visualizes. Everything (except `.venv/`) is committed to git.

## Running

```bash
cd /Users/dmytrokuznetsov/WebstormProjects/test-framework/playwright-e2e/docs/test-migration/dashboard

# One-time — create the virtualenv and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Every time — launch
streamlit run app.py
```

Opens `http://localhost:8501`. Data refreshes every **5 seconds** via a soft re-run (no page reload, scroll position preserved).

Left sidebar: an **Auto-refresh** toggle (pause), an **Interval** slider (2/3/5/10/30 sec), and a **Refresh now** button.

## What it shows

The dashboard focuses on the progress of migrating the legacy suite into the new framework. Five sections, top to bottom:

### 1. 🌐 Global summary
KPI cards: `oldTotal · migrated · rewritten · skipped · blocked · remaining` + an overall progress bar. Source — `progress.json → summary`.

### 2. 📂 Per-feature progress
Feature table: status, % complete, agent, branch, PR, last update. Under each feature — an expander listing all of its tests (id, title, priority, decision, old path → new path, agent, blockers). Sort order: `failed_review → blocked → in_progress → pending → done`. Sources — `progress.json → features[]` (rollup) + `inventory.json → features[].tests[]` (details).

### 3. 🤖 Agent activity
- **Currently working** — list of features in `in_progress` status with agent, branch, and worktree path.
- **Activity stream** — the last 40 events from `state/activity.jsonl`.
- **Agent utilisation** — bar chart of `agent → events over the last 7 days`.

### 4. 🚧 Blockers & failed review
All tests in `blocked` or `failed_review` status: feature, id, reason, agent, date. `failed_review` on top.

### 5. 📈 Velocity & ETA
- **ETA** — linear extrapolation from the velocity of the last 7 days (`remaining / avgDailyDone`). Shows a hint when history is insufficient.
- **Daily commits to progress.json** — bar chart over 30 days (`git log`).
- **Cumulative completed** — line chart over the last 14 `progress.json` commits (via `git show`).

## State files

| File | Written by | What |
|---|---|---|
| `../inventory.json` | `progress-tracking` skill | catalogue of legacy tests: id, status, blockers, paths, agent |
| `../progress.json` | `progress-tracking` skill | per-feature rollup + global summary |
| `state/activity.jsonl` | agents (via orchestrator) | append-only event stream (ts, agent, action, target, summary) |

All of these files are committed to git → they survive restarts, branch switches, and multi-day sessions.

> The files `state/build-progress.json` and `state/artifacts.json` remain as a historical trace of the agent system's bootstrap — the dashboard no longer **reads** them.

## Troubleshooting

- **Blank page / onboarding messages** — `inventory.json` / `progress.json` haven't been seeded yet. Run the orchestrator: "start migrating <feature>".
- **`ModuleNotFoundError: streamlit`** — the venv isn't activated, or `pip install -r requirements.txt` hasn't been run yet.
- **Activity empty** — run `tail -f state/activity.jsonl` to see what's actually being written.
- **Velocity chart empty** — normal while `progress.json` has no commits, or you're outside a git repo.
- **ETA = "Need more history"** — needs ≥ 3 `progress.json` commits across different days.

## Stopping

`Ctrl-C` in the terminal running streamlit. On-disk state is preserved — you can resume at any time.
