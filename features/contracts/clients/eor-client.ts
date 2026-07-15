import * as fs from 'fs';
import { BaseApiClient } from '@core/http/BaseApiClient';
import { assertOk } from '@core/http/assertOk';
import { ENDPOINTS } from '@core/config/endpoints';
import { ApiResponse } from '@core/types/api.types';
import { logVerbose } from '@utils/helpers/logger';
import {
  ContractMutationResponse,
  CreateEorContractInput,
  DynamicForm,
  DynamicFormField,
  DynamicFormStep,
  EorCustomAttribute,
  EorFormAnswer,
  EorInsuranceProvider,
  EorRegionalConfig,
  UpdateContractResponse,
} from '../types';

interface DataWrapper<T> { data?: T; }
interface ListDataWrapper<T> { data?: T[]; }
interface MutationResponse { success?: boolean; message?: string; data?: Record<string, unknown>; }
interface UploadResponse { success?: boolean; data?: { path?: string }; }
interface DataCollectionResponse { success?: boolean; data?: DynamicForm; }

/**
 * Normalise the two response variants seen for the data-collection form schema
 * (nested `form.form_steps`, root-level `form_steps`, or a flat `form.form_fields`
 * list wrapped as a single synthetic step) into one steps array. `null`/no steps
 * → `[]` (no I/O — pure helper, exempt from logVerbose).
 */
function resolveFormSteps(form: DynamicForm | null): DynamicFormStep[] {
  if (form?.form?.form_steps?.length) return form.form.form_steps;
  if (form?.form_steps?.length) return form.form_steps;
  if (form?.form?.form_fields?.length) return [{ form_fields: form.form.form_fields }];
  return [];
}

/**
 * Single unified client for the EOR backend boundary (`contractsEor.*` +
 * `contracts.fulltimeUpdate` + `contracts.amendmentAdd`): the create-time surface
 * (regional config, insurance providers, custom attributes, regional forms,
 * contract creation), the salary-currency edit + amendment surface, and the
 * employee data-collection form surface.
 *
 * Unified in the 2026-07-09 client boundary re-audit — previously the
 * salary-currency methods lived on `ContractsClient` and the data-collection
 * methods on `EorEmployeeClient` under a "no churn on approved code" note; that
 * split crossed the EOR boundary, so all three surfaces now live here (one
 * client per backend boundary). Legacy split `EorContractAPI`/`EORAPI`/
 * `EorFormAPI`/`EorEmployeeAPI` all mapped to this one boundary.
 *
 * The create-time form helpers (`buildAnswersForForm`/`defaultValueForField`/
 * `pickOptionValue`) and the data-collection form helpers
 * (`dataCollectionValueForField`/`pickDataCollectionOptionValue`) are kept
 * DISTINCT on purpose: they fill fields with different defaults for two
 * different EOR forms, so merging them would change payloads.
 *
 * One method = one HTTP request, except `buildRegionalFormAnswers` /
 * `completeDataCollectionForm`, which compose several read calls to build/submit
 * a single derived payload (no cross-boundary mutation).
 *
 * The salary-currency + create surfaces run as the client/company; the
 * data-collection surface runs as the EOR employee — the caller inits the client
 * with the matching token (see `seeding.ts`'s `signEorToOngoing`).
 */
export class EorClient extends BaseApiClient {
  /**
   * EOR regional config for an employee country (GET /api/eor/regional_configs/country/{id}).
   * Convention B, self-skip sentinel: returns `null` when the sandbox has no regional
   * config configured for this country — a genuine, documented absent-precondition
   * state, not an error. Callers (seeding/specs) should self-skip on `null`.
   */
  async getRegionalConfig(countryId: number): Promise<EorRegionalConfig | null> {
    logVerbose(`[EorClient] getRegionalConfig countryId=${countryId}`);
    const res = await this.get<DataWrapper<EorRegionalConfig>>(
      ENDPOINTS.contractsEor.regionalConfigByCountry(countryId),
    );
    return res.body.data ?? null;
  }

  /** Insurance providers for a regional config. Convention B — valid-empty (no providers = use insuranceId 0). */
  async getInsuranceProviders(eorRegionalConfigId: number): Promise<EorInsuranceProvider[]> {
    const res = await this.get<ListDataWrapper<EorInsuranceProvider> | EorInsuranceProvider[]>(
      ENDPOINTS.contractsEor.insuranceProviders,
      { eor_regional_config_id: eorRegionalConfigId },
    );
    const body = res.body;
    const list = Array.isArray(body) ? body : body.data ?? [];
    return Array.isArray(list) ? list : [];
  }

