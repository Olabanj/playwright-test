# Equipment E2E — Endpoints

> Discovered 2026-07-09 via Chrome DevTools network capture on sandbox.
> Contract detail → Equipment tab → Add Equipment / edit / list / return / delete / contractor acknowledgement flow.
> Captured on contracts `21026` (client add + edit + list flow) and `20985` (contractor list + sign flow).
> Updated 2026-07-09: edit/agreement payloads with `price`; list response shape captured.

**Base URL**: `https://sandbox-api.remotepass.com` (set via `API_BASE_URL` env var)

**Auth**: `Authorization: Bearer {token}` on all endpoints below.

**Content-Type**: `application/json` on requests (except `agreement` response — see below).

**HTTP status**: Always `200`. Check `success: true` in the response body to confirm success (JSON endpoints).

**Optional header**: `x-locale: en` (sent by the front-office UI; not required for API automation).

---

## Endpoint Summary

| Endpoint | Method | Actor | Fires When | Status |
|----------|--------|-------|-----------|--------|
| `/api/contract/equipment/agreement/edit` | POST | Client | Add/edit wizard — preview or save agreement template | ✅ Captured |
| `/api/contract/equipment/agreement` | POST | Client | Add/edit wizard — render agreement PDF/HTML | ✅ Captured |
| `/api/contract/equipment/add` | POST | Client | Final create + client signature | ✅ Captured |
| `/api/contract/equipment/list` | POST | Client / Contractor | Equipment tab — paginated list (filter by `contract_id`) | ✅ Captured |
| `/api/contract/equipment/delete` | POST | Client | Remove equipment item | ✅ Captured |
| `/api/contract/equipment/return` | POST | Client | Mark equipment as returned | ✅ Captured |
| `/api/contract/equipment/signature` | POST | Contractor | Contractor acknowledges assigned equipment | ✅ Captured |

---

## Equipment Lifecycle Overview

All list/mutation endpoints use **POST** with a JSON body (no `GET` list endpoint observed).

### Client — add, edit & assign (contract-scoped)

Assignment is implicit: every create/edit payload includes `contract_id`. There is no separate
"assign" endpoint in the captured flow.

```
1. Agreement edit  → POST /api/contract/equipment/agreement/edit   (JSON — template preview)
2. Agreement       → POST /api/contract/equipment/agreement        (HTML — rendered agreement)
3. Add + sign      → POST /api/contract/equipment/add              (adds signature_name)
4. List / filter   → POST /api/contract/equipment/list               (page + contract_id)
```

**Edit existing equipment** reuses steps 1–2 (`agreement/edit` → `agreement`) with updated
`serial_number`, `price`, `description`, `type`, etc. — same endpoint as the add wizard.

### Contractor — acknowledge

```
1. List            → POST /api/contract/equipment/list
2. Sign/ack        → POST /api/contract/equipment/signature
```

### Client — post-assignment actions

```
Return             → POST /api/contract/equipment/return
Delete             → POST /api/contract/equipment/delete
```

---

## Shared Request Fields (create / edit / agreement steps)

Used by `agreement/edit`, `agreement`, and `add`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `serial_number` | string | ✅ | Equipment serial / asset tag (e.g. `"35656563563"`) |
| `description` | string | ✅ | Model / free-text description (e.g. `"testing the roloe"`) |
| `type` | string | ✅ | Equipment type label — **string name**, not a numeric ID (e.g. `"Computer"`, `"Phone"`) |
| `contract_id` | number | ✅ | Numeric contract ID (e.g. `21026`) |
| `currency_id` | number | ✅ | Currency ID for equipment valuation (e.g. `14` = DZD) |
| `price` | number | ✅ on edit flow | Equipment value in the selected currency (e.g. `5000`) |
| `signature_name` | string | ✅ on `add` only | Client signatory full name — **not** sent on agreement steps |

---

## Client Endpoints

