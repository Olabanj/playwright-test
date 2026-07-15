---
id: 122f69af-f7c4-588d-ac42-817b85435abc
name: eor-contract-currency-and-amendments
description: "EOR contract domain behaviour (PD-13186): salary vs billing currency, allowance inheritance, non-material currency change, two-signature amendment flow, ref-vs-id quirk, bulk-import CoR eligibility"
metadata:
  type: reference
  category: domain
  tags: ["eor", "contracts", "salary-currency", "amendment", "cor", "bulk-import"]
  author: dmytro
  createdAt: 2026-06-10T14:34:13Z
  updatedAt: 2026-06-10T14:34:13Z
  expiresAt: null
---

# EOR Contract — Currency & Amendments

Discovered during legacy-suite investigation (2026-06-10), source: `tests/modules/contracts/api/verify/eor-salary-currency.spec.ts` (PD-13186).

## Salary currency vs billing currency

- `salary_currency` is a **separate, first-class field** on an EOR contract, independent of the billing currency (`contract.currency`).
- **Allowances inherit the salary currency** — after a salary-currency change every allowance follows the new currency.
- A salary-currency edit on an **unsigned** contract goes via `PATCH /api/contract/fulltime/{id}` (EOR contracts are "fulltime" on the backend) and must not touch billing currency, amount, name or start_date.

## Currency-only change is non-material

- No `webhook_dispatched` is set — no external webhook fires.
- The **salary-decrease guard does not trip** — a currency change is not treated as a salary reduction.

## Amendment flow (Ongoing contract) — two signatures

1. Client raises the amendment: `POST /api/contract/amendment/add` → `has_amendment=true`.
2. Client signs: `POST /api/contract/signature`.
3. Admin signs as provider: `POST /api/admin/contract/fulltime/{id}/sign_as_provider`.
4. Contract returns to **Ongoing** with the new salary currency; billing currency unchanged.

## API quirk

- Contract details are fetched **by string ref** (`GET /api/contract/{ref}/details`); passing the numeric id returns **400**.

## Bulk import (related contracts-domain facts)

- **CoR eligibility** is a 3-step questionnaire (contractor assessment → worker role → legal entity) gating the import of CoR-flagged rows.
- CSV template columns differ by contract type: **PAYG adds a Rate column; Milestone omits payment-schedule columns**.

Related: [[glossary]], [[legacy-service-map]], [[otp-bypass-client-vs-worker]] (worker OTP for contractor registration).