  /**
   * Company-level custom attributes for EOR contracts (GET /api/attributes,
   * area=contract&contract_type=eor). Convention B — valid-empty (most companies
   * have none configured).
   */
  async getCustomAttributes(): Promise<EorCustomAttribute[]> {
    const res = await this.get<ListDataWrapper<EorCustomAttribute> | EorCustomAttribute[]>(
      ENDPOINTS.contracts.attributes,
      { area: 'contract', contract_type: 'eor', active: 1 },
    );
    const body = res.body;
    const list = Array.isArray(body) ? body : body.data ?? [];
    return Array.isArray(list) ? list : [];
  }

  /**
   * Fetch and build all three regional form answer arrays from a regional config.
   * Countries without forms have null/absent form ids — returns an empty array for
   * those slots, which `createEorContract`'s caller then omits from the payload.
   * Convention B/helper — composes up to 3 GETs, no mutation, no assertOk (a missing
   * form is a valid state, not a failure).
   */
  async buildRegionalFormAnswers(regionalConfig: EorRegionalConfig): Promise<{
    paymentDetailsAnswers: EorFormAnswer[];
    employeeDetailsAnswers: EorFormAnswer[];
    compensationBenefitDetailsAnswers: EorFormAnswer[];
  }> {
    logVerbose('[EorClient] buildRegionalFormAnswers');
    // regionalConfig uses "region" client-side, "country" admin-side — either supplies the id.
    const countryId = regionalConfig.region?.id ?? regionalConfig.country?.id ?? 0;
    const [paymentDetailsAnswers, employeeDetailsAnswers, compensationBenefitDetailsAnswers] = await Promise.all([
      this.buildAnswersForForm(regionalConfig.payment_details_form_id, countryId),
      this.buildAnswersForForm(regionalConfig.employee_details_form_id, countryId),
      this.buildAnswersForForm(regionalConfig.compensation_benefit_details_form_id, countryId),
    ]);
    return { paymentDetailsAnswers, employeeDetailsAnswers, compensationBenefitDetailsAnswers };
  }

  private async buildAnswersForForm(
    formId: number | null | undefined,
    countryId: number,
  ): Promise<EorFormAnswer[]> {
    if (!formId) return [];
    const res = await this.get<DataWrapper<DynamicForm> & DynamicForm>(ENDPOINTS.contractsEor.formById(formId));
    const form = res.body.data ?? res.body;
    const steps = form.form?.form_steps ?? form.form_steps ?? [];
    const answers: EorFormAnswer[] = [];
    for (const step of steps) {
      for (const field of step.form_fields ?? []) {
        answers.push({ form_field_id: field.id, value: this.defaultValueForField(field, countryId) });
      }
    }
    return answers;
  }

  private defaultValueForField(field: DynamicFormField, countryId: number): string {
    switch (field.type) {
      case 'date_input':
      case 'date_picker':
        return '1990-01-01';
      case 'number_input':
        return '12345';
      case 'country_dropdown':
        return String(countryId);
      case 'select':
      case 'radio':
      case 'dropdown':
      case 'checkbox':
        return this.pickOptionValue(field.options?.[0]);
      default:
        return 'QA Automation';
    }
  }

  /** Extract a scalar string from an option item regardless of its shape (string, {value}, {name}, {id}). */
  private pickOptionValue(option: unknown): string {
    if (option == null) return 'QA Automation';
    if (typeof option === 'string' || typeof option === 'number') return String(option);
    if (typeof option === 'object') {
      const o = option as Record<string, unknown>;
      for (const key of ['value', 'name', 'label', 'id'] as const) {
        const v = o[key];
        if (typeof v === 'string' || typeof v === 'number') return String(v);
      }
    }
    return 'QA Automation';
  }

