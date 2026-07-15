# Contracts — Scenario Catalogue

## User intent
As a **client**, I want to manage worker contracts on RemotePass: change the **salary currency** on EOR contracts (both before signature via edit, and on active contracts via an amendment that both parties sign), and **bulk-import** many contractor contracts from a CSV with a CoR eligibility check and invitations. As a **contractor**, I want to **self-register** and land authenticated in the app.

## Preconditions
- A client/company account exists and is authenticated (UI flows inject an API-obtained token; API flows authenticate via the auth fixture).
- EOR edit flow: an EOR contract in **Pending company signature** state is available (referenced by string ref + numeric id).
- EOR amendment flow: at least one **clean Ongoing EOR contract** exists (no pending amendment, amendable) and an **admin/provider** signer is available.
- Currency catalogue is reachable to resolve USD/EUR (and others) to numeric IDs.
- Bulk import: prepared CSV fixtures — a clean 17-row set (9 CoR) for Fixed/PAYG/Milestone, and an errors set with one invalid signatory email.
- Contractor registration: an OTP source for **workers** (worker OTP is a real code, not the `9999` client bypass) and a unique contractor identity per run.

## Steps (intent only)
**EOR salary currency — edit (unsigned):** resolve currencies → read contract salary currency (distinct from billing) → change salary currency → confirm it persists, allowances inherit it, and billing/amount/name/start-date are untouched; no external webhook fires.
**EOR salary currency — amendment (active):** discover a clean Ongoing EOR contract → raise a currency-change amendment → confirm pending-amendment state with no salary-decrease block and no webhook → client signs → admin signs as provider → contract returns to Ongoing with the new salary currency, unchanged billing currency, and allowances inheriting the new currency.
**Contractor registration:** choose account type → enter email → accept terms → verify OTP → fill personal info → submit → arrive authenticated on the Activity page with a personalised greeting.
**Bulk import:** open the wizard → select worker + contract type (both required) → use/download the per-type CSV template → upload CSV → review counts, CoR flags, filters and search → edit/delete rows or fix errors via the sidebar → run the CoR eligibility assessment → import → review success → invite all workers (or defer).

## Expected outcome
- Salary currency can be changed via both edit and amendment; the change persists and allowances follow the salary currency.
- Billing currency and all non-currency contract fields are never collaterally modified by a currency-only change.
- A currency-only change is non-material — no webhook is dispatched and no salary-decrease error is raised.
- An amendment requires both client signature and admin provider signature to complete, after which the contract is Ongoing again.
- A contractor can register and reach the authenticated app in one pass.
- A clean CSV imports cleanly (counts and CoR flags match the source); error rows are detected and fixable; eligibility gates the import; imported workers can be invited.

## Edge cases / variants
- Bulk-import contract-type variants: **Fixed**, **PAYG** (template adds *Rate*), **Milestone** (template omits payment-schedule columns) — same downstream review/import/invite flow.
- Invite completion variants: **Invite all workers** with a custom message vs **Do it later**.
- Wizard validation: missing worker type and missing contract type each raise their own validation message.
- CSV with an invalid signatory email yields exactly one error row that becomes *Ready* once fixed.
- EOR edit currency restored in teardown (idempotent); amendment flow auto-discovers a fresh contract each run.
- Reserved/unimplemented cases (numbering gaps): TC-002 invalid-currency negative test, TC-012 amendment rejection, TC-014 concurrent-amendment conflict.

## Domain notes
- **Salary currency vs billing currency** are independent fields on an EOR contract; allowances inherit the salary currency.
- An EOR **amendment** to an Ongoing contract is a two-party signature flow: client signs, then admin/provider signs (`sign_as_provider`) to reactivate.
- A currency-only change is classified **non-material**: no webhook, no salary-decrease guard trip.
- **CoR** (Certificate of Coverage / contractor-of-record eligibility) is assessed per import batch via a 3-step questionnaire; CoR count is tracked per row.
- **Worker/contractor OTP cannot use the `9999` bypass** that clients use — it must be read from the DB (legacy: direct `remotewise.users` query). Per the 2026-06-03 team strategy, real DB-OTP is only for OTP-generation tests; other flows should use the nines bypass once worker support lands.

## Migration decision
**Rewrite** all into the feature-first `features/contracts/` slice. The EOR salary-currency API spec becomes a typed `EORClient` + a `contracts` `seeding.ts` helper that edits/amends salary currency (edit and amend-sign-activate), wrapped by factory fixtures and driven by builders instead of `EOR_CONTRACT_REF`/`EOR_CONTRACT_ID` env vars and ad-hoc `findCleanOngoingEOR` scanning. The four bulk-import UI specs map to POM-v4 pages under `features/contracts/pages/frontoffice/bulk-import/` plus a bulk-import `seeding.ts` helper / fixture; the three Fixed/PAYG/Milestone import-and-invite tests **merge** into one data-parameterised test. Contractor registration becomes a UI test backed by an auth `seeding.ts` helper / registration page, with OTP retrieval moved behind a fixture/helper (prefer the nines bypass once worker OTP is unified). CSV fixtures become builder-generated or fixture-managed data.
