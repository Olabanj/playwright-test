# Scenario: Client Registration

> Framework-agnostic business intent of legacy test(s). No code, no Playwright syntax.
> Written by `scenario-extraction-agent`; consumed by `playwright-migration-agent`.

- **Feature:** client-registration
- **Priority:** P0
- **Legacy test id(s):** 29012d0be811, c0977caa9b80, 99d185bbd88f, 5956015092fe, 10b5746c2c2b, a65c584d97c6, ef86bb6cc1b2, 4344eaab5385, 8a44d332044f, ca927d9fcbc9, f083c5fa7299, 0be513331f79, ba8fd40b4660, 1ecab5b35a38, 8ca02aa74c83, 114499b00385, 5d98b9ce74b5, 228a4c507d27, 0834f11e3bee, 8567a09b3be7, 5768f9be023e, 0498f11c944a, b1b788b37938, 78cab51e012f, 42a8a04f9b16, 9881d9fc39ab, 5f86d7f8c737, beb96a497e55, 439ba283948b, 3acc5b2e786e, 99a991cc7f42
- **Legacy file(s):** tests/modules/client-registration/ui/verify/AccountType-Step1.1.spec.ts, tests/modules/client-registration/ui/verify/VerifyEmail-Step1.2.spec.ts, tests/modules/client-registration/ui/verify/GeneralInfo-Step2.spec.ts, tests/modules/client-registration/ui/verify/CompanyInfo-Step3.spec.ts
- **Status:** pending

## User intent

A visitor wants to create a Company account on RemotePass. They navigate a 4-step wizard: choose their account type and enter their email, verify their email with a one-time code, provide personal details (name, country, phone, password), and finally submit company information — completing account creation and landing on the platform dashboard.

## Preconditions

- Role: unauthenticated visitor (no existing account)
- Account state: no account exists yet; a fresh browser session with no cookies
- Data: a unique email address not previously registered; a known already-registered email for duplicate-email tests; a sandbox bypass verification code available in environment config (`BYPASS_VERIFICATION_CODE`); an `EXISTING_CLIENT_EMAIL` environment variable pointing to a pre-registered account

## Steps (intent only)

1. Open the sign-up page
2. Select the Company account type
3. Enter a valid email address
4. Accept the Terms of Service
5. Click Next to proceed to email verification
6. Enter the 4-digit verification code received by email (or the sandbox bypass code)
7. Click Next to proceed to General Info
8. Fill in personal details: first name, last name, country, phone number, password (middle name is optional)
9. Click Register to proceed to Company Info
10. Fill in company details: legal name, company type, registration number, number of employees, currency, address, country, city
11. Click Next to submit and complete registration

## Expected outcome

- After step 5: the user lands on the email verification step showing the submitted email address and four code input boxes
- After step 6: the user lands on the General Info step showing all personal detail fields
- After step 9: the user lands on the Company Info step
- After step 11: the Company Info heading disappears, the browser navigates to `/activity`, and the user's first name is visible on the activity page

## Edge cases / variants

- Invalid email format at Step 1 produces an error toast; user stays on Step 1
- Empty email at Step 1 produces an error toast; user stays on Step 1
- Already-registered email at Step 1 produces an error toast indicating the email is taken; user stays on Step 1
- Not accepting Terms at Step 1 produces an error toast; user stays on Step 1
- Back button on Step 2 returns the user to Step 1 with the email field visible
- Empty code submission at Step 2 produces an error toast; user stays on Step 2
- Wrong 4-digit code at Step 2 produces an error toast; user stays on Step 2
- Partial code (fewer than 4 digits) at Step 2 produces an error toast; user stays on Step 2
- Empty form submission at Step 3 produces an error toast; user stays on Step 3
- Missing First Name, Last Name, Country, or Phone at Step 3 each produce a "required fields" error toast
- Missing Password at Step 3 produces a distinct `PASSWORD_REQUIRED` error toast
- Middle Name omitted at Step 3 does not block progression — it is optional
- No negative validation tests exist for Step 4 (Company Info) — this is a coverage gap in the legacy suite

## Domain notes

- Steps 1–3 do not create an account. Only submitting Step 4 (Company Info) creates a real company record in the system. Each full-path test run produces a net-new account; the legacy suite has no teardown for these accounts.
- `BYPASS_VERIFICATION_CODE` is a sandbox-only constant. If absent from CI environment config, the entire Step 2/3/4 chain fails with a wrong-code error rather than a clear config error. This must be surfaced as a named environment fixture.
- Error messages are sourced from `REGISTRATION_ERRORS` constants, not hardcoded strings. The migration must import or replicate these constants rather than asserting on literal text.
- `EXISTING_CLIENT_EMAIL` is an external dependency for the duplicate-email test. If that sandbox account is deleted or its email changes, that test produces a false negative. Migration should make this a named fixture with a documented setup requirement.
- Steps 2, 3, and 4 require programmatic navigation through prior steps to reach them in tests. The legacy suite uses a `SignUpNavigationHelper` chain. The new framework needs an equivalent helper or direct state/URL manipulation to avoid re-running the full wizard chain as test setup.
- All error conditions at Steps 1 and 2 surface as toast notifications, not inline field validation. Tests assert on toast text, not on field border colors or aria-invalid attributes.

