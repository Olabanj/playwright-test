// Single source of truth for contract-domain types.
// Real types in use: Contract (list), the EOR salary-currency shapes, and the
// contract-creation-lifecycle shapes below (PR #172). The former
// Currency/PaymentCycle/ContractType/CreateContractRequest/UpdateContractRequest
// EXAMPLE scaffolding was removed 2026-07-08 once the real create-lane builders
// (builders/{fixed,payg,milestone}-contract.builder.ts) replaced the
// *.example.ts stubs that used it.

/** A contract as returned by GET /api/contract/list (numeric id + string ref). */
export interface Contract {
  id:    number;
  ref:   string;
  name?: string;
  [key: string]: unknown;
}

// ─── EOR salary-currency (PD-13186) — ported from legacy utils/types/eor.types ───

/** Platform currency from GET /api/static/currencies. */
export interface EorCurrency {
  id:     number;
  code:   string;
  symbol: string;
  name?:  string;
}

export interface EorAllowance {
  id?:          number;
  name:         string;
  amount:       number | string;   // API may return a string — callers use Number(amount)
  currency_id?: number;
}

/** EOR contract details from GET /api/contract/{ref}/details. */
export interface EorContract {
  id:               number;
  ref:              string;
  type?:            string;
  status?:          { id: number; name: string };
  salary_currency?: EorCurrency;
  currency?:        EorCurrency;   // billing currency — independent of salary_currency
  allowances?:      EorAllowance[];
  has_amendment?:   boolean;
  can_amend?:       boolean;
  [key: string]:    unknown;
}

/** Loose list wrapper — the API nests results under `data`. */
export interface ContractListWrapper<T> { data?: T[]; }

/** Response of PATCH /api/contract/fulltime/{id} (salary-currency edit). */
export interface UpdateContractResponse {
  success?:      boolean;
  message?:      string;
  data?:         Record<string, unknown>;
  [key: string]: unknown;
}

