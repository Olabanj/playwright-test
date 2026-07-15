export const ENDPOINTS = {
  auth: {
    login:  '/api/login',
    logout: '/api/logout',
  },
  contracts: {
    list:           '/api/contract/list',   // contractor's contracts with numeric ids
    currencies:     '/api/static/currencies',
    details:        (ref: string) => `/api/contract/${ref}/details`,
    fulltimeUpdate: (id: number) => `/api/contract/fulltime/${id}`,   // PATCH (EOR edit)
    amendmentAdd:   '/api/contract/amendment/add',                    // POST (EOR amendment)
    signature:      '/api/contract/signature',                        // POST (client sign / contractor sign)
    // Contract creation lifecycle (PR #172) — confirmed via rp-scribe (G6) 2026-07-08
    // and cross-checked against legacy ContractsAPI/AdminAPI method bodies.
    signatoryList:  '/api/contract/signatory/list',                   // GET
    templateList:   '/api/template/list',                             // GET
    attributes:     '/api/attributes',                                // GET
    fixedCreate:    '/api/contract/fixed/create',                     // POST
    paygCreate:     '/api/contract/payg/create',                      // POST
    milestoneCreate: '/api/contract/milestone/create',                // POST
    update:         '/api/contract/update',                           // POST (payroll-approval toggle, generic update)
    cancel:         (id: number) => `/api/contract/${id}/cancel`,     // POST
    invite:         '/api/contract/invite',                           // POST
    corSowSign:              '/api/contract/cor/sow/sign',            // POST
    corPaymentCycles:        '/api/payment/cycles',                   // GET
    contractPayments: (contractId: number) => `/api/contract/${contractId}/payments`, // GET
    paymentsApprove:  '/api/payment/approve',                          // POST
    transferCreate:   '/api/transaction/transfer/create',              // POST
  },
  registration: {
    // Client sign-up flow (API mirror of the UI wizard). Confirmed from legacy
    // ClientRegistrationAPI + rp-scribe; verify() returns the client auth token,
    // companyUpdate returns the new company id.
    signup:        '/api/client/signup',
    verify:        '/api/client/verify',
    clientUpdate:  '/api/client/update',
    companyUpdate: '/api/company/update',
  },
  admin: {
    // Admin test-login + KYB/2FA gates + EOR provider-sign.
    loginTest:      (key: string) => `/api/admin/login/test/${key}`,
    kybApprove:     '/api/admin/company/kyb/approve',
    disable2fa:     '/api/admin/users/2fa/disable',
    signAsProvider: (id: number) => `/api/admin/contract/fulltime/${id}/sign_as_provider`,
    // Contract creation lifecycle (PR #172) — additive AdminClient extension,
    // confirmed via rp-scribe (G6) 2026-07-08 + legacy AdminAPI cross-check.
    kycVerify:       '/api/admin/contractor/verify/kyc',   // POST { user_id }
    companyUpdate:   '/api/admin/company/update',          // POST (is_cor_enabled / is_direct_employee_enabled / is_global_payroll_enabled)
    companyApprove:  '/api/admin/company/approve',         // POST { company_id, approved: 1 }
    transactionConfirm: '/api/admin/transaction/confirm',  // POST
    corAdminContractList: '/api/admin/contract/adminlist', // POST
    corAdminSowSign:      '/api/admin/cor/sow/sign',       // POST
    corAdminContractSign: '/api/admin/cor/contract/sign',  // POST
    jurisdictions:        '/api/admin/jurisdictions',      // GET /:id, POST (DE external-payroll toggle)
  },
  timeTracking: {
    // Time Tracking microservice — separate AWS host (env.timeTrackingApiUrl).
    // Path prefix: /timetracking/api/v1/*  (confirmed from legacy TIME_TRACKING_ENDPOINTS).
    health:             '/timetracking/api/v1/server/healthy',
    policies:           '/timetracking/api/v1/policies',
    policyById:         (id: number) => `/timetracking/api/v1/policies/${id}`,
    policyTitleCheck:   '/timetracking/api/v1/policies/titles/availability:check',
    policyWorkers:    (id: number) => `/timetracking/api/v1/policies/${id}/workers`,
    policyByContract: (contractId: number) => `/timetracking/api/v1/policies/contracts/${contractId}`,
    contracts:        '/timetracking/api/v1/contracts',
    // Session endpoints — confirmed from legacy TIME_TRACKING_ENDPOINTS (Batch 6a).
    timeSessions:            '/timetracking/api/v1/time-sessions',
    timeSessionById:         (id: number) => `/timetracking/api/v1/time-sessions/${id}`,
    timeSessionPause:        (id: number) => `/timetracking/api/v1/time-sessions/${id}/pause`,
    timeSessionResume:       (id: number) => `/timetracking/api/v1/time-sessions/${id}/resume`,
    timeSessionEnd:          (id: number) => `/timetracking/api/v1/time-sessions/${id}/end`,
    activeSessionByContract: (contractId: number) => `/timetracking/api/v1/time-sessions/contracts/${contractId}/active`,
  },
  expenses: {
    // Confirmed via rp-scribe (G6) 2026-06-16.
    categories:     (contractId: number) => `/api/contract/${contractId}/expense/categories`,
    currencies:     '/api/static/currencies',
    upload:         '/api/contract/expense/upload',   // multipart, field 'photo'
    add:            '/api/contract/expense/add',
    approve:        '/api/contract/expense/approve',
    delete:         '/api/contract/expense/delete',
    listContractor: '/api/contract/expense/list/contractor',
  },
  // EOR create-time surface (PR #172, contracts EOR/DE foundation) — confirmed via
  // rp-scribe (G6) 2026-07-08 (groups: "full-time-contract", "eor-regional-configs",
  // "other-endpoints") and cross-checked against legacy EorContractAPI/EorEmployeeAPI/
  // EorPaymentAPI method bodies.
  contractsEor: {
    regionalConfigByCountry: (countryId: number) => `/api/eor/regional_configs/country/${countryId}`,
    insuranceProviders:      '/api/insurance_providers',      // GET ?eor_regional_config_id=
    formById:                (formId: number) => `/api/forms/${formId}`,
    create:                  '/api/contract/fulltime',        // POST — creates the EOR contract
    employeeDataCollections: '/api/contract/fulltime/employee_data_collections', // GET/PUT
  },
  // Admin-EOR surface — lives on features/contracts/admin-eor-client.ts (AdminEorClient
  // extends AdminClient), NOT the shared AdminClient — see
  // docs/30-decisions/2026-07-08-dmytro-admin-eor-client-placement.md.
  adminEor: {
    contractDetails: (contractId: number) => `/api/admin/contract/${contractId}/details`,
    admins:          '/api/admin/admins',                     // GET ?roles[]=EOR+Admin&roles[]=EOR+Super+Admin
    signAsProvider:  (contractId: number) => `/api/admin/contract/fulltime/${contractId}/sign_as_provider`,
    employeeInvite:  (contractId: number) => `/api/admin/contract/fulltime/${contractId}/employee/invite`,
    quotePrefill:    '/api/admin/contract/fulltime/quote/prefill',
    quoteUpdate:     '/api/admin/contract/fulltime/quote/update',
    sowTemplate:     (contractId: number) => `/api/admin/contract_templates/contract/edit/${contractId}`,
    sowUpdate:       '/api/admin/contract_templates/contract/update',
    partnerList:     '/api/admin/contract/fulltime/partner/list',
    partnerAssign:   '/api/admin/contract/fulltime/partner/assign',
    clientInvite:    '/api/admin/contract/fulltime/client/invite',
  },
  // Direct Employee (DE) entity + contract create-time surface — confirmed via
  // rp-scribe (G6) 2026-07-08 (groups "other-endpoints", "entity-payroll-cycle",
  // "payroll", "direct-employee-contract") + legacy DEEntityAPI/DEContractAPI cross-check.
  directEmployees: {
    entities:           '/api/direct_employees/entities',
    entityById:         (entityId: number) => `/api/direct_employees/entities/${entityId}`,
    entityPayrollCycle: (entityId: number) => `/api/direct_employees/entities/${entityId}/payroll_cycles/current`,
    payrollCycleList:   '/api/direct_employees/payroll_cycle/list',
    contracts:          '/api/direct_employees/contracts',
    countries:          '/api/direct_employees/countries',
    jurisdictions:      (countryId: number) => `/api/direct_employees/jurisdictions/country/${countryId}`,
  },
  // Generic contract-side endpoints reused by the DE contract-create surface (upload,
  // employee-identifier validation, invitation-token exchange). Kept distinct from
  // `contracts.*` (fixed/payg/milestone) — same shared REST resource, different lifecycle.
  contractShared: {
    upload:             '/api/contract/upload',                     // POST multipart — generic contract PDF upload
    employeeIdValidate: '/api/contract/employee_identifier/validate',
    invitation:         '/api/contract/invitation',                 // GET ?token&contract_id — invite exchange
  },
  // Reused by EOR/DE employee onboarding clients — generic contractor-profile /
  // storage / banking endpoints, not EOR/DE-specific. `signup`/`verify` back the
  // contractor self-registration Flow B (Phase 4 — worker-registration-client.ts),
  // confirmed via rp-scribe (G6) 2026-07-08 (anchors
  // other-endpoints-POSTapi-contractor-{signup,verify}).
  contractor: {
    signup: '/api/contractor/signup', // POST — contractor self-registration, sends OTP
    verify: '/api/contractor/verify', // POST — OTP verify, returns contractor JWT
    update: '/api/contractor/update', // POST multipart — profile completion (EOR/DE/generic contractor)
  },
  storage: {
    tempFileUpload: '/api/storage/temp_files/upload', // POST multipart
  },
  accounts: {
    bankCreate: '/api/accounts/bank/create', // POST
  },
} as const;
