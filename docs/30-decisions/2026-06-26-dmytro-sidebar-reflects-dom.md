# ADR 2026-06-26 — Sidebar component reflects the rendered DOM; URL-only screens navigate via `goto`

**Status:** Accepted · **Decider:** Dmytro · **Context:** Cleanup phase, B2 (Expenses URL-only)

## Context
The shared `core/ui/components/Sidebar.ts` layout component models the navigation
sidebar actually rendered by the RemotePass sandbox. Not every screen has a sidebar
entry: the Expenses screen, for example, is reachable only by URL on the current
sandbox — the live sidebar does not render an Expenses link.

`features/expenses/pages/frontoffice/ExpensesPage.ts` carried a `sidebarLink`
locator (`a[href="/expenses"]`) and a `navigateViaMenu()` method that clicked it.
Grep confirmed both were dead — defined and referenced only inside `ExpensesPage`,
no external callers; every spec already navigates via `open()` (a `goto('/expenses')`).
The locator targeted a DOM element that the sandbox never renders, so it was a
fabricated affordance: latent, untested, and a trap for the next author.

## Decision
A `Sidebar` (or any layout) component MUST reflect the DOM that is actually rendered.
It does NOT get entries for screens the sandbox does not surface in the sidebar.

Screens reachable only by URL are navigated through their page object's `open()`
(`page.goto(route)`), never through a fabricated sidebar locator. Accordingly:
- Removed `sidebarLink` and `navigateViaMenu()` from `ExpensesPage`.
- Did NOT add Expenses to the `Sidebar` union — the component must mirror reality.

## Consequences
- The `Sidebar` union stays an honest map of real navigation; a missing entry now
  signals "no sidebar link exists" rather than "nobody added it yet".
- URL-only pages have one navigation path (`open()` / `goto`), removing the dead
  second path that could silently rot or mislead.
- If the sandbox later renders an Expenses sidebar link, add it to `Sidebar` then —
  driven by observed DOM, not anticipated structure (no premature abstraction).
- No behaviour change to passing tests: specs already used `open()`.
