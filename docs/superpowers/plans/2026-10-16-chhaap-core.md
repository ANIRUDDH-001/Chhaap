# Chhaap Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the accepted Chhaap interface as a persistent, usable local print-shop application with reviewed AI extraction, deterministic pricing, quotations, production tracking, and payment records.

**Architecture:** React/TypeScript frontend and a modular FastAPI backend. PostgreSQL stores tenant-scoped business records and background jobs. A separate worker calls local Ollama; application services and pricing remain usable when inference is unavailable.

**Tech Stack:** React, TypeScript, Vite, custom CSS tokens/Tailwind, Radix, TanStack Query, React Router, React Hook Form/Zod, Lucide; Python 3.11, FastAPI/Pydantic, SQLAlchemy/Alembic, psycopg, PostgreSQL 18; Gemma 4 via Ollama.

**Spec:** `docs/superpowers/specs/2026-10-16-chhaap-design.md`.

## Global Constraints

- All pilot identities, conversations, rates, and history are labelled fictional.
- Preserve the accepted print-counter identity; improve small text, mobile navigation, accessible forms, and interactions.
- Currency INR; shop timezone Asia/Kolkata by default. Pricing uses decimal half-up and integer minor units.
- AI never sets prices, confirms fields, accepts quotes, sends messages, or records payments.
- Accepted quotations cannot be amended in Release A. Issued versions preserve rates and terms.
- Separate `D:\Hacktober 2026\chhaap` workspace, application database, model configuration, and development ports.
- Existing local PostgreSQL binaries and Ollama models may be used; no paid service, public deployment, publication, or message sending is authorized by this plan.
- Local files and `.env` stay ignored. Hosted storage remains behind a file-store boundary with documented environment configuration.
- Release B/C remain future work; keep them out of operational navigation until implemented.

## Review Focus

1. A delayed model response must never overwrite a newer draft or mark a field confirmed.
2. A cookie or guessed ID from one shop must not expose another shop's records or attachments.
3. Double acceptance, stale edits, and duplicate payment submission must not duplicate business records.
4. Relative dates, unknown stock, unreadable screenshots, and model outages must leave a usable manual-review path.
5. Historical totals and payment balances must stay correct across rate changes, refunds, and page refreshes.

## File responsibilities

`backend/chhaap/` owns settings/database/security, domain pricing/lifecycles, tenant services, API, extraction provider, worker, and private media store. Keep these in focused modules. `backend/tests/` owns independent pricing fixtures and real PostgreSQL/API integration tests.

`web/src/` owns the application shell/design tokens, typed API client, route-level screens, workbench components, form schemas, quote paper, and accessible dialogs. `web/src/**/*.test.ts(x)` owns meaningful client validation/user workflow tests. Browser verification exercises the real running backend.

`scripts/` owns local PostgreSQL setup, development launch, and evaluation. `compose.yaml`, Dockerfiles, Alembic migrations, `.env.example`, and README provide reproducible deployment. `eval/` stores fictional inputs, expected annotations, and measured outputs only.

## Task 1: Exact pricing and catalogue

**Files:** `backend/pyproject.toml`, `backend/chhaap/pricing.py`, `backend/chhaap/schemas.py`, `backend/chhaap/catalogue.py`, `backend/tests/test_pricing.py`.
**Interfaces:** `price_quote(lines: list[LineSpec], rates: RateCard, adjustments: Adjustments) -> PriceSnapshot`. `LineSpec` includes product, quantity, size/dimensions/units, paper, sides, colour, finish, confirmed, and optional manual price/reason. `PriceSnapshot` contains component amounts, subtotal, total, deposit, currency, and rate version.

- [ ] Write independent fixtures: 500 standard matte cards total 150000/deposit 75000; 1000 cards total 255000; premium 500 total 180000; boundary quantities; flyers; a 2×3 ft banner; fixed/minimum charges; discount/tax half-up; rejected zero/fractional quantity, incomplete fields, unit mismatches, and missing override reasons.
- [ ] Run `python -m pytest tests/test_pricing.py -q` in `backend`; observe missing behaviour.
- [ ] Implement typed catalogue and pure deterministic pricing. Use explicit `preview` vs `issue` validation; incomplete previews never become issuable.
- [ ] Run the complete backend suite; expect green. Commit domain pricing and tests.

## Task 2: Tenant persistence and identity

**Files:** `backend/chhaap/db.py`, `models.py`, `security.py`, `settings.py`, `seed.py`, `backend/alembic/`, `scripts/setup-local.ps1`, `backend/tests/test_identity.py`.
**Interfaces:** `shop_session(shop_id: UUID) -> Session`; `create_workspace(name, mode, owner?) -> SessionInfo`; `resolve_session(token: str) -> SessionInfo`. All business entities carry `shop_id`; scoped composite references prevent cross-tenant linkage. Sessions are opaque random tokens, stored hashed.

