---
id: d61af31d-933f-5f95-9326-473c2023d4fe
name: sandbox-api-architecture
description: "RemotePass sandbox API split: sandbox-api.remotepass.com swagger is the monolith only; portions of the platform are already on separate microservices outside that swagger"
metadata:
  type: reference
  category: domain
  tags: ["sandbox", "api", "monolith", "microservices", "architecture", "swagger"]
  author: dmytro
  createdAt: 2026-05-26T08:00:00Z
  updatedAt: 2026-05-26T08:00:00Z
  expiresAt: null
---

# Sandbox API — what `sandbox-api.remotepass.com/swagger/docs` actually covers

## Facts (confirmed 2026-05-25 by Roman & Sergiy in DM)

- **`https://sandbox-api.remotepass.com/swagger/docs`** = swagger for the **monolith** application. It is **not** a full picture of the platform.
- Part of the platform is already extracted to separate microservices, which are **not** in the monolith swagger.
- Roman is currently using an agentic flow to extract more services from the monolith — the split will keep growing over time.

> Roman (DM): «This is the API of the monolith app we have»
> Sergiy (DM, translated from Ukrainian): "Part monolith, part on microservices — that's a question for Roman, I think."

## How to apply when designing the new framework

- **Do not assume one base URL.** The API client layer must support multiple `baseURL`s — at minimum: monolith + each known microservice.
- **Do not divide our tests by the monolith swagger's grouping.** Tests are divided by user-facing feature (see [[project-test-division-by-feature]]). The API client layer is the only place that follows backend service boundaries.
- When a feature spans the monolith and a microservice, the test still lives in one feature module; the underlying API clients can come from different service layers.
- When Roman extracts a new service from the monolith: identify which existing API client(s) move with it, update only the client layer, leave tests untouched.

## Known microservices (to be filled in as confirmed)

- _Time tracking_ — has its own API URL (`TIME_TRACKING_API_URL` env var) — confirmed already isolated.
- _(Add others here as Roman confirms the split.)_

## What to ask Roman next time

1. Authoritative list of services already split from the monolith, with their base URLs.
2. Forward-looking list of services planned for extraction in the next 1–2 quarters (so the API client layer can be shaped to absorb the moves without restructuring tests).
