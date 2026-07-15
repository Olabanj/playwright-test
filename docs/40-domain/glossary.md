---
id: 5c21df27-c00d-57b9-896c-d0696d3a9879
name: glossary
description: "RemotePass product and business vocabulary — contract types (Fixed, PAYG, Milestone, EOR, DE), roles, KYC/KYB, approval flows, verification steps, payments, time tracking, platform concepts"
metadata:
  type: reference
  category: domain
  tags: ["glossary", "domain", "remotepass", "contracts", "payments", "kyc", "eor"]
---

# Glossary

RemotePass product and business vocabulary for the QA automation team.

## Roles

| Term | Meaning |
|------|---------|
| Client / Company | Company-side user/entity that creates contracts, manages roles and settings, pays contractors, and assigns approvers. |
| Contractor / Worker | Person invited to a contract; completes profile/KYC, signs, submits work/expenses/time off, and withdraws funds. |
| Approver | User assigned to approve or decline an item at contract level or inside a Custom Approval Flow. |

## Contract Types

| Term | Meaning |
|------|---------|
| Fixed | Contract with a fixed rate paid on a recurring cycle (monthly, weekly, biweekly, twice a month). |
| PAYG | Pay As You Go — contractor submits work items; payment is per submitted/approved work. |
| Milestone | Contract paid upon completion of defined milestone deliverables. |
| EOR | Employer of Record — full-time employment contract managed through the RemotePass EOR entity. |
| DE | Direct Employment — company employs a worker directly, managed through the platform. |

## Verification and Compliance

| Term | Meaning |
|------|---------|
| KYC | Know Your Customer — contractor identity verification step, reviewed and approved from the Admin Panel. |
| KYB | Know Your Business — company/client identity verification step required for full platform access. |
| MSA | Master Service Agreement — must be signed from Admin Panel → Companies before a client can sign an EOR SOW. |
| SOW | Statement of Work — the EOR employment contract document signed by client and EOR entity. |

## Payments and Finance

| Term | Meaning |
|------|---------|
| Payroll | Periodic payment processing cycle for all active contracts. |
| Payroll Approval | Company-level feature that holds payments in an approval queue before processing. Requires both admin company gate and per-contract toggle. |
| Pending Review | Activity-page card shown when the current user has payment approvals waiting for their action. |
| Custom Approval Flow | Ordered approver chain for payments, expenses, milestones, and submitted works. |
| Invoice | Payment document generated after payroll is processed for a period. |
| Withdrawal | Contractor action to move approved funds from their platform balance to an external payout method. |
| Expense | Contractor-submitted reimbursable cost with category, amount, date, and optional receipt. |

## Platform Areas

| Term | Meaning |
|------|---------|
| Admin Panel | Back-office area used by RemotePass staff for company approval, KYC verification, transaction confirmation, and platform feature toggles. |
| Org Chart | Company organization chart feature for departments, reporting lines, and contract linking. |
| SafetyWing | Insurance provider used for contractor insurance flows; reimbursement goes through the Expenses tab. |
| Sandbox | Test environment — separate from production, safe for creating real-looking data without financial consequences. |

## Time Tracking

| Term | Meaning |
|------|---------|
| Session | A time tracking work period started and stopped by a contractor on a PAYG or time-tracked contract. |
| Policy | Time tracking rules configuration (approval rules, overtime, rounding, etc.) applied to a contract or worker. |
| Time Entry | A manual or session-derived record of hours worked for a specific period. |