- [ ] Write integration tests for two isolated sample workspaces, authenticated registration/login/logout, expired sessions, RLS direct queries without tenant context, and cross-tenant foreign-key references.
- [ ] Run tests against the dedicated test database; observe absent identity/persistence behavior.
- [ ] Initialize a private local PostgreSQL cluster on loopback port 55432, with generated credentials in ignored `.env`. Define admin migration and non-owner runtime roles. Add migration, transaction-local tenant setting, RLS policies, indexes, session cookie security, and per-workspace seed records.
- [ ] Run integration tests through the runtime role; expect no tenant leakage. Commit.

## Task 3: Persistent requests, sources, and attachment handling

**Files:** `backend/chhaap/requests.py`, `media.py`, `api.py`, `backend/tests/test_requests.py`.
**Interfaces:** REST `/api/v1/session`, `/session/demo`, `/auth/*`, `/requests`, `/requests/{id}`, `/requests/{id}/sources`, `/requests/{id}/attachments`; reads and writes use authenticated session scope. `RequestDetail` contains sources, line drafts, expected revision, and review state. PATCH accepts `expected_revision` and returns 409 for stale edits.

- [ ] Write tests for draft persistence, text length, append/reorder source, stale revision rejection, invalid/oversized image handling, and cross-shop request/media access.
- [ ] Observe failures, then implement API/service and private local media storage. Decode and normalize images with Pillow. Validate content type, total count, byte limits, and dimensions.
- [ ] Require trusted origins for cookie-authenticated mutations. Return structured actionable errors; do not log message bodies or attachments.
- [ ] Run identity/request integration tests; commit.

## Task 4: Durable AI extraction

**Files:** `backend/chhaap/inference.py`, `worker.py`, `backend/tests/test_inference.py`, `backend/tests/test_worker.py`, `eval/fixtures.json`.
**Interfaces:** `InferenceProvider.extract(sources, catalogue) -> ExtractionResult`; `enqueue_extraction(request_id, expected_revision) -> JobInfo`; POST `/requests/{id}/extract` returns 202, GET `/jobs/{id}` reports state. Extracted fields remain suggestions, with evidence and uncertainty.

- [ ] Write tests for exact text-span evidence, missing stock, conflicting quantity, untrusted embedded instructions, malformed JSON, unknown product, stale completion, retry exhaustion, expired leases, and duplicate completion. Use a controlled HTTP server only for the external model boundary; keep job/database logic real.
- [ ] Observe failures. Implement Ollama schema-constrained image/text input, one schema repair, transient retries capped at three total attempts, and no hosted fallback.
- [ ] Implement PostgreSQL `SKIP LOCKED` claims with leases/heartbeats, source revision checks, bounded fair concurrency, and persisted progress/failure states. No inference inside a database transaction.
- [ ] Run targeted and complete tests. Start the existing Ollama binary on a dedicated loopback port, using existing model storage. Measure real Gemma extraction separately; report actual outcomes.
- [ ] Commit provider, worker, fixtures, and measured smoke results.

## Task 5: Quotations, customers, production, and payments

**Files:** `backend/chhaap/quotes.py`, `operations.py`, `backend/tests/test_quotes.py`, `backend/tests/test_operations.py`.
**Interfaces:** POST `/quotes/preview`, `/quotes/issue`, `/quotes/{id}/revise`, `/quotes/{id}/response`; GET `/quotes`, `/customers`, `/orders`, `/reports`; POST `/orders/{id}/transition`, `/orders/{id}/payments`; POST `/rates/publish`. All consequential mutations accept idempotency keys and expected revisions where applicable.

- [ ] Write API tests for unconfirmed issue rejection, immutable issued snapshots, rate update stability, quote expiry, accepted revision guard, concurrent/double acceptance with one resulting order, and old revision acceptance rejection.
- [ ] Write tests for proof approval before printing, cancellation history, repeat order with current rates/cleared dates, payment/refund/reversal bounds, overpayment credit, duplicate receipt, and reports separating quote value from receipts.
- [ ] Observe red tests; implement transactional services, tenant checks, audit events, rate snapshots, and business transition validation.
- [ ] Run all backend tests; commit.

## Task 6: Accepted design as a real application

**Files:** `web/package.json`, `web/vite.config.ts`, `web/src/main.tsx`, `App.tsx`, `styles.css`, `lib/api.ts`, `lib/types.ts`, `components/`, `screens/`.
**Interfaces:** TanStack Query fetches the typed API; React Router provides real routes. The app bootstraps a per-browser sample session only when no existing session is present; private mode has explicit owner onboarding/login. A reusable `QuotePaper(snapshot)` renders server amounts and print terms.