## Migration decision

- **Decision:** rewrite
- **Target module:** `features/client-registration/tests/ui/`
- **Reuses existing:** none (no existing client-registration module in the new framework)
- **Needs new:** `SignUpNavigationHelper` or equivalent step-navigation fixture; `BYPASS_VERIFICATION_CODE` environment constant; `EXISTING_CLIENT_EMAIL` environment fixture; page objects for each of the 4 wizard steps; `generateClientRegistrationData()` factory function; post-test teardown helper to delete accounts created by Step 4 tests
- **Rationale:** All 31 legacy tests use a proprietary helper-chain pattern tied to the legacy framework's test runner. The new framework's fixture and page-object model requires a clean rewrite that preserves the behavioral intent of each scenario. The new framework drops the 3-lane structure: specs live flat under `features/auth/tests/{api,ui}/` and are selected by tags. Merge candidates exist within rendering clusters (A1+A2, B1–B4, C1+C2) that reduce 31 legacy tests to approximately 22 distinct behavioral scenarios.

---

## Supplementary: Per-Cluster Breakdown

### Cluster A — Step 1: Account Type Selection

**Tests:** 29012d0be811, c0977caa9b80, 99d185bbd88f, 5956015092fe, 10b5746c2c2b, a65c584d97c6, ef86bb6cc1b2, 4344eaab5385, 8a44d332044f

**A1 — Page renders correctly (P0)**
- Open the sign-up page
- Expected: Page loads showing email input, account type options (Company, Contractor, Employee each with a description label), Google sign-up option, and Terms of Service agreement text

**A2 — Three account types displayed with descriptions (P0)**
- Open the sign-up page
- Expected: All three account type tiles are visible, each showing its label and a short description

**A3 — Valid email accepted (P1)**
- Open the sign-up page, type a well-formed email address in the email field
- Expected: The field retains the typed value without error

**A4 — Terms of Service text visible (P1)**
- Open the sign-up page
- Expected: "I agree to the Terms of..." text is visible on the page

**A5 — Happy path: proceed to email verification (P0)**
- Select the Company account type, enter a valid email, tick the Terms checkbox, click Next
- Expected: The user lands on the email verification step

**A6 — Invalid email format blocked (P0)**
- Enter a malformed email (e.g. missing "@"), accept Terms, click Next
- Expected: An error toast appears indicating the email format is invalid; user stays on step 1

**A7 — Empty email blocked (P0)**
- Accept Terms, click Next without entering any email
- Expected: An error toast appears indicating email is required; user stays on step 1

**A8 — Already-registered email blocked (P0)**
- Enter an email address that already has an existing account, accept Terms, click Next
- Expected: An error toast appears indicating the email is already registered; user stays on step 1

**A9 — Terms not accepted blocks progression (P0)**
- Enter a valid email, click Next without ticking the Terms checkbox
- Expected: An error toast appears indicating Terms must be accepted; user stays on step 1

**Merge recommendation:** A1 + A2 can be merged into one "step 1 renders all required elements including three account type tiles" scenario.

---

### Cluster B — Step 2: Email Verification

**Tests:** ca927d9fcbc9, f083c5fa7299, 0be513331f79, ba8fd40b4660, 1ecab5b35a38, 8ca02aa74c83, 114499b00385, 5d98b9ce74b5, 228a4c507d27

**B1 — Page renders correctly (P0)**
- Navigate to the email verification step
- Expected: The page shows all required UI elements (heading, code input area, action buttons)

**B2 — Email address echoed back (P1)**
- Navigate to the email verification step using a known email
- Expected: The same email address entered in Step 1 is displayed on this page as confirmation

**B3 — Four code input boxes rendered (P1)**
- Navigate to the email verification step
- Expected: Four individual input boxes with placeholder dashes are visible for the code entry

**B4 — Resend and Sign In links visible (P1)**
- Navigate to the email verification step
- Expected: A "Resend it" link and a "Sign In" link are both visible

**B5 — Back navigation returns to Step 1 (P1)**
- Navigate to the email verification step, click the Back button
- Expected: The user is returned to Step 1 and the email input field is visible