  /**
   * Create an EOR contract (POST /api/contract/fulltime). Worker details are
   * embedded in the payload — no separate invite step. Ported insurance-fallback:
   * some countries reject the chosen `insurance_provider_id` with
   * "Insurance provider is not supported" — on that specific rejection, retries
   * once with insurance disabled (`insurance: 0`, no `insurance_provider_id`) and
   * returns the retry's response.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createEorContract(input: CreateEorContractInput): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(
      `[EorClient] createEorContract email=${input.employeeEmail} country=${input.employeeCountryId} insurance=${input.includeInsurance}`,
    );
    const res = await this.post<ContractMutationResponse>(
      ENDPOINTS.contractsEor.create,
      this.buildCreatePayload(input),
    );
    if (input.includeInsurance && this.isInsuranceRejected(res)) {
      logVerbose('[EorClient] createEorContract: insurance provider rejected — retrying without insurance');
      const fallback: CreateEorContractInput = { ...input, includeInsurance: false, insuranceProviderId: 0 };
      return this.post<ContractMutationResponse>(ENDPOINTS.contractsEor.create, this.buildCreatePayload(fallback));
    }
    return res;
  }

  private isInsuranceRejected(res: ApiResponse<ContractMutationResponse>): boolean {
    if (res.body.success !== false) return false;
    const text = JSON.stringify(res.body).toLowerCase();
    return text.includes('insurance provider is not supported');
  }

  private buildCreatePayload(input: CreateEorContractInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      start_date:                     input.startDate,
      first_payment_prorata:          false,
      insurance:                      input.includeInsurance ? 1 : 0,
      // Only send insurance_provider_id when insurance is enabled — sending 0 when
      // disabled triggers a validation error on some countries (e.g. Turkey).
      ...(input.includeInsurance ? { insurance_provider_id: input.insuranceProviderId ?? 0 } : {}),
      work_visa:                      0,
      trial_period:                   input.trialPeriodDays ?? 30,
      is_bonus_clause_enabled:        false,
      is_annual_plane_ticket_enabled: false,
      is_overtime_enabled:            false,
      employee_country_id:            input.employeeCountryId,
      amount:                         input.amount ?? '5000',
      currency_id:                    input.currencyId,
      working_from_country_id:        input.employeeCountryId,
      employee_first_name:            input.employeeFirstName,
      employee_last_name:             input.employeeLastName,
      employee_email:                 input.employeeEmail,
      employee_nationality_country_id: input.employeeCountryId,
      employment_term:                'Indefinite',
      employment_type:                'Full-time',
      qualification:                  'Employee',
      job_title:                      input.jobTitle ?? 'Software Engineer',
      job_description:                input.jobDescription ?? '<p>Software engineering and development services.</p>',
      annual_leave_days:              input.annualLeaveDays ?? 21,
      allowances:                     [],
      custom_allowances:              [],
      // kyc: true — signals the client accepts KYC verification at contract creation.
      // Required by the API; omitting it causes a validation error.
      kyc:                            true,
      // extra: 'extra' — opaque required field accepted by the API (server-side purpose
      // unknown, present in all observed successful creation requests). Do not remove.
      extra:                          'extra',
      attributes:                     input.attributes ?? [],
    };
    if (input.paymentDetailsAnswers?.length) payload.payment_details_answers = input.paymentDetailsAnswers;
    if (input.employeeDetailsAnswers?.length) payload.employee_details_answers = input.employeeDetailsAnswers;
    if (input.compensationBenefitDetailsAnswers?.length) {
      payload.compensation_benefit_details_answers = input.compensationBenefitDetailsAnswers;
    }
    return payload;
  }

  // ─── EOR salary-currency edit + amendment (moved from ContractsClient in the
  // 2026-07-09 boundary re-audit — `contracts.fulltimeUpdate` / `amendmentAdd`
  // are EOR-specific, not the generic contract surface). ───

  /**
   * Edit flow — change only the salary currency (PATCH /api/contract/fulltime/{id}).
   * Returns the effective response payload (data ?? body) so callers can assert on it
   * (e.g. absence of `webhook_dispatched` for a non-material currency-only edit).
   */
  async updateSalaryCurrency(contractId: number, currencyId: number): Promise<Record<string, unknown>> {
    logVerbose(`[EorClient] updateSalaryCurrency contractId=${contractId} currencyId=${currencyId}`);
    const res = await this.patch<UpdateContractResponse>(
      ENDPOINTS.contracts.fulltimeUpdate(contractId),
      { currency_id: currencyId },
    );
    assertOk(res, 'updateSalaryCurrency');
    return (res.body?.data ?? res.body ?? {}) as Record<string, unknown>;
  }

  /**
   * Amendment flow — raise a currency-change amendment on an Ongoing EOR contract
   * (POST /api/contract/amendment/add). Returns the raw response so the caller can
   * assert on status + success + message.
   */
  // convention C — raw ApiResponse; caller/test asserts; no assertOk.
  async createCurrencyAmendment(
    contractId: number,
    currencyId: number,
    amount?: number,
  ): Promise<ApiResponse<ContractMutationResponse>> {
    logVerbose(`[EorClient] createCurrencyAmendment contractId=${contractId} currencyId=${currencyId}`);
    return this.post<ContractMutationResponse>(ENDPOINTS.contracts.amendmentAdd, {
      contract_id: contractId,
      currency_id: currencyId,
      ...(amount !== undefined && { amount }),
    });
  }

  // ─── EOR employee data-collection form (moved from EorEmployeeClient in the
  // 2026-07-09 boundary re-audit — `contractsEor.employeeDataCollections` +
  // `storage.tempFileUpload` for form-field files). Runs as the EOR employee;
  // the caller inits this client with the employee token. ───

