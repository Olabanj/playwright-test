# Expenses — Frontoffice (Contractor) UI Scenarios

## User intent
As a contractor (worker), I want to view my submitted expenses in a list, create a new expense with an amount, category, date and receipt, inspect an expense's details, and delete an expense that is still pending approval — so I can manage reimbursable costs on my contract.

## Preconditions
- A worker account exists and is authenticated (login is performed via API and the session token is injected so the UI login form is skipped).
- The worker has at least one active contract that accepts expenses (the Add Expense modal selects the first available contract).
- At least one expense category is available for that contract (the modal selects the first available category).
- A receipt file is available for upload (`fixtures/data/files/test-document.pdf`).
- For list assertions, at least one expense already exists (a precondition expense is created up front).

## Steps (intent only)
1. Authenticate as the worker and open the Expenses page (by direct URL or via the sidebar menu).
2. Confirm the page structure: 'Add Expense' action and the table column headers (Contract, Expense, Category, Date, Amount, Status, Actions).
3. Create an expense: open the Add Expense modal, choose a contract, enter a unique expense name, pick a date, choose a category, enter an amount, choose a currency, upload a receipt, and submit.
4. Confirm the new expense appears in the table with a Pending status.
5. Open the expense's Details panel and confirm the displayed name, amount, and 'Pending approval' status.
6. For a pending expense, delete it from the Details panel (with a confirmation modal) and confirm it no longer appears in the table.

## Expected outcome
- The Expenses page renders with the Add Expense control and all expected column headers.
- Existing expenses are listed, each row exposing at least the full set of data cells.
- A newly created expense is persisted and shown in the table as Pending / Pending approval.
- The Details panel shows accurate name, amount, and status for the selected expense.
- A pending expense can be deleted and is removed from the table.

## Edge cases / variants
- Status vocabulary differs by surface: the list table shows 'Pending'; the Details panel shows 'Pending approval' (both defined in EXPENSE_STATUS).
- Only pending expenses are deletable — the Delete button is conditional on status; approved/rejected expenses should not expose it (page object has verifyDeleteButtonNotVisible, currently unused).
- Amount is generated as a random 2-decimal value (10–500) and currency defaults to 'US Dollar'; cross-currency and category-specific variants are not covered by these UI tests but are exercised by the expense seeder.
- Receipt upload is always performed by the create flow; the 'no receipt' / missing-receipt variant is only covered in the API/seeder layer, not here.
- Expense names are timestamp-based ('PW {Date.now()}') to avoid cross-run collisions; row lookup is by name substring (`hasText`), which is fragile if two names share a prefix.

## Domain notes
- Expense (glossary): a contractor-submitted reimbursable cost with category, amount, date, and optional receipt.
- These are frontoffice contractor tests only — there is no client-side approve/reject UI flow in this module (approval exists in ExpensesAPI / seeders).
- Auth is via API-token injection into Redux-Persist `persist:root` (Account.user + token), a much faster path than form login — the dump-auth-storage script documents the exact storage shape.

## Migration decision
Rewrite all three product specs into the feature-first layout under `features/expenses/` on the new architecture (single config, no 3-lane verify/ folder, Playwright best practices). Merge the list and CRUD specs into one expenses UI suite — they share page objects, login, faker, and lifecycle, and the list-structure assertions are cheap additions to the CRUD suite. Replace bespoke beforeAll/afterAll precondition+cleanup with fixture-driven setup/auto-cleanup, and back data creation with a `seeding.ts` helper rather than driving the modal for setup. Skip `dump-auth-storage.spec.ts` — it is a one-off debug/inspection utility (@manual), not a product test; its knowledge is already captured in UIFixture's auth-injection.