### Edit equipment agreement (preview / edit details)

- **Method**: `POST`
- **URL**: `/api/contract/equipment/agreement/edit`
- **Auth**: `Bearer {client_token}`
- **Request body** (✅ Captured 2026-07-09, contract `21026` — edit flow):

```json
{
  "serial_number": "35656563563",
  "price": 5000,
  "description": "testing the roloe",
  "type": "Computer",
  "contract_id": 21026,
  "currency_id": 14
}
```

- **Response** (200, JSON — ✅ Captured 2026-07-09):

```json
{
  "success": true,
  "data": {
    "part1": "<h1 style=\"text-align: center; font-size: 18px\">EQUIPMENT USE AGREEMENT</h1>\n\n<br><br>\n{contractor_name} working as a contractor for {company_name} has been issued a {type} with the following specification:\n<br><br>\nEquipment Type: {type}<br>\nS/N: {serial_number}<br>\nValue: {currency_code}{price}<br>\nModel: {description}<br><br>",
    "part2": "The {type} has been issued to the said contractor with the below mentioned understanding:\n<ul>\n<li>The equipment issued is for solely official purpose</li>\n<li>The contractor shall be fully accountable for theft, loss or damage of the property</li>\n<li>This declaration of undertaking has to be signed before taking possession of the equipment.</li>\n<li>Management is at the sole discretion on approving such requests</li>\n<li>Contractors may not take the equipment for repair to any external agency or vendor at any point without the prior written approval of the Company</li>\n<li>The equipment should be returned to the Company in case the contractor agreement is terminated or if they do not intend to use it for any reason</li>\n<li>The contractor shall be liable to replace or pay an equivalent amount to the Company in case of theft, loss or damage to the property. </li>\n<li>The Company retains the right to deduct the same from the contractor fees in case of such event.</li>\n</ul>",
    "part3": "I, {contractor_name} have read and understood the above terms and conditions and declare to abide by them.\n"
  },
  "message": "Template retrieved successfully."
}
```

- **Notes**:
  - Returns HTML fragments in `part1` / `part2` / `part3` for the agreement preview.
  - Used for both **add** and **edit details** flows in the UI.
  - `price` is required on the edit flow (observed in DevTools); initial add capture omitted it but edit flow includes it.

---

### Submit equipment agreement (render HTML)

- **Method**: `POST`
- **URL**: `/api/contract/equipment/agreement`
- **Auth**: `Bearer {client_token}`
- **Request body** (✅ Captured 2026-07-09, contract `21026` — edit flow):

```json
{
  "serial_number": "35656563563",
  "price": 5000,
  "description": "testing the roloe",
  "type": "Computer",
  "contract_id": 21026,
  "currency_id": 14
}
```

- **Response** (200 — ✅ Captured 2026-07-09):
  - **Content-Type**: `text/html` (not JSON)
  - Full rendered **EQUIPMENT USE AGREEMENT** HTML document including client + contractor signature blocks.
  - Interpolates: contractor name, company name, equipment type, serial number, value (`DZD5000`), model/description.

- **Notes**:
  - Identical request payload to `agreement/edit`.
  - UI uses this to display the printable/signable agreement before the final `add` call.
  - Automation can skip this call if only seeding via API (no PDF assertion needed).

---

### Add equipment (client signature)

- **Method**: `POST`
- **URL**: `/api/contract/equipment/add`
- **Auth**: `Bearer {client_token}`
- **Request body** (✅ Captured 2026-07-09, contract `21026` — initial add flow):

```json
{
  "serial_number": "1234556",
  "description": "testing the macbook",
  "type": "Phone",
  "contract_id": 21026,
  "currency_id": 14,
  "signature_name": "lukman olabanjo"
}
```

- **Response** (200): Not yet captured in isolation — infer `equipment_id` from subsequent
  `list` items (`data[].id`) or from `delete`/`return`/`signature` calls (`2070`, `2071`, `2073`).

