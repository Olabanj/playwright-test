---
id: 36d3501a-fad9-5401-b4be-728cd858dbaa
name: payments-agent-test-data
description: "Payments anomaly-detection agent test data refreshed after production incidents revealed non-PAYG/milestone contract coverage gap; new CSV authored with eng, AI-generated seed data, client account shared with team"
metadata:
  type: project
  category: engineering
  tags: ["payments-agent", "ai-eval", "test-data", "seed", "csv", "sandbox"]
  author: slahudeen
  createdAt: 2026-05-26T08:00:00Z
  updatedAt: 2026-05-26T08:00:00Z
  expiresAt: null
---

# Payments-agent test data refresh (2026-05-25)

## Why
Previous seeder for the payments AI anomaly-detection agent covered only **PAYG** and **milestone** contractor contracts. A production incident surfaced anomalies on other contract types that were never represented in the eval set, so the agent had blind spots in production.

## What changed
- Slahudeen and the payments-agent engineer co-authored a new **CSV** that lists test-data requirements across **all contract types** (not only PAYG/milestone).
- The seeder uses **AI-generated** test data driven by that CSV — generation is deterministic per row, so the eval set is reproducible.
- A single sandbox **client account** has been shared with the team so everyone evaluates the agent against the same seed state.

## How this fits the existing anomaly seeders
The existing payment- and expense-anomaly seeders (see project root `CLAUDE.md`) already produce 23 + 25 cases, but on a narrow set of contract types. The new CSV is the **specification** that the next iteration of those seeders must consume. When that work lands:
- `payment_test_anomalies.json` and `expense-anomalies-eval-set.json` become CSV-derived rather than hand-authored, OR
- A new seeder is added that reads the CSV directly.

## How to apply
- Treat the CSV (when checked in) as the source of truth for payments-agent eval coverage.
- Do not delete production-derived rows from the CSV without sign-off from Slahudeen and the payments-agent engineer.
- When the agent misses a production anomaly, add a row to the CSV the same day — that is the loop that prevents the next blind spot.
