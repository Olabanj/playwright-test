# Git Worktree Multi-Agent Workflow

How the orchestrator runs multiple migration agents in parallel without letting them collide.

## Why worktrees

Migration is naturally parallelisable by **feature**: `auth-ui` and `time-tracking` rarely share code paths. But many migration batches still touch shared infrastructure (`core/`, base `fixtures/`, `_common/`, `playwright.config.ts`). Without isolation, two agents in the same working tree will overwrite each other's edits in seconds. Worktrees give each agent its own checkout sharing the same `.git` store.

## The hard rules

1. **One agent = one worktree = one branch = one PR.**
2. **No worktree edits shared infrastructure** without serialisation. If a batch must touch `core/`, base `fixtures/`, `playwright.config.ts`, base API client, or any cross-module abstraction → that batch runs **alone**, and other migration batches pause until it merges.
3. **Shared state files are written by one worker at a time.** Any file multiple worktrees might touch (e.g. a shared JSON index) is written whole and atomically; concurrent worktrees writing the same file conflict at merge time, not at write time. The orchestrator funnels such updates through one worker per feature. (The migration record under `docs/test-migration/` is now frozen history and no longer written.)
4. **Graph freshness is automatic.** The post-commit/post-checkout git hooks rebuild the Graphify graph (gate G1) when a worktree PR lands on `main` — no manual re-index step. Manual refresh is needed only for uncommitted bulk edits: `graphify update .`.
5. **Worktrees are disposable.** They live outside the main checkout; clean them up after merge.

## Lifecycle

### Create a worktree

```bash
# From the main checkout in playwright-e2e/
cd /Users/dmytrokuznetsov/WebstormProjects/test-framework

git worktree add ../wt-<feature>-<short-id> -b feature/migrate-<feature>
# Example:
# git worktree add ../wt-auth-ui-042 -b feature/migrate-auth-ui-042
```

Pass the absolute worktree path to the migration agent via the orchestrator. The agent operates inside that path; the original checkout stays clean for other work.

### Work in a worktree

- All migration commits go to the worktree branch.
- All progress-file writes funnel through the orchestrator (no concurrent writers on the same feature).
- Run `npm install` once per worktree if needed (node_modules are not shared).

### Verify before merge

1. `npm run lint && npm run typecheck` in the worktree.
2. `npm test` or feature-scoped Playwright run via the `test-run` skill.
3. Scope check: the post-commit hook has already rebuilt the graph (gate G1); compare `git diff --stat` against the batch plan (gate G8) and run `mcp__graphify__get_pr_impact` at CP-5 to confirm there are no surprises.
4. `test-reviewer-agent` runs the `review-checklist`.
5. PR opened, CI green, manual merge.

### Cleanup after merge

```bash
git worktree remove ../wt-<feature>-<short-id>
git branch -d feature/migrate-<feature>-<short-id>
```

The post-commit/post-checkout hooks rebuild the Graphify graph automatically (gate G1). Only if you have uncommitted bulk edits to fold in, run from the monorepo root:

```bash
graphify update .
```

## Sequencing rules

| Situation | Sequencing |
|---|---|
| Two feature batches, no shared-infra changes | Parallel worktrees allowed. Each writes its own files; orchestrator funnels any shared-file writes through one worker. |
| One feature batch + one shared-infra batch | Shared-infra runs alone. Feature batch pauses or proceeds in a separate worktree that does not pull the unmerged infra. |
| Two shared-infra batches | Serial. One at a time, with merges between. |
| One feature batch + one stabilization batch on the same feature | Serial. Same feature, same files likely; do not parallelise. |

Before merging parallel worktrees, run `graphify prs --conflicts` — it flags PRs sharing graph communities, i.e. semantic-conflict candidates that git's textual merge will not catch. Merge flagged pairs serially, re-checking between merges.

## Anti-patterns

- Two agents editing `playwright.config.ts` in parallel worktrees. Always serialise.
- Renaming a public API client method in a feature batch. Renames go in their own batch with `impact-analysis` upfront.
- Merging parallel worktrees without checking `graphify prs --conflicts`. Two PRs in the same graph community can each be green alone and break together. (Graph staleness itself is no longer a manual concern — the git hooks rebuild it automatically.)
- Leaving abandoned worktrees lying around. They confuse `git worktree list` and bloat disk.
- Writing a shared state/index file directly from multiple worktrees at once. Route concurrent writes through a single worker — concurrent direct writes lose data.

## Quick reference

```bash
git worktree list                                       # see active worktrees
git worktree add <path> -b <branch>                     # create
git worktree remove <path>                              # delete
git worktree prune                                      # tidy stale records
```