- **Notes**:
  - Final create step — adds `signature_name` (client signatory).
  - Include `price` when the UI collected it (edit/add flows with valuation).
  - Use numeric `contract_id`, not the alphanumeric contract ref.

---

### List / filter equipment for a contract

- **Method**: `POST`
- **URL**: `/api/contract/equipment/list`
- **Auth**: `Bearer {client_token}` or `Bearer {contractor_token}`
- **Request body** (✅ Captured 2026-07-09 — list/filter):

Client (contract `21026`):

```json
{
  "page": 1,
  "contract_id": 21026
}
```

Contractor (contract `20985`):

```json
{
  "page": 1,
  "contract_id": 20985
}
```

- **Response** (200 — ✅ Captured 2026-07-09, contract `21026`):

```json
{
  "success": true,
  "data": [
    {
      "id": 2072,
      "type": "Computer",
      "description": "testing the roloe",
      "serial_number": "1322425252",
      "price": 3000,
      "currency": {
        "id": 14,
        "code": "DZD",
        "symbol": "DZD",
        "iso_code": "012",
        "name": "Algerian Dinar"
      },
      "file": null,
      "client_signed": 1,
      "contractor_signed": 1,
      "signatory": null,
      "status": {
        "id": 4,
        "name": "Signed"
      },
      "contract_ref": "M2U1046X",
      "created_at": 1783585810
    },
    {
      "id": 2074,
      "type": "Computer",
      "description": "testing the roloe",
      "serial_number": "35656563563",
      "price": 5000,
      "currency": {
        "id": 14,
        "code": "DZD",
        "symbol": "DZD",
        "iso_code": "012",
        "name": "Algerian Dinar"
      },
      "file": null,
      "client_signed": 1,
      "contractor_signed": 0,
      "signatory": null,
      "status": {
        "id": 3,
        "name": "Pending contractor signature"
      },
      "contract_ref": "M2U1046X",
      "created_at": 1783588255
    }
  ],
  "message": "Success!",
  "paginator": {
    "total": 2,
    "per_page": 10,
    "current_page": 1,
    "last_page": 1,
    "first_page_url": "https://sandbox-api.remotepass.com/api/contract/equipment/list?page=1",
    "last_page_url": "https://sandbox-api.remotepass.com/api/contract/equipment/list?page=1",
    "next_page_url": null,
    "prev_page_url": null,
    "from": 1,
    "to": 2,
    "has_pages": false,
    "has_more_pages": false
  }
}
```

- **Notes**:
  - **Filter** = `contract_id` — scopes the list to one contract. No additional filter params (`status`, `type`) observed in DevTools.
  - Pagination via `page` (1-based); use `paginator.has_more_pages` for multi-page fetch.
  - `data[].id` is the `equipment_id` for `delete`, `return`, and `signature`.
  - `client_signed` / `contractor_signed` are `0|1` flags.
  - Observed status values:

    | `status.id` | `status.name` |
    |-------------|---------------|
    | `3` | `Pending contractor signature` |
    | `4` | `Signed` |

  - Same endpoint, different token: client sees company view; contractor sees their assigned items.

---

### Mark equipment as returned

- **Method**: `POST`
- **URL**: `/api/contract/equipment/return`
- **Auth**: `Bearer {client_token}`
- **Request body** (✅ Captured 2026-07-09):

```json
{
  "equipment_id": 2070
}
```

- **Response** (200): Not yet captured — probe needed.

- **Notes**:
  - `equipment_id` from `list` → `data[].id`.
  - Client-initiated "mark as returned" flow.

---

### Delete equipment

- **Method**: `POST`
- **URL**: `/api/contract/equipment/delete`
- **Auth**: `Bearer {client_token}`
- **Request body** (✅ Captured 2026-07-09):

```json
{
  "equipment_id": 2071
}
```

