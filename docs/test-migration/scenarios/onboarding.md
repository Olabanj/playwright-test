# Scenario Document — onboarding

**Feature:** Client Onboarding (post-registration activity page flow)
**Extracted:** 2026-05-29
**Source spec files:** 3 (client-full-onboarding, company-profile, confirm-company-details) + 1 skipped script
**Legacy test count:** 3 active (rewrite) + 1 skipped_obsolete
**Target module path:** `features/onboarding/tests/ui/frontoffice/`

---

## User intent

A newly registered client wants to complete the mandatory onboarding steps shown on the `/activity` page. Specifically:

1. Submit company legal documentation so RemotePass can verify the company's identity (KYB) — the "Confirm Company Details" card.
2. Observe that after admin KYB approval, the documentation card disappears from the activity page.
3. Fill in the company profile information (industry, size, address, etc.) so the account is fully configured — the "Complete company profile" card.

---

## Preconditions

- A fresh client account has been registered and the user is logged in (provisioned by fixture via API).
- 2FA has been disabled on the new account via a backend call (currently requires a direct DB write — see Domain notes).
- The `/activity` page is reachable and shows both onboarding cards: "Confirm Company Details" and "Complete company profile".
- No prior KYB submission exists for this company.
- Admin API credentials are available in the test environment (required for the KYB-approval lifecycle test).

---

## Steps (intent only)

**Confirm Company Details (submission only):**
- Open the activity page.
- Open the "Confirm Company Details" card.
- Fill in company LinkedIn URL, select "I am the authorized signatory", and upload a registration document PDF.
- Submit the form.

**Confirm Company Details + KYB approval (full lifecycle):**
- Open the activity page.
- Open the "Confirm Company Details" card, fill required fields, and submit.
- Confirm the card transitions to "In Progress" status.
- As admin, look up the company ID by its registered legal name, then approve the company's KYB via admin API.
- Reload the activity page.

**Complete Company Profile:**
- Open the activity page.
- Click the "Complete company profile" card to navigate to the Company Info settings tab.
- Fill all required company fields (company name, industry, size, address, and any other mandatory fields).
- Save the form.

---

## Expected outcome

**Confirm Company Details — submission:** The user is redirected back to `/activity`; the "Confirm Company Details" card remains visible but now shows "In Progress" status.

**Full lifecycle with KYB approval:** After admin approves KYB and the activity page is reloaded, the "Confirm Company Details" card is no longer present on the page.

**Complete Company Profile:** A success toast ("Updated successfully" or equivalent) is shown on screen after saving.

---

## Edge cases / variants

- The "I am NOT the authorized signatory" path (someone else signs) is not covered by any legacy test.
- Partial KYB rejection and re-submission flows are not covered.
- Partial company profile submission (missing required fields) and field-level validation errors are not covered.
- Only the happy path is tested for each card; the test suite does not cover error states from the backend.
- The success toast message text is asserted against a hardcoded constant — a platform wording change will break the assertion.
- KYB approval is fire-and-forget from the UI's perspective; the test verifies card removal after a full page reload, not via polling or websocket event.

---

## Domain notes

**Direct DB dependency — HIGH severity blocker:**
All three verify-lane tests call `OnboardingFixture.registerAndLogin`, which relies on `@utils/database/db-connection-manager` for two operations:

1. Disable 2FA on the newly registered account — this is a direct DB write to `remotewise_db`.
2. Look up the company ID by legal name (`getCompanyIdByName`) — this is a direct SQL query against `remotewise_db.companies`, used only in the full-lifecycle test to resolve the company ID needed for the admin KYB approval call.

The new framework has no `db-connection-manager` utility. Before these tests can be ported, one of two alternatives must be chosen and approved at CP-3:

- Port `db-connection-manager` into the new framework (introduces a direct DB dependency to a previously API-only framework).
- Replace DB operations with equivalent admin API calls: disable 2FA via admin user-update endpoint; look up company ID via an admin API search endpoint that returns company ID from legal name.

**This is a HITL decision point.** The migration agent must not resolve it unilaterally. Flag to the orchestrator before writing the new `OnboardingFixture`.

Additional domain quirks:
- The admin KYB approval endpoint returns HTTP 200 with a success flag in the body; the test asserts the status code before proceeding to reload the page.
- The registration document upload accepts a generated dummy PDF; real document validation happens asynchronously on the backend after submission — the UI does not surface backend validation failures inline.

---

## Migration decision

| Cluster | Test ID | Decision | Reason |
|---|---|---|---|
| Confirm Company Details (submission) | 43ea87fdbb6d | rewrite | UI flow, new fixture required, DB blocker must be resolved first |
| Full lifecycle + KYB approval | 5d2cadb20aa3 | rewrite | UI flow + admin API, DB blocker is critical path, HITL approval needed |
| Complete Company Profile | 717b20f4dc8f | rewrite | UI flow, same DB-dependent fixture, otherwise straightforward |
| intercept-registration.spec.ts | 36b4d5679a0a | skip (skipped_obsolete) | API discovery script only, no assertions, no CI value |

**Overall feature decision: rewrite** — all three active tests warrant migration once the DB-dependency blocker is resolved. The skipped script has no migration value.

**Blocked on:** CP-3 approval for the DB-connection-manager vs admin API decision before `OnboardingFixture` can be written.

**Target path:** `features/onboarding/tests/ui/frontoffice/`

---

