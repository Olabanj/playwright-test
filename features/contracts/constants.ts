import path from 'path';

// EOR contract enums from GET /api/contract/list (ported from legacy eor.types).

/** Status id for an Ongoing contract. */
export const EOR_STATUS_ONGOING_ID = 4;

/** `type` string identifying an EOR Employee contract. */
export const EOR_CONTRACT_TYPE_EOR_EMPLOYEE = 'EOR Employee';

// ==================== Bulk Import CSV fixture paths ====================

const CSV_DIR = path.resolve(process.cwd(), 'features/contracts/fixtures/files');

/** 17-row Fixed contract CSV — all rows valid, 9 CoR. */
export const BULK_IMPORT_CSV_CLEAN = path.join(CSV_DIR, 'contract-bulk-import-clean.csv');

/** 17-row Fixed contract CSV — row 16 (Katarzyna Nowak) has an invalid signatory email. */
export const BULK_IMPORT_CSV_WITH_ERRORS = path.join(CSV_DIR, 'contract-bulk-import-with-errors.csv');

/** 17-row PAYG contract CSV — all rows valid, 9 CoR. */
export const BULK_IMPORT_CSV_PAYG_CLEAN = path.join(CSV_DIR, 'contract-bulk-import-payg-clean.csv');

/** 17-row Milestone contract CSV — all rows valid, 9 CoR. */
export const BULK_IMPORT_CSV_MILESTONE_CLEAN = path.join(CSV_DIR, 'contract-bulk-import-milestone-clean.csv');

/** Single-row PAYG template example CSV (mirrors the downloaded template). */
export const BULK_IMPORT_CSV_TEMPLATE_PAYG = path.join(CSV_DIR, 'contract-bulk-import-template-payg.csv');

/**
 * Generic dummy PDF reused for DE contract file uploads and EOR employment/data-
 * collection file-upload form fields (content is irrelevant to the sandbox
 * validation — only a valid PDF is required). Same directory as the bulk-import
 * CSVs (`CSV_DIR`), just a non-CSV asset.
 */
export const CONTRACTS_TEST_DOCUMENT_PDF = path.join(CSV_DIR, 'test-document.pdf');

/**
 * Minimal valid JPEG for non-PDF-file-upload-rejection negative tests (e.g. DE/COR
 * Compliance-step upload validation). Added 2026-07-09 while porting
 * create-de-contract.spec.ts — the legacy path (`fixtures/data/files/test-image.jpg`,
 * repo-root-relative) does not exist under this feature; this closes that gap with a
 * feature-owned asset instead of leaving the broken literal path in place.
 */
export const CONTRACTS_TEST_IMAGE_JPG = path.join(CSV_DIR, 'test-image.jpg');

// ==================== Pay-cycle / currency reference data (PR #172) ====================
// Ported verbatim from legacy tests/modules/contracts/helpers/pay-cycle.constants.ts.
// Frequency/occurrence ids verified against the sandbox via POST /api/static/occurrences.

export type PayCycle = 'Monthly' | 'Weekly' | 'Every 2 Weeks' | 'Twice a Month';

export interface PayCycleSpec {
  cycle:        PayCycle;
  frequencyId:  number;
  occurrenceId: number;
}

export const PAY_CYCLES: PayCycleSpec[] = [
  { cycle: 'Monthly',        frequencyId: 4, occurrenceId: 17 },
  { cycle: 'Weekly',         frequencyId: 1, occurrenceId: 1 },
  { cycle: 'Every 2 Weeks',  frequencyId: 2, occurrenceId: 8 },
  { cycle: 'Twice a Month',  frequencyId: 3, occurrenceId: 15 },
];

/** Sandbox currency ids (see seeder-constants SEEDER_CURRENCY). */
export const CURRENCY_IDS = { USD: 1, EUR: 2, GBP: 3, AED: 4 } as const;

export type CurrencyCode = keyof typeof CURRENCY_IDS;

/** Sandbox country id used as the contractor tax residence (UAE). */
export const SANDBOX_TAX_RESIDENCE_UAE = 231;