- **Response** (200): Not yet captured — probe needed.

- **Notes**:
  - Hard delete — distinct from `return`.
  - Use for test cleanup in `afterAll` / fixture teardown.

---

## Contractor Endpoints

### Acknowledge equipment (signature)

- **Method**: `POST`
- **URL**: `/api/contract/equipment/signature`
- **Auth**: `Bearer {contractor_token}`
- **Request body** (✅ Captured 2026-07-09, equipment `2073`):

```json
{
  "equipment_id": 2073,
  "name": "lukman olabanji"
}
```

- **Response** (200): Not yet captured — probe needed.

- **Notes**:
  - Call when `list` shows `status.name = "Pending contractor signature"` (`status.id = 3`).
  - `name` = contractor full name (signatory).

---

## Known Reference IDs

| Constant | Value | Source |
|----------|-------|--------|
| `currency_id` DZD | `14` | Captured on add/edit flow |
| Equipment type | `"Phone"`, `"Computer"` | String labels on `type` field |
| `status.id` pending contractor | `3` | `list` response |
| `status.id` signed | `4` | `list` response |
| Sample `contract_id` (client) | `21026` | DevTools capture |
| Sample `contract_id` (contractor) | `20985` | DevTools capture |
| Sample `contract_ref` | `M2U1046X` | `list` response |
| Sample `equipment_id` (return) | `2070` | DevTools capture |
| Sample `equipment_id` (delete) | `2071` | DevTools capture |
| Sample `equipment_id` (contractor sign) | `2073` | DevTools capture |

---

## E2E Test Issue Mapping

| Test issue | Captured endpoint(s) | Gap |
|------------|---------------------|-----|
| Add equipment | `agreement/edit` → `agreement` → `add` | `add` response body |
| Assign to contractor | `add` (`contract_id` in payload) | No separate assign endpoint |
| Contractor acknowledgement | `signature` | Response body |
| Edit details | `agreement/edit` + `agreement` (with `price`) | Whether `equipment_id` needed on edit — not in capture |
| Request return | — | Only `return` (mark returned) captured |
| Mark returned | `return` | Response body |
| List / filter | `list` (`page`, `contract_id`) | No status/type query filters observed |
| Equipment history | — | **Not captured** |
| Backoffice | — | **Not captured** |

---

## Seeding Helpers (draft signatures)

Implementation target: `features/equipment/seeding.ts`.

```typescript
export interface EquipmentSeedClients {
  equipment: EquipmentClient;
}

export interface AddEquipmentInput {
  contractId: number;
  serialNumber: string;
  description: string;
  type: string;           // e.g. "Computer", "Phone"
  currencyId: number;     // e.g. 14 (DZD)
  price: number;          // e.g. 5000
  signatureName: string;  // client signatory — required on add only
}

export interface SeededEquipment {
  id: number;
  contractId: number;
  serialNumber: string;
  description: string;
  type: string;
  price: number;
  status: { id: number; name: string };
}

/** Client flow: agreement/edit → agreement → add. */
export async function addEquipmentViaApi(
  clients: EquipmentSeedClients,
  input: AddEquipmentInput,
): Promise<SeededEquipment>;

export interface AssignEquipmentInput {
  equipmentId: number;
  contractorToken: string;
  contractorName: string;
}

/** Contractor acknowledgement — POST /api/contract/equipment/signature */
export async function assignEquipmentViaApi(
  clients: EquipmentSeedClients,
  input: AssignEquipmentInput,
): Promise<void>;
```

---

## Reference

| Purpose | Path |
|---------|------|
| Contract creation (prerequisite — Ongoing contract) | `docs/api-discovery/contract-creation-endpoints.md` |
| Seeder endpoints (KYC, signatures, payments) | `docs/api-discovery/seeder-endpoints.md` |
| Payment processing (currency_id reference) | `docs/api-discovery/payment-processing-endpoints.md` |