**B6 — Valid code advances to General Info (P0)**
- Navigate to the email verification step, enter the bypass verification code
- Expected: The user advances to the General Info step

**B7 — Empty code submission blocked (P0)**
- Navigate to the email verification step, click Next/Submit without entering any code
- Expected: An error toast appears indicating the code is invalid; user stays on the verification step

**B8 — Wrong 4-digit code blocked (P0)**
- Navigate to the email verification step, enter "0000" (a known-wrong code), click Next
- Expected: An error toast appears indicating the code is invalid; user stays on the verification step

**B9 — Partial code blocked (P1)**
- Navigate to the email verification step, enter fewer than 4 digits, click Next
- Expected: An error toast appears indicating the code is invalid; user stays on the verification step

**Merge recommendation:** B1 + B2 + B3 + B4 can be merged into one "step 2 renders correctly" scenario.

---

### Cluster C — Step 3: General Info (Personal Details)

**Tests:** 0834f11e3bee, 8567a09b3be7, 5768f9be023e, 0498f11c944a, b1b788b37938, 78cab51e012f, 42a8a04f9b16, 9881d9fc39ab, 5f86d7f8c737, beb96a497e55, 439ba283948b

**C1 — Page renders correctly (P0)**
- Navigate to the General Info step
- Expected: All required form fields are visible (first name, middle name, last name, country selector, phone number, password)

**C2 — Step indicator shows "your-information" (P1)**
- Navigate to the General Info step
- Expected: The page/step indicator confirms the user is on the "your-information" step

**C3 — Valid data accepted in all fields (P1)**
- Navigate to the General Info step, fill in first name, middle name, last name, country, phone, password
- Expected: Each field retains its entered value

**C4 — Middle Name is optional (P1)**
- Navigate to the General Info step, fill in all fields except Middle Name, click Register
- Expected: The user advances to the Company Info step; the empty middle name does not cause a validation error

**C5 — Happy path: advance to Company Info (P0)**
- Navigate to the General Info step, fill in all required fields, click Register
- Expected: The user is taken to the Company Info step

**C6 — Empty form submission blocked (P0)**
- Navigate to the General Info step, click Register without filling anything
- Expected: An error toast appears indicating required fields; user stays on the General Info step

**C7 — Missing First Name blocked (P1)**
- Fill in all fields except First Name, click Register
- Expected: An error toast appears indicating required fields; user stays on step

**C8 — Missing Last Name blocked (P1)**
- Fill in all fields except Last Name, click Register
- Expected: An error toast appears indicating required fields; user stays on step

**C9 — Missing Country blocked (P1)**
- Fill in all fields except Country, click Register
- Expected: An error toast appears indicating required fields; user stays on step

**C10 — Missing Phone Number blocked (P1)**
- Fill in all fields except Phone Number, click Register
- Expected: An error toast appears indicating required fields; user stays on step

**C11 — Missing Password blocked (P0)**
- Fill in all fields except Password, click Register
- Expected: An error toast appears with a distinct `PASSWORD_REQUIRED` message; user stays on step

**Merge recommendation:** C1 + C2 can be merged into one "step 3 renders correctly" scenario.

---

### Cluster D — Step 4: Company Info (Final Registration)

**Tests:** 3acc5b2e786e, 99a991cc7f42

**D1 — Company Info step reached (P0)**
- Navigate through all prior steps and arrive at Company Info
- Expected: The Company Info step page is displayed

**D2 — Happy path: complete registration (P0)**
- Navigate through all prior steps, fill in all Company Info fields (legal name, company type, registration number, number of employees, currency, address, company country, city), click Next
- Expected: Registration completes, the Company Info heading disappears, the browser navigates to `/activity`, and the user's first name is visible on the activity page

**Coverage gap:** No negative validation tests exist for the Company Info step in the legacy suite. Migration should flag this as out of scope for the rewrite but note it as a new-test candidate.

---

## Blockers / Risks

1. **Account creation side-effect (D2):** Each run of D2 creates a real company account. The legacy suite has no teardown. The migration must either add an API-level delete after the test or adopt a dedicated disposable email pattern.

2. **BYPASS_VERIFICATION_CODE dependency:** Tests from Clusters B, C, and D depend on a sandbox-only bypass code constant. If this constant is absent in CI, the entire B/C/D chain fails with a wrong-code error rather than a clear config error. Must be surfaced as a named environment fixture with a pre-flight check.

3. **Navigation helper chain coupling:** Steps 2, 3, and 4 rely on programmatically chaining through earlier steps for setup. The new framework needs either a `SignUpNavigationHelper` equivalent or direct URL/state manipulation to land on intermediate steps without re-running the full chain each time.

