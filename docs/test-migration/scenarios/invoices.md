# Invoices — Test Scenarios

Covers PD-12832 (BE date filter) and PD-11896 (bulk download).

## User intent

As a client, I want to filter my invoice list by a custom date range and bulk-download the matching invoices as a ZIP archive, so I can share or archive invoices for a specific period without downloading each one individually.

## Preconditions

- Authenticated as a client with at least one invoice.
- Sandbox account has known invoice data: at least 1 invoice in Mar–Apr 2026, at least 2 pages of invoices in Jan–Mar 2026 range.
- For UI tests: exactly 4 invoices exist in the Mar 12 – Apr 11 2026 window (stable sandbox anchor).

## Steps (intent only)

1. Open the Invoices page (`/invoices`); verify the page loads with at least one invoice row.
2. Switch to Range filter mode and select a start and end date using the calendar picker.
3. Confirm the table updates to show only invoices within the selected range.
4. (Optional) Verify each displayed invoice date falls within the selected range.
5. Select one or more invoice rows; confirm the floating action bar appears with the correct count.
6. Select all rows; confirm the count matches total rows visible.
7. Clear the selection; confirm the action bar hides.
8. With rows selected, click Download; wait for the browser download event.
9. Confirm the downloaded file is a non-empty ZIP.
10. (API path) POST /api/invoice/list with date params → collect IDs → POST /api/invoice/download/multi → poll GET /api/exports/{id} until status = 'ready' → verify signed S3 URL.
11. Apply a future date range; verify empty state is displayed.
12. Switch back to Monthly mode; verify the full invoice list is restored.

## Expected outcome

- Date filter: only invoices whose `invoice_date` (Unix seconds) falls within [start, end] are returned; no validation error for valid ranges.
- Future range: HTTP 200, `success: true`, empty `data` array (not an error).
- Inverted dates (start > end): HTTP 200, `success: false`, `message: 'Validation Error'`, `data.error` mentions 'end date'.
- Pagination: page 1 and page 2 of a date-filtered list share no duplicate IDs.
- Bulk download API: HTTP 201, export job with `type: 'download-invoices'`, `path` matching `exports/download-invoices/remotepass-invoices-*.zip`, `payload.invoice_ids` matching submitted IDs, `payload.for_client: true`.
- Export polling: status transitions from 'pending' to 'ready' within 30 s; `url` matches `https://*s3.*amazonaws.com/*.zip`.
- Empty invoice_ids: HTTP 200, `success: false`, validation error 'at least 1'.
- UI download: `download.suggestedFilename()` ends in `.zip`; file size > 0.
- UI action bar: hidden (opacity: 0) when nothing selected; visible (opacity: 1) when ≥1 selected; shows '{n} selected' text.

## Edge cases / variants

- `start_date` and `end_date` equal (single-day range): API should return only invoices on that day.
- `invoice_date` is a Unix timestamp in seconds — callers must multiply by 1000 before using JS `Date`.
- Dates must appear in BOTH the query string and the request body; sending body-only is silently ignored.
- Calendar navigation: the `_navigateCalendarTo` helper iterates up to 60 times clicking prev/next — a heavy range can be slow.
- The bulk download is asynchronous (POST returns a job, not a file); the UI polls internally before triggering the browser download event.
- `for_client: true` in the job payload indicates client-scoped invoices; the parallel worker-side invoice download flow (if any) is not covered here.
- Intercom widget must be suppressed before UI interaction (click interception risk).
- Post-login dialogs (onboarding, 'Got it!') must be dismissed before the date picker is accessible.

## Domain notes

- **Dual-param quirk**: POST /api/invoice/list requires dates in both `?start_date=…&end_date=…` query string AND the JSON body. Body-only is silently ignored by the backend.
- **Unix timestamp**: `invoice_date` in the response is seconds since epoch, not an ISO string. Tests multiply by 1000 for JS Date comparison.
- **Async export pipeline**: POST /api/invoice/download/multi returns an export job ID immediately (HTTP 201). The actual ZIP is created asynchronously; callers must poll GET /api/exports/{id} until `status !== 'pending'`.
- **Filter modes**: the UI has two modes — Monthly (default, no custom range) and Range (custom start/end via calendar). Clearing a Range filter means switching back to Monthly mode, which triggers a fresh list call.
- **Floating action bar**: uses CSS opacity (0/1) and translate to show/hide — not `display:none`. Tests assert `toHaveCSS('opacity', …)` not `toBeVisible`.
- **Sandbox anchor**: all date-specific count assertions (e.g. exactly 4 rows in Mar 12 – Apr 11) are anchored to known sandbox data observed 2026-04-11. These will break if sandbox data changes.

## Migration decision

All 13 tests should be **rewritten** in the feature-first framework as `features/invoices/`. The API layer (`InvoiceAPI`) is clean and portable into a typed `features/invoices/client.ts`; the `InvoicesPage` POM is self-contained and ports to `features/invoices/pages/frontoffice/`. The primary rewrite concern is removing the hardcoded sandbox date anchors (4 rows in Mar 12 – Apr 11) in favour of dynamically-created or contract-seeded invoice data so tests remain stable across sandbox refreshes.