  /**
   * Data-collection form schema for the employee's EOR contract. Convention B —
   * a 404 means "no form is configured for this country", a valid state (not
   * every country has one); returns `null` in that case rather than throwing.
   */
  async getDataCollectionForm(): Promise<DynamicForm | null> {
    logVerbose('[EorClient] getDataCollectionForm');
    const res = await this.get<DataCollectionResponse>(ENDPOINTS.contractsEor.employeeDataCollections);
    if (res.status === 404) return null;
    return res.body.data ?? null;
  }

  /** Upload a file to temp storage for use as a data-collection form field value. Returns the stored path. */
  async uploadTempFile(filePath: string): Promise<string> {
    logVerbose(`[EorClient] uploadTempFile ${filePath}`);
    const res = await this.postMultipart<UploadResponse>(ENDPOINTS.storage.tempFileUpload, {
      file: {
        name:     filePath.split('/').pop() ?? 'upload.pdf',
        mimeType: 'application/pdf',
        buffer:   fs.readFileSync(filePath),
      },
      type: 'form_uploads',
    });
    assertOk(res, 'uploadTempFile');
    const path = res.body.data?.path;
    if (!path) {
      throw new Error(`uploadTempFile: no path in response (${res.status}): ${JSON.stringify(res.body)}`);
    }
    return path;
  }

  /** Submit the completed data-collection form. */
  async submitDataCollectionForm(formInputs: EorFormAnswer[]): Promise<void> {
    logVerbose(`[EorClient] submitDataCollectionForm fields=${formInputs.length}`);
    const res = await this.put<MutationResponse>(ENDPOINTS.contractsEor.employeeDataCollections, {
      form_inputs: formInputs,
      is_data_accuracy_consent_accepted: true,
    });
    assertOk(res, 'submitDataCollectionForm');
  }

  /**
   * Fetch the data-collection form (if any), auto-fill every field by type, and
   * submit. Returns `false` (without submitting) when the contract's country has
   * no data-collection form configured — a valid, non-error outcome.
   */
  async completeDataCollectionForm(employeeName: string, dummyFilePath: string, countryId = 231): Promise<boolean> {
    logVerbose('[EorClient] completeDataCollectionForm');
    const form = await this.getDataCollectionForm();
    const steps = resolveFormSteps(form);

    if (!steps.length) {
      logVerbose('[EorClient] completeDataCollectionForm: no steps found — skipping submission');
      return false;
    }

    const formInputs: EorFormAnswer[] = [];
    for (const step of steps) {
      for (const field of step.form_fields ?? []) {
        const answer = await this.resolveFieldAnswer(field, employeeName, dummyFilePath, countryId);
        if (answer) formInputs.push(answer);
      }
    }
    await this.submitDataCollectionForm(formInputs);
    return true;
  }

  /**
   * One field's answer — uploads the dummy file for `file_upload` fields (always
   * included), else derives a default value by type. Returns `null` for an
   * optional field with no resolvable value (submitting `''` errors server-side).
   */
  private async resolveFieldAnswer(
    field: DynamicFormField,
    employeeName: string,
    dummyFilePath: string,
    countryId: number,
  ): Promise<EorFormAnswer | null> {
    if (field.type === 'file_upload') {
      const path = await this.uploadTempFile(dummyFilePath);
      return { form_field_id: field.id, value: path };
    }
    const value = this.dataCollectionValueForField(field, employeeName, countryId);
    if (!field.is_required && value === '') return null;
    return { form_field_id: field.id, value };
  }

  /**
   * Default value for a data-collection form field, by type. Distinct from the
   * create-time `defaultValueForField` (different defaults — employee-name text,
   * empty-option fallbacks) so the two EOR forms keep their exact payloads.
   */
  private dataCollectionValueForField(field: DynamicFormField, employeeName: string, countryId: number): string {
    switch (field.type) {
      case 'short_text_input':
      case 'long_text_input':
        return employeeName;
      case 'date_input':
      case 'date_picker':
        return '1990-01-01';
      case 'number_input':
        return '12345';
      case 'select':
      case 'radio':
      case 'dropdown': {
        const picked = this.pickDataCollectionOptionValue(field.options?.[0]);
        return picked !== '' ? picked : employeeName;
      }
      // Country dropdowns load countries dynamically — no options in the schema.
      case 'country_dropdown':
        return String(countryId);
      case 'checkbox':
        return this.pickDataCollectionOptionValue(field.options?.[0]) || 'true';
      default:
        return employeeName;
    }
  }

  /** Extract a scalar string from a data-collection option item, `''` when none (create-time uses a different default). */
  private pickDataCollectionOptionValue(option: unknown): string {
    if (option == null) return '';
    if (typeof option === 'string' || typeof option === 'number') return String(option);
    if (typeof option === 'object') {
      const o = option as Record<string, unknown>;
      for (const key of ['value', 'name', 'label', 'id'] as const) {
        const v = o[key];
        if (typeof v === 'string' || typeof v === 'number') return String(v);
      }
    }
    return '';
  }
}
