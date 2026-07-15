# Scenario: {{TITLE}}

> Framework-agnostic business intent of legacy test(s). No code, no Playwright syntax.
> Written by `scenario-extraction-agent`; consumed by `playwright-migration-agent`.

- **Feature:** {{FEATURE}}
- **Priority:** {{P0|P1|P2}}
- **Legacy test id(s):** {{INVENTORY_IDS}}
- **Legacy file(s):** {{LEGACY_PATHS}}
- **Status:** {{pending|in_progress|migrated|...}}

## User intent

_What is the user trying to achieve? Plain English, no implementation._

## Preconditions

- Role: {{client|worker|admin}}
- Account state: {{ongoing contract, blocked KYC, no payment method, ...}}
- Data: {{specific entities required}}

## Steps (intent only)

1. {{Action 1}}
2. {{Action 2}}
3. {{...}}

## Expected outcome

- {{Assertion 1}}
- {{Assertion 2}}

## Edge cases / variants

- {{Variant 1}}
- {{Variant 2}}

## Domain notes

- {{API or UI quirks that the migrating agent must know}}
- {{Cross-module dependencies}}

## Migration decision

- **Decision:** {{migrate|rewrite|merge|skip|blocked}}
- **Target module:** `modules/{{module}}/tests/{{api|ui}}/`
- **Reuses existing:** {{seeding/clients/pages — list paths}}
- **Needs new:** {{fixtures/clients/builders/pages to create first}}
- **Rationale:** {{one paragraph}}

## Migration plan — as-was vs as-proposed

| Legacy file | New module path | Pages needed | Fixtures / Builders | API client | Tests in new file |
|---|---|---|---|---|---|
| {{legacy file 1}} | {{new path 1}} | {{pages}} | {{fixtures}} | {{api client}} | {{count or merge note}} |

## Open questions (HITL)

| # | Question | Asked by | Status | Answer |
|---|---|---|---|---|
| 1 | {{question text}} | {{agent name}} | Pending | — |