- [ ] Write client tests for validation blocking incomplete quote issue and preserving entered source/draft after a network failure. Do not test decorative constants or framework plumbing.
- [ ] Observe the missing behaviours, then build the shell, self-hosted fonts, responsive navigation, search, light/dark tokens, accessible dialogs, and structured toasts.
- [ ] Implement request list/new-request modal, source text/screenshots, evidence review, multi-line details, polling extraction, manual confirmation, debounced server preview, and persisted drafts. Autosave clearly indicates saving/saved/error and survives navigation.
- [ ] Implement customer-ready quote paper, issue/revise/record-response, print, copy/share, and frozen historical preview. Review actions must use server-returned values and handle 409 conflicts visibly.
- [ ] Run client tests and `npm run build`; verify the accepted look with a running backend at phone/desktop widths. Commit.

## Task 7: Complete core screens and refinement

**Files:** route screens for Today, Quotes, Jobs, Customers, Rates, Reports, Settings; backend export/retention settings routes; relevant tests.
**Interfaces:** Every displayed count/amount comes from saved records. No dead operational buttons. Product capabilities needing external accounts remain absent or clearly future work.

- [ ] Write the failing end-to-end/API scenarios for job completion with an outstanding balance, manual payment/refund, rate publication preserving an earlier quote, customer repeat order, and JSON data export.
- [ ] Implement action queues, searchable/filterable records, production stage actions, payment dialog/ledger, customer history, rate draft/simulation/publish, reports, settings, and isolated sample reset. Add privacy and local inference status.
- [ ] Refine typography/readability, responsive workbench steps, accessible labels/focus, mobile targets, print layout, errors/empty/loading states, and reduced motion.
- [ ] Run full suites and build. Browser-check persistence after refresh, two isolated sessions, core keyboard interaction, quote printing layout, and all screens at 360/768/1024/1440 px. Commit.

## Task 8: Reproducibility, evaluation, and deployment preparation

**Files:** `README.md`, `LICENSE`, `.env.example`, `compose.yaml`, Dockerfiles, `scripts/dev.ps1`, `scripts/evaluate.py`, `eval/`, CI configuration.
**Interfaces:** One documented local launch command starts API/worker/frontend without touching previous projects. Docker setup runs migrations before serving. Authenticated endpoints and private media work in either deployment path.

- [ ] Add 60 labelled fictional cases with specified distribution; evaluate field/missing-information accuracy independently of pricing. Record model identifier, prompt/schema version, cold/warm latency, memory where measurable, and limitations. No invented benchmark results.
- [ ] Verify installation from dependency lockfiles, migrations on a fresh database, seed/reset behavior, health/readiness, and backup/restore commands. Add private-retention cleanup and data export documentation.
- [ ] Add automated backend/client checks and production build in CI. Document worker/model configuration and future hosted storage adapter requirements honestly.
- [ ] Run suites/build and a measured bounded load smoke test; report performance instead of asserting the design target is met.

## Task 9: Fresh review and final verification

**Files:** review/fix tests as needed, progress ledger, README.
**Interfaces:** Approved spec and this plan define acceptance; reviewer checks Review Focus and actual exposed behavior.

- [ ] Dispatch one fresh reviewer for the whole implementation, including tenant boundaries, pricing, race/idempotency, AI trust, and UI completeness. No implementer subagent per task.
- [ ] Resolve important findings with reproducing tests, run the entire suite/build, record deviations and remaining future work, and commit.
- [ ] Leave a running, usable local app open in the browser, with screenshots showing the actual application. Link the implementation plan, README, and measured evaluation. Do not publish or deploy externally without separate authorization.

## Execution decision and review

The user accepted the visual baseline and explicitly asked to continue planning and working. Execute inline, preserving continuous progress; this is the agent's selected method under that authorization. The project folder is already isolated from the earlier projects and is not a repository yet; initialize its own Git repository on `feat/chhaap-core` rather than creating an unrelated worktree. Track actual completion and any changes in `.superpowers/sdd/2026-10-16-chhaap-core/progress.md` and commits.

Self-review: Tasks 1–8 cover Release A, with owner-first access and no email-based invitation service; B/C remain explicit future work. Shared contracts are Pydantic/OpenAPI schemas plus typed frontend interfaces. RLS, worker claims, and immutable quote/payment behavior require real PostgreSQL tests; SQLite substitutes are not accepted. The model/runtime availability is known but its accuracy and latency are not yet measured.