/** Loose mutation response — `data.error` carries idempotent "already done" markers. */
export interface ContractMutationResponse {
  success?:      boolean;
  message?:      string;
  data?:         { error?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/** A clean Ongoing EOR contract discovered for the amendment flow. */
export interface CleanContract {
  id:               number;
  ref:              string;
  salaryCurrencyId: number;
  hasAllowances:    boolean;
}

// ─── Contract creation lifecycle (PR #172) — ported from legacy lifecycle-core ───
// Straight port of LifecycleWorker/CycleResult/UiCreds/LifecycleType, no logic change.

/** A registered worker/contractor identity, produced by worker self-registration. */
export interface LifecycleWorker {
  userId:   number;
  token:    string;
  fullName: string;
  email:    string;
}

/** UI login credentials for a lifecycle actor (client or worker). */
export interface UiCreds {
  email:    string;
  password: string;
}

export type LifecycleType = 'Fixed' | 'PAYG' | 'Milestone' | 'COR' | 'DE' | 'EOR';

/** Normalised outcome of any full-cycle lifecycle helper, regardless of contract type. */
export interface CycleResult {
  type:        LifecycleType;
  contractId:  number;
  contractRef?: string;
  worker?:     { userId: number; email: string; name: string };
}

// ─── Contractor self-registration (worker-registration Flow B, Phase 4) —
// signup → OTP verify → profile activation/completion. Ported (shape) from
// legacy WorkerRegistrationAPI (services/api/modules/worker-registration). ───

/**
 * Contractor self-registration input — reused by both
 * `ContractorClient.activateProfile` and `.completeContractorProfile`
 * (each method only reads the fields relevant to its own step, mirroring the
 * legacy client's single `WorkerRegistrationData` shape passed to both calls).
 */
export interface WorkerRegistrationData {
  email:      string;
  firstName:  string;
  lastName:   string;
  phone:      string;
  password:   string;
  countryId?: number;
}

export type ContractorType = 'Fixed' | 'PAYG' | 'Milestone';

/** Shared payload shape for create-time contractor contract methods (create + validate lane). */
export interface ContractorContractCreateData {
  contractorName:  string;
  currencyId:      number;
  signatoryId:     number;
  templateId:      number;
  startDate?:       string;
  firstPaymentDate?: string;
  frequencyId?:     number;
  occurrenceId?:    number;
  taxResidenceId?:  number;
  amount?:          number;
  rateId?:          number;
  contractName?:    string;
  attributes?:      { id: number; value: string }[];
  milestones?:      { name: string; amount: number }[];
  /**
   * Contractor-of-Record marker (Phase 5) — COR is NOT a separate contract
   * type, it is `is_cor: true` on a Fixed/PAYG/Milestone contract. Read by the
   * `.asCor()` builder methods for self-documentation/assertions; the
   * dedicated `createCorContract`/`createCorPaygContract`/
   * `createCorMilestoneContract` client methods always send `is_cor: true`
   * regardless of this flag (mirrors the legacy dedicated-method-per-type
   * shape — see `ContractsClient`).
   */
  isCor?: boolean;
}

/**
 * Builder-facing subset of `ContractorContractCreateData` — everything a
 * builder can construct offline. `signatoryId`/`templateId` are account-specific
 * and resolved dynamically (`ContractsClient.getSignatory`/`getTemplateId`), so
 * `seeding.ts` merges them in before calling a `create*Contract` client method —
 * builders stay pure data (no HTTP).
 */
export type ContractorContractInput = Omit<ContractorContractCreateData, 'signatoryId' | 'templateId'> & {
  contractorEmail: string;
};

/** A contract signatory (GET /api/contract/signatory/list). */
export interface Signatory {
  id:   number;
  name: string;
}

/** Result of `ContractsClient.inviteContractor` (POST /api/contract/invite). */
export interface InviteContractorResult {
  invitationUrl: string;
}

/** A contract template (GET /api/template/list). */
export interface ContractTemplate {
  id:            number;
  name:          string;
  [key: string]: unknown;
}

/** A custom attribute (GET /api/attributes). */
export interface ContractAttribute {
  id:            number;
  [key: string]: unknown;
}

/** A newly created contract's identifiers, extracted from a create-response body. */
export interface CreatedContract {
  id:  number;
  ref: string;
}

// ─── EOR create-time surface (PR #172) — ported from legacy EorContractAPI/
// EorEmployeeAPI/EorPaymentAPI. `[key: string]: unknown` replaces legacy `any`. ───

/** EOR regional config for a given employee country (GET /api/eor/regional_configs/country/{id}). */
export interface EorRegionalConfig {
  id:                 number;
  region_id?:         number;
  /** Country object — client-side response nests it as "region", admin-side as "country". */
  region?:            { id?: number; name?: string; iso2?: string; iso3?: string };
  country?:           { id?: number; name?: string; iso2?: string; iso3?: string };
  payment_details_form_id?:              number | null;
  employee_details_form_id?:             number | null;
  compensation_benefit_details_form_id?: number | null;
  is_quotation_automation_enabled?: boolean;
  is_salary_payable_in_usd?:        boolean;
  is_healthcare_required?:          boolean;
  min_annual_leave_days?:           number;
  min_annual_salary?:               number;
  [key: string]: unknown;
}

/** An insurance provider plan available for a regional config. */
export interface EorInsuranceProvider {
  id:            number;
  name:          string;
  [key: string]: unknown;
}

/** A company-level custom attribute configured for EOR contracts (GET /api/attributes). */
export interface EorCustomAttribute {
  id:              number;
  name?:           string;
  attribute_type?: { code?: string };
  required?:       boolean;
  options?:        { id: number; name: string }[];
  [key: string]:   unknown;
}

/** One answer for a dynamic EOR regional form field. */
export interface EorFormAnswer {
  form_field_id: number;
  value:         string;
}

/** Payload for `EorClient.createEorContract` (POST /api/contract/fulltime). */
export interface CreateEorContractInput {
  employeeFirstName: string;
  employeeLastName:  string;
  employeeEmail:     string;
  /** country_id for employee_country_id, working_from_country_id, employee_nationality_country_id */
  employeeCountryId: number;
  currencyId:        number;
  includeInsurance:  boolean;
  insuranceProviderId?: number;
  startDate:          string;
  trialPeriodDays?:   number;
  amount?:            string;
  jobTitle?:          string;
  jobDescription?:    string;
  annualLeaveDays?:   number;
  attributes?:        { id: number; value: string }[];
  paymentDetailsAnswers?:              EorFormAnswer[];
  employeeDetailsAnswers?:             EorFormAnswer[];
  compensationBenefitDetailsAnswers?:  EorFormAnswer[];
}

/** A dynamic form field schema entry (regional forms + employee data-collection form). */
export interface DynamicFormField {
  id:            number;
  type:          string;
  title?:        string;
  options?:      unknown[];
  is_required?:  boolean;
}

export interface DynamicFormStep {
  title?:       string;
  name?:        string;
  form_fields?: DynamicFormField[];
}

/** Loose shape covering the two response variants seen for form/data-collection schemas. */
export interface DynamicForm {
  form?:        { form_steps?: DynamicFormStep[]; form_fields?: DynamicFormField[] };
  form_steps?:  DynamicFormStep[];
}

/** Prefill data for the manual EOR quote flow (POST /api/admin/contract/fulltime/quote/prefill). */
export interface EorQuotePrefillData {
  taxes?:                      Record<string, { monthly?: number; yearly?: number }>;
  management_fee?:             { monthly?: number };
  indirect_tax?:               { monthly?: number };
  setup_fee?:                  number;
  markup_percentage?:          number;
  quote_currency_to_usd_rate?: number;
  additional_notes?:           string;
  [key: string]: unknown;
}

/** Admin-side full EOR contract details (GET /api/admin/contract/{id}/details). */
export interface EorContractDetails {
  id:                              number;
  ref?:                            string;
  amount?:                         number | string;
  salary_currency?:                { code?: string };
  currency?:                       { code?: string };
  employee_invitation_url?:        string;
  /** Gates `can_sign` — must be `true` before the client can sign the contract (docs/api-discovery/eor-contract-lifecycle.md). */
  is_company_msa_agreement_signed?: boolean;
  [key: string]: unknown;
}

/** SOW template fetched for an EOR contract (GET .../contract_templates/contract/edit/{id}). */
export interface EorSowTemplate {
  name:     string;
  sections: unknown;
  [key: string]: unknown;
}

export interface EorPartner { id: number; name?: string; [key: string]: unknown; }
export interface EorAdmin { id: number; [key: string]: unknown; }

/** Resolved EOR create-payload + quotation-automation flag (`create-eor-contract.spec.ts`). */
export interface EorTestContext {
  input: CreateEorContractInput;
  /** From `EorRegionalConfig.is_quotation_automation_enabled` — needed by TC_QA209_008/014. */
  isQuotationAutomated: boolean;
}

/** EOR employee profile (POST /api/contractor/update, multipart). */
export interface EorProfileData {
  firstName:      string;
  lastName:       string;
  /** Phone in E.164 format without '+'. */
  phone:          string;
  countryId:      number;
  documentNumber: string;
  city?:          string;
}

// ─── Direct Employee (DE) create-time surface (PR #172) — ported from legacy
// DEEntityAPI/DEContractAPI/DEEmployeeAPI. ───

export interface DeCountry { id: number; name: string; }
export interface DeJurisdiction { id: number; name: string; }

/** Payload for `DeClient.createEntity` (POST /api/direct_employees/entities). */
export interface DeEntityInput {
  name:                 string;
  countryId:            number;
  typeId:               number;
  address:              string;
  city:                 string;
  state:                string;
  zipCode:              string;
  currencyId:           number;
  registrationNo:       string;
  nbEmployees:          number;
  jurisdictionId:       number;
  paydayOccurrenceId:   number;
  vat?:                 string;
  poNumber?:            string;
  molEstablishmentId?:  string;
  taxNumber?:           string;
  dunsNumber?:          string;
}

/** A DE entity as returned by GET /api/direct_employees/entities. */
export interface DeEntity {
  id:              number;
  currency_id?:    number;
  currency?:       { code?: string };
  [key: string]:   unknown;
}

/** Result of `DeClient.createEntity` — the fields callers actually need. */
export interface CreatedDeEntity {
  id:           number;
  currencyId:   number;
  currencyCode: string;
}

/** Payload for `DeClient.createDEContract` (POST /api/direct_employees/contracts). */
export interface DeContractInput {
  entity:              DeEntity;
  jurisdictionId:      number;
  currencyId:          number;
  employeeIdentifier:  string;
  contractFilePath:    string;
  firstPayrollMonth:   string;
  startDate:           string;
  jobTitle:            string;
  /** Monthly gross salary amount string. Defaults to '5000' if omitted. */
  amount?:             string;
}

/** DE employee onboarding-wizard payload (POST /api/contractor/update, multipart). */
export interface DeOnboardingData {
  firstName: string;
  lastName:  string;
  email:     string;
  countryId: number;
  phone:     string;
  password:  string;
}

/** DE employee full-profile payload (POST /api/contractor/update, multipart). */
export interface DeProfileData {
  firstName:      string;
  lastName:       string;
  phone:          string;
  countryId:      number;
  molIdCardPath:  string;
  /** MOL ID number — 14 digits, must start with 1 (UAE WPS format). */
  molId:          string;
  documentNumber: string;
}

/**
 * Resolved DE create-time context: a seeded entity + the derived fields a create
 * payload needs (full entity record, first payroll month, uploaded contract PDF
 * path). Mirrors `EorTestContext` (`create-eor-contract.spec.ts`). Shaped like
 * `seeding.ts`'s `SeededDeEntity` (`CreatedDeEntity` + jurisdiction/country ids)
 * without importing it directly — avoids a types.ts -> seeding.ts dependency.
 */
export interface DeTestContext {
  entity:            CreatedDeEntity & { jurisdictionId: number; countryId: number };
  rawEntity:         DeEntity;
  firstPayrollMonth: string;
  contractFilePath:  string;
}

// ─── COR (Contractor-of-Record) lightweight deposit-payment surface (Phase 5)
// — ported (shape) from legacy ContractsAPI.getContractPayments/getPaymentCycles.
// Both responses are loosely typed on the real API (the Scribe doc's GET-with-
// JSON-body example does not enumerate every field the sandbox actually
// returns) — `[key: string]: unknown` replaces legacy `any`. ───

/** One work item on a contract payment — `payment_item_id` is what `approvePayments`/`createTransfer` operate on, NOT `payment.id`. */
export interface PaymentWork {
  payment_item_id?: number;
  [key: string]: unknown;
}

/** A contract payment (GET /api/contract/{contractId}/payments). */
export interface ContractPayment {
  id:            number;
  works?:        PaymentWork[];
  [key: string]: unknown;
}

/**
 * Cycle validity for one payment (GET /api/payment/cycles). `quote_id` is an
 * undocumented/config-dependent field observed on some sandbox responses but
 * absent from the Scribe example — treated as optional, matching the legacy
 * client's defensive `?.quote_id` read (TC_COR_012).
 */
export interface PaymentCycleValidity {
  payment_id?:   number;
  cycle?:        { is_valid?: boolean };
  quote_id?:     number;
  [key: string]: unknown;
}
