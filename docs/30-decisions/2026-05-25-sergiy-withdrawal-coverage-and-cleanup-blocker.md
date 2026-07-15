---
id: 25ffa130-6693-5fd6-bb17-f63cec053e9a
name: 2026-05-25-sergiy-withdrawal-coverage-and-cleanup-blocker
description: "Withdrawal UI coverage order (enabling → adding) with API-spec ban in final UI; admin-auth helper consolidation; afterAll cleanup leaving zero payment methods breaks downstream specs — open blocker"
metadata:
  type: feedback
  category: decisions
  tags: ["withdrawal", "payment-methods", "ui-tests", "admin-auth", "cleanup", "blocker", "qa-129", "qa-186", "qa-189"]
  author: sergiy
  createdAt: 2026-05-26T08:00:00Z
  updatedAt: 2026-05-26T08:00:00Z
  expiresAt: null
---

# Withdrawal coverage order, API-spec ban, and the cleanup-chain blocker

## Coverage order
1. Cover **enabling of withdrawal** first (admin UI toggles on contractor account).
2. Merge that into the payments end-to-end branch.
3. Then update **adding of withdrawal** with the latest changes from the enabling spec.

**Why:** doing them out of order forces a rebase later and means the "adding" spec falsely relies on API prerequisites that the "enabling" spec is meant to cover via UI.

## Rule: do not use API specs in the final UI flow for withdrawal
Once the withdrawal API is fully working in sandbox, the **final UI version must drive the flow through the UI**, not through API setup helpers. API helpers are acceptable only as scaffolding during exploratory probes — they must be removed before the spec is considered done.

## Rule: add-payment-method API tests must use a fresh client
Add-payment-method API spec must run against a freshly created client (never the shared `Lukman+gg` style account that has cards from previous runs). Otherwise the test passes by re-using existing methods and silently masks the "fresh setup" path.

## Rule: one UI ticket per branch
QA-186 (enable withdraw methods) and QA-189 (add all withdraw methods) were co-shipped in branch `qa-129` — that's out-of-scope mixing. Going forward each UI ticket lands in its own branch. QA-186 was merged 2026-05-25.

## Tech debt: consolidate admin-auth helpers
Two parallel admin-auth implementations exist:

| Helper | File | Token fetch | Auth mechanism |
|---|---|---|---|
| `createAdminBrowserContext` | `ui-admin-auth.helper.ts` | `AdminAPI.loginTest()` ✅ | `persist:root` localStorage injection |
| `loginAsAdmin` | `ui-auth.helper.ts` | raw `request.newContext()` + manual `GET /api/admin/login/test/${loginKey}` ❌ | Navigate to `/admin/login?token=...` |

`loginAsAdmin` re-implements the same HTTP call from scratch — both should consolidate around `AdminAPI.loginTest()`. They also both write to the same `adminStorageStatePath` file, so divergence here causes hard-to-debug auth state mismatches.

## Open blocker — payment-methods cleanup chain
QA-129 spec's `afterAll` deletes both saved client payment methods by default, leaving the client with **zero** saved methods. The downstream spec (Spec 5 / `processPayments`) then has nothing to pay with, so the pipeline breaks at the chain level even though each spec individually passes.

Sergiy raised this 2026-05-25 evening and re-raised 2026-05-26 morning — **still unresolved**. Two possible fixes:
- Leave at least one saved payment method in `afterAll`.
- Have downstream specs add their own payment methods (true isolation), and adjust `afterAll` accordingly.

How to apply: until this is resolved, the payments end-to-end run is unreliable. Anyone migrating these specs to the new framework should fix isolation at the same time, not port the broken cleanup as-is.
