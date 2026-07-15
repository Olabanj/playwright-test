---
id: 283ec78c-ffc4-5c24-85f1-2327682d1e60
name: ci-cd-for-automation
description: "CI/CD for the automation test suites — initiative kicked off by Slahudeen (2026-06-08). Open design questions (trigger, scope, grouping, runtime, parallelization) and the early agreement to tag/group tests from the start so we don't run everything daily."
metadata:
  type: project
  category: engineering
  tags: ["ci-cd", "automation", "tags", "smoke", "regression", "test-suite"]
  author: dmytro
  createdAt: 2026-06-10T15:33:00Z
  updatedAt: 2026-06-10T15:33:00Z
  expiresAt: null
---

# CI/CD for automation

Kicked off by Slahudeen in #qa-techteam (2026-06-08): as we automate new features, it's time to build CI/CD for the automation suites. Open discussion — captured here as the working baseline.

## Why now
The suites are large and growing — time-tracking alone is ~400 tests. Running everything every day won't scale, so grouping/tagging must be designed in from the start (Baha).

## Open design questions (Ihor)
1. Trigger — scheduled vs event-driven?
2. Scope per run — regression vs feature + smoke?
3. Grouping method — tags, folders, projects?
4. Runtime of the whole suite?
5. What parallelization is supported?

## Early signals (not yet decided)
- **Smoke lane already in use** — per-author smoke tests are triggered manually before work (see [[2026-06-10]]); a natural first CI target.
- **Tagging/grouping from the start** so daily runs are a focused subset, not the full suite. Baha's all-green tracker already classifies always-green vs must-run files (see [[2026-06-09]]) — a candidate input for selective CI runs.

## Status
Discussion only — no pipeline built yet. Owner not formally assigned (Slahudeen driving, Ihor scoping).