## Supplementary: per-cluster breakdown

### Cluster A — Confirm Company Details submission

**Test:** 43ea87fdbb6d (`confirm-company-details.spec.ts`)

Scenario A1 — Submit company details, card shows In Progress (P0):
- Navigate to the activity page.
- Open the "Confirm Company Details" card.
- Fill in: company LinkedIn URL, authorized signatory (self as signatory), registration document PDF upload.
- Submit the form.
- Expected: Redirected back to `/activity`; card is still visible with "In Progress" status.

---

### Cluster B — Full onboarding lifecycle with KYB approval

**Test:** 5d2cadb20aa3 (`client-full-onboarding.spec.ts`)

Scenario B1 — KYB approval removes the card (P0):
- Navigate to the activity page.
- Open the "Confirm Company Details" card, fill required fields, and submit.
- Verify card transitions to "In Progress".
- Via admin API: look up company ID from DB by registered legal name, then approve KYB.
- Reload the activity page.
- Expected: "Confirm Company Details" card is no longer present.

The `getCompanyIdByName` DB lookup is a hard dependency in the current implementation — if it fails, the test cannot reach the admin approval step.

---

### Cluster C — Complete Company Profile

**Test:** 717b20f4dc8f (`company-profile.spec.ts`)

Scenario C1 — Fill all required company info fields and save (P0):
- Navigate to the activity page.
- Click the "Complete company profile" card.
- On the Company Info settings tab, fill all required fields.
- Click Save.
- Expected: A success toast is shown on screen.

---

### Skipped test

**Test:** 36b4d5679a0a — `intercept-registration.spec.ts`

Decision: skip (skipped_obsolete). Network-interception script used for API discovery during development. Has no assertions. Not a CI test. Produces console output only. No migration value.

---

### Merge candidates

None. All three clusters cover distinct tasks on the activity page. Each requires a freshly provisioned account (onboarding state is mutated per test). Merging would require sequential execution with state isolation, adding fragility for no reduction in coverage.

## Migration plan — as-was vs as-proposed

### 🕰 Project BEFORE (legacy)

| # | Spec file | What it does today | Pain points |
|---|---|---|---|
| 1 | `confirm-company-details.spec.ts` | One UI test that completes the "Confirm Company Details" step after registration and verifies the company moves to *In Progress*. | Uses `OnboardingFixture.registerAndLogin` which hits MySQL directly to disable 2FA on the freshly-created account — violates the new framework's API-only rule. |
| 2 | `client-full-onboarding.spec.ts` | One UI test that drives the full onboarding lifecycle and triggers admin KYB approval. | Hits MySQL **twice** — once to disable 2FA, once via `getCompanyIdByName` to resolve the company id before calling the admin approve endpoint. |
| 3 | `company-profile.spec.ts` | One UI test that fills the Company Profile screen and verifies the profile is saved. | Same MySQL dependency for 2FA disable; identical setup to spec #1, but each test mutates distinct onboarding state so they cannot be merged blindly. |
| 4 | `intercept-registration.spec.ts` | A `@manual` probe that intercepts network calls during registration to discover endpoint shapes. No assertions. | Pure exploration script — superseded by the documented endpoint specs in `docs/api-discovery/`; brings no regression value. |

**Today's total:** 4 legacy spec files · **3 active UI tests + 1 manual probe** · all blocked on a live MySQL connection.

---

### 🚀 Project AFTER (proposed)

| # | New spec file | Module / layer | What changes & why |
|---|---|---|---|
| 1 | `confirm-company-details.spec.ts` | `features/onboarding/tests/ui/frontoffice/` | New `ConfirmCompanyDetailsPage` + new `OnboardingFixture` that uses an admin API call (instead of MySQL) to look up the freshly-created company and disable 2FA. **Why:** keeps the framework API-only and removes the MySQL dependency entirely — see HITL #1 and #2. |
| 2 | `kyb-approval.spec.ts` | `features/onboarding/tests/ui/frontoffice/` | Same `OnboardingFixture` plus a new `seeding.ts` helper / fixture that wraps the admin KYB approve endpoint. **Why:** company id is resolved through the admin API (`/api/admin/company?name=…`) instead of a raw SQL query, so the test stops depending on DB driver / schema. |
| 3 | `company-profile.spec.ts` | `features/onboarding/tests/ui/frontoffice/` | New `CompanyProfilePage`, reuses `OnboardingFixture`. **Why:** mirrors spec #1's setup so we can later collapse the two if the team confirms the merge is safe (currently kept separate to avoid state coupling). |
| 4 | — | — | The legacy `intercept-registration.spec.ts` is dropped (`skipped_obsolete`). **Why:** its discovery purpose is replaced by the documented endpoint specs maintained by `rp-scribe` and the migration agents. |

**Proposed total:** 3 new spec files · **3 tests** · zero MySQL dependency · same coverage · 1 obsolete probe retired.

## Open questions (HITL)

| # | Question | Asked by | Status | Answer |
|---|---|---|---|---|
| 1 | Direct MySQL access (`db-connection-manager`, `getCompanyIdByName`) conflicts with the new framework's API-only principle. Port the DB utility OR replace with admin API calls? **CP-3 decision.** | scenario-extraction-agent | Pending | — |
| 2 | Is there an existing admin endpoint to disable 2FA for a freshly-registered account, or must one be requested from backend? | scenario-extraction-agent | Pending | — |