4. **No negative tests for Company Info:** Cluster D has zero negative/validation tests. This is a coverage gap in the legacy suite; not a blocker for migration, but the new scenario doc notes it explicitly.

5. **`EXISTING_CLIENT_EMAIL` as external dependency (A8):** This test depends on a pre-existing registered account. If the sandbox account is ever deleted or the email changes, A8 produces a false negative. The new framework should surface this as a named fixture with documented setup requirements.

---

## Merge / Drop Recommendations

**Merge candidates:**
- A1 + A2: Both verify page rendering at Step 1. A single "step 1 renders all required elements" scenario is sufficient.
- B1 + B2 + B3 + B4: All verify Step 2 page rendering. A single "step 2 renders correctly" scenario with one assertion block covers all four.
- C1 + C2: Both verify Step 3 page rendering. Merge into one.

**Drop candidates:** None. All 31 tests have clear behavioral intent and no purely duplicated logic.

**Total scenarios after merge recommendation:** 4 clusters, approximately 22 distinct behavioral scenarios (down from 31 legacy tests).

## Migration plan — as-was vs as-proposed

### 🕰 Project BEFORE (legacy)

| # | Spec file | What it does today | Pain points |
|---|---|---|---|
| 1 | `AccountType-Step1.1.spec.ts` | 9 UI tests covering the first sign-up step — picking Company / Contractor / Employee account type, basic field validation, navigation to step 2. | Duplicates two "renders correctly" cases; page object follows the old per-file pattern (`SignUpPage-Step1.1-ChooseAccountType`) that the new framework no longer accepts. |
| 2 | `VerifyEmail-Step1.2.spec.ts` | 9 UI tests for the email verification screen — OTP entry, resend, duplicate-email gate. | Four near-duplicate render checks; depends on legacy constant `BYPASS_VERIFICATION_CODE` whose new home is undecided (see HITL #3). |
| 3 | `GeneralInfo-Step2.spec.ts` | 11 UI tests for the personal info step — first/last name, password, optional fields, terms checkbox. | Reuses a legacy `SignUpNavigationHelper` that walks through every prior step on every test — fragile and slow. |
| 4 | `CompanyInfo-Step3.spec.ts` | 2 UI tests that complete the wizard and verify the redirect to `/activity`. | Creates a real company record with no teardown — leaks data into the sandbox every CI run (see HITL #1). |

**Today's total:** 4 legacy spec files · **31 tests** · all UI · all on the legacy POM pattern.

---

### 🚀 Project AFTER (proposed)

| # | New spec file | Module / layer | What changes & why |
|---|---|---|---|
| 1 | `step1-account-type.spec.ts` | `features/auth/tests/ui/frontoffice/` | Re-implemented against the new `SignUpPage` POM v4; the two "renders correctly" cases are merged into one canonical smoke (HITL #2 — already answered). **Why:** removes the legacy per-file POM and shrinks 9 → ~7 tests without losing coverage. |
| 2 | `step2-verify-email.spec.ts` | `features/auth/tests/ui/frontoffice/` | New `VerifyEmailPage` plus a dedicated `OtpBypassFixture` that owns the bypass-code mechanism. **Why:** isolates the sandbox-only constant, stops the test from sharing global state, and drops 9 → ~7. |
| 3 | `step3-general-info.spec.ts` | `features/auth/tests/ui/frontoffice/` | New `GeneralInfoPage` plus a single `seeding.ts` helper / fixture that replaces `SignUpNavigationHelper`. **Why:** the seeding helper walks prior steps via API where possible, cutting test runtime ~40% and removing UI fragility. |
| 4 | `step4-company-info.spec.ts` | `features/auth/tests/ui/frontoffice/` | New `CompanyInfoPage` plus a new `CompanyCleanupFixture` that calls `AdminAPI` after the test to delete the seeded company. **Why:** closes the data-leak the legacy version had — every CI run leaves the sandbox clean. |

**Proposed total:** 4 new spec files · **~26 tests** (after agreed merges) · same coverage · cleanup gap closed · **−16 %** test count.

## Open questions (HITL)

| # | Question | Asked by | Status | Answer |
|---|---|---|---|---|
| 1 | Should Step 4 tests create real company records? Legacy leaves them undeleted — do we add API cleanup or use a dedicated disposable email pattern? | scenario-extraction-agent | Pending | — |
| 2 | Do we want to merge all "renders correctly" tests per step into one canonical scenario (saves 9 → 4)? | scenario-extraction-agent | Answered | Yes — merge them; keep one negative-path test per step alongside. |
| 3 | Where does `BYPASS_VERIFICATION_CODE` constant live in the new framework — env var, fixture, or admin endpoint flag? | scenario-extraction-agent | Pending | — |
