---
id: c3a1853d-b347-50a6-8f62-07ef867a9dad
name: otp-bypass-client-vs-worker
description: "OTP bypass 9999 works for client/company only; worker/contractor use random OTP — fix identified in ContractorService.php, ticket to be assigned to Azeddine"
metadata:
  type: project
  category: domain
  tags: ["otp", "auth", "signup", "test-setup", "worker", "client", "backend", "azeddine"]
  author: dmytro
  createdAt: 2026-05-22T11:01:00Z
  updatedAt: 2026-06-04T11:00:00Z
  expiresAt: null
---

# OTP Bypass — Client vs Worker Inconsistency

## Current Behavior

| Account type | OTP approach |
|---|---|
| Client / Company signup | Hardcoded bypass `9999` |
| Worker / Contractor signup | Random code — must read from DB (`users` table via SSH tunnel) or email |

## Root Cause

`UtilsHelpers.php#L169` has `generate_otp_code()` which already implements the `9999` bypass.
`ContractorService.php` does not pass `$input["email"]` into that call — so contractors always get a real random OTP.

**Fix**: add `$input["email"]` to the `generate_otp_code()` call in `ContractorService.php`.
Once done, `9999` works for all account types and the SSH tunnel + DB read in tests becomes unnecessary.

## Decision (2026-05-21)

- Roman (tech lead) agreed: unify to one approach.
- Slahudeen approved: create a ticket and assign to **Azeddine** (backend dev).
- Does not block tests today; will simplify seeders once fixed.

## Status

Ticket pending creation (Dmytro, waiting for Jira access as of 2026-05-22).

## Update (2026-06-03 standup)

- OTP login logic on the platform **changed**. Backend now generates a real OTP but still supports a bypass code (the "nines"). Tests reading the OTP from the DB still work.
- **Team test strategy:** use the **real OTP (read from DB)** only for tests that specifically verify OTP generation; use the **backdoor nines** for all other flows (contract creation, contractor onboarding).
- **Sergiy's OTP PR** currently *removes* the DB-OTP handling entirely → needs rework to keep **both** paths, and to cover the **client** side too (not only contractor), since both use OTP.
- **Open question:** does the email actually deliver the nines or a real OTP (esp. worker vs client)? Baha believes the client email receives nines; to be confirmed on Slack.
