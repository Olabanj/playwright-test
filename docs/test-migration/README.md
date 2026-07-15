# Test Migration

Source of truth for porting the legacy RemotePass test suite into the feature-first `playwright-e2e/` framework.

## Layout

```
docs/test-migration/
├── README.md                     # this file
├── inventory.json                # full catalogue of legacy tests + status
├── progress.json                 # aggregate roll-up per feature
├── progress.md                   # human-readable mirror (auto-generated)
├── architecture-mapping.md       # legacy patterns → new framework (architecture-mapping-agent)
├── scenarios/<feature>.md        # business intent per legacy test (scenario-extraction-agent)
└── templates/                    # JSON schemas + scenario template
    ├── inventory.schema.json
    ├── progress.schema.json
    └── scenario.md.tpl
```

## Authoritative files

- `inventory.json` — every legacy test entry; **only** the `progress-tracking` skill writes here.
- `progress.json` — aggregates; **only** the `progress-tracking` skill writes here.
- `progress.md` — regenerated from `progress.json` after every write.

Hand-editing these files is a smell. If you must, run schema validation:

```bash
python3 -c "import json; json.load(open('docs/test-migration/inventory.json'))"
python3 -c "import json; json.load(open('docs/test-migration/progress.json'))"
```

## Test statuses

| Status | Meaning |
|---|---|
| `pending` | Catalogued, not started |
| `in_progress` | Agent currently working in a worktree |
| `migrated` | New spec lands, mirrors legacy intent 1:1 |
| `rewritten` | Intent preserved, but spec was redesigned for the new framework |
| `merged` | Folded into another spec |
| `skipped_obsolete` | Legacy test covers retired functionality — explicit drop |
| `blocked` | Cannot proceed (product bug, missing fixture, missing API spec, ...) |
| `failed_review` | `migration-reviewer-agent` rejected — back to in_progress |
| `done` | Migrated + merged to main + green in CI |

## Batch workflow

1. **Plan** — orchestrator picks a feature (P0 first); `test-inventory-agent` lists its legacy specs.
2. **Extract scenarios** — `scenario-extraction-agent` writes `scenarios/<feature>.md` (intent only, no code).
3. **Map architecture** — `architecture-mapping-agent` decides legacy-pattern → new-pattern (client/flow/page/fixture/builder).
4. **Build missing abstractions** — `page-object-fixture-agent` adds clients/types/seeding/pages/builders the migration needs.
5. **Migrate batch (3–5 tests)** — `playwright-migration-agent` writes new specs; updates `inventory.json` per test via `progress-tracking` skill.
6. **Stabilise** — `stabilization-agent` runs tests, fixes flakiness, never deletes a test to silence a failure.
7. **Review** — `migration-reviewer-agent` runs `review-checklist` skill. On red → status flips to `failed_review`.
8. **Merge** — when PR lands, `progress-tracking` skill moves entries to `done`.

## Multi-day persistence

All files are committed to git. To resume on day N+1:

```
You: "continue migrating <feature>"
Orchestrator → memory-read → progress-tracking (read) →
  picks next pending tests in that feature → continues.
```

The dashboard (`docs/test-migration/dashboard/`) reads `progress.json` continuously and shows live status. See `dashboard/README.md` for launch instructions.

## Cross-references

- New framework patterns: `playwright-e2e/docs/10-architecture/overview.md`
- Composition rules: `playwright-e2e/docs/20-engineering/composition-patterns.md`
- API spec lookup: skills `rp-search`, `rp-show`, `rp-list`
- Worktree rules: `playwright-e2e/docs/20-engineering/git-worktree-multi-agent.md` (Phase 7)
- Memory governance: `playwright-e2e/docs/_meta/memory-rules.md`
