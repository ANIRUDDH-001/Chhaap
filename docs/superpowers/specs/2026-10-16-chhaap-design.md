# Chhaap — product and experience design

**Status:** Design baseline accepted by the user on 16 October 2026, with instructions to continue refining, planning, and implementing.
**Date:** 16 October 2026, Asia/Kolkata.
**Workspace:** `D:\Hacktober 2026\chhaap`, independent of Bahaana and Kaagaz.
**Companion:** A disposable interactive visual prototype in `.superpowers/brainstorm/`.

## 1. Intent and decisions

Chhaap helps a neighbourhood print shop turn messy customer conversations into complete job specifications, explainable prices, reviewed quotations, and trackable print jobs.

The primary user is Aman, the fictional owner of **Aman Printworks**. He handles the counter, customer messages, quotations, and production scheduling. The entire pilot, customer list, conversations, rate card, and transaction history are fictional. They must be labelled as sample data. No testimonials, adoption, savings, accuracy, revenue, or willingness to pay will be represented as observed facts.

The user explicitly requires extensive product design, scalability, and a beautiful UI as a priority. They delegate product and technical choices. These are therefore design choices made by the agent, rather than preferences independently confirmed by the user:

- Responsive web application with a laptop workbench and a purposeful mobile flow.
- Pasted conversations **and** chat screenshots as first-release inputs.
- English UI initially; English, Hindi, and Hinglish input; English/Hindi/Hinglish customer reply options.
- Human review of extracted specifications and quotation approval.
- Deterministic, versioned pricing, separate from AI interpretation.
- One cohesive business application covering request → clarification → quotation → job → payment record.
- A modular backend, PostgreSQL tenant isolation, and independently scalable background inference.
- Local open-weight inference as a supported mode; hosted inference as an explicit deployment option.
- Complete product design now, delivered through defined releases. The design does not promise every future integration for the challenge deadline.

**Success:** A visitor can understand the value, try a labelled sample request, resolve an ambiguity, see a reproducible price, produce a reviewed quote, and follow its accepted job without a tutorial. The UI must feel designed for a print shop, not like a generic AI chat interface.

## 2. Scenario and business hypothesis

A customer writes: “Bhai 500 visiting cards chahiye, dono side colour, last time wala paper. Friday tak kitna?”

Chhaap identifies visiting cards, quantity 500, double-sided colour printing, an unresolved stock reference, and an ambiguous deadline. It shows the exact source text beside each suggestion. It does not assume that the customer's previous stock is known. If the owner explicitly links a previous order, its paper stock becomes a historical suggestion requiring confirmation.

Aman confirms the dimensions, paper, finishing, and actual delivery date. A selected rate-card version produces the price and line-item explanation. Aman can prepare a short clarification reply or approve and export the quotation. Only a recorded customer acceptance creates a production job.

**Commercial hypothesis:** Shops might pay for fewer interruptions, more consistent quoting, and fewer specification mistakes. Start with a per-shop subscription and a bounded AI allowance, with bring-your-own inference as an option. Exact plans and prices remain experiments; no payment collection or subscription entitlement system is part of the first release.

## 3. Product boundaries and releases

### Release A — polished complete core

- Workspace onboarding: shop identity, locale, currency, timezone, quote validity, and a starter catalogue/rate card.
- Private owner account; employee access and roles if enabled for the private pilot.
- Requests: text, up to five image attachments, source ordering, a sample library, and resumable saved drafts.
- Structured extraction, source evidence, missing-information checks, conflict review, and manual editing.
- Multi-line quotations for visiting cards, flyers, and banners.
- Pricing preview, alternatives, manual adjustments with reasons, immutable issued versions, and customer-ready print/PDF output through browser printing.
- Copyable clarification and quotation messages; native share where available. Sharing stays user-initiated.
- Customer directory, order history, duplicate-customer resolution, and repeat order as a new draft at current rates.
- Jobs: proof pending, approved for print, printing, finishing, ready, delivered, and cancelled, with due dates and activity history.
- Manual payment records: deposit, balance, refund, method label, and receipt reference. These record what the owner says happened; they do not move money.
- Rate-card editor, preview-before-publish, version history, and product availability.
- Shop dashboard with action queues; basic reports derived from actual saved records.
- Search, filters, empty/loading/error states, keyboard access, responsive layouts, and light/dark appearance.
- Explicit sample mode, private mode, retention settings, export, and documented deployment.

### Release B — shop operations expansion

Employee invitations; detailed permissions; proof-file upload and customer proof approval; secure customer quote links; expiring/revocable links; customer acceptance; scheduled follow-up reminders; resource calendars; workload warnings; stock adjustments and reorder thresholds; richer reports; multilingual UI; CSV import/export.

### Release C — commercial and multi-branch expansion

Official WhatsApp Business integration, inbound email, subscription billing, verified payment-provider integration, branch-specific stock and rates, purchase orders, supplier outsourcing, accounting integrations, and configurable approval limits. These require credentials, separate service costs, and explicit implementation work. No fake controls imply these integrations are operational in Release A.

**Not a printing engine:** Chhaap does not edit artwork, rasterize print files, automatically certify bleed/colour profiles, or promise machine availability. Artwork and capacity checks are owner-confirmed in A. Automated preflight belongs to a later, separately validated module.

## 4. Experience and visual language

### Identity: the modern print counter

The main visual idea is a clean job jacket beside a customer conversation and a typeset quotation. Print registration marks and paper edges appear sparingly at meaningful document boundaries. Typography, alignment, and visible production detail carry the personality.

| Token | Choice and use |
|---|---|
| Paper | `#F7F6F2` application canvas |
| Sheet | `#FFFFFF` editable forms and quote sheet |
| Ink | `#252A34` primary text and navigation |
| Vermilion | `#C63E27` primary actions and brand stamp |
| Press green | `#256657` confirmed/ready states |
| Rule | `#E5E4DE` functional boundaries |

Secondary colour is used only for status or material swatches. Do not use colour alone to distinguish a blocked quote or a completed job. Dark mode uses deep navy surfaces, off-white text, brighter vermilion for accessible controls, and corresponding readable status colours.

**Typography:** Manrope for interface text, Fraunces for the Chhaap wordmark and selected page titles, Noto Sans Devanagari for Hindi fallback. Use licensed, self-hosted font files in the actual app. Body text 14–16 px desktop and at least 16 px for mobile inputs; tabular figures for money. Display type stays out of dense forms.

**Geometry:** 8 px spacing rhythm; modest 8–12 px component radii; document preview edges feel like a sheet. Shadows distinguish floating elements and the quote paper, not every row. Forms are left aligned. Lists and tables use consistent baselines.

**Motion:** 120–180 ms feedback on changed fields, opening panels, and status transitions. No decorative looping animation, fake typing, or animated counters. Respect reduced motion.

### Navigation

Primary: Today, Requests, Quotes, Jobs, Customers, Rate card. Secondary: Reports and Settings. Search and “New request” remain easy to reach. Navigation counts come from actual records. New shops see purposeful empty states; a sample-data switch is explicit.

### Desktop quote workspace

At wide widths, three regions sit together:

1. **Conversation:** chronological messages or screenshot viewer, source switching, and clarification composer.
2. **Job details:** extracted editable fields, evidence links, missing/conflicting flags, review progress, and product options.
3. **Quotation:** paper-like preview with item descriptions, pricing breakdown, validity, delivery terms, and the next valid action.

At medium widths, use conversation + details, with the quotation below or in a dedicated preview tab. At narrow widths, use labelled steps: Request → Details → Quote. Preserve draft state across views. Do not squeeze three desktop columns onto a phone.

### Other screens

- **Today:** work requiring attention, due jobs, outstanding balances, and recent activity. Distinguish quote value, accepted order value, and money actually recorded as received.
- **Requests:** searchable list with customer, product, latest activity, blocker, and assigned staff. Opening a request goes to its workspace.
- **Quotes:** filters for drafts, issued, accepted, declined, expired, and superseded versions. Open, duplicate, revise, or record a customer response.
- **Jobs:** production board plus a compact accessible list view. Stage movement uses an explicit action as well as optional drag-and-drop. Blocked artwork and overdue work are visible.
- **Customers:** customer details, source-linked order history, balances derived from orders, and repeat-order action.
- **Rate card:** product-specific pricing tables, tier rules, per-area or per-piece units, effective version, draft changes, simulation, and publish.
- **Reports:** a small number of real measures, with date range, definitions, and empty states. No invented growth chart.
- **Settings:** shop brand, quote terms, inference location, privacy/retention, account/team, and data export.

### Accessibility and visual acceptance

Target WCAG 2.2 AA: keyboard-operable controls, labelled inputs, visible focus, accessible status announcements, sufficient contrast, and errors attached to their fields. Prefer 44 px touch targets. Test widths 360, 768, 1024, and 1440 px, plus 200% zoom. No clipped essential actions. Confirmation dialogs restore focus. Every workflow has an actionable empty, busy, success, and failure state.

The visual prototype is a review artifact. It uses fictional state and local interactions; it is not an inference benchmark, production app, or proof that all features exist.

## 5. Request ingestion and AI behaviour

### Inputs

- Pasted text up to 20,000 characters per request; optional sender and received time.
- JPEG, PNG, or WebP chat screenshots, at most five files and 10 MB each; reject corrupt or unsupported files and decompression bombs. Server validates decoded dimensions and normalizes orientation.
- Image OCR/transcription is shown before or alongside the structured fields. Screenshot evidence is an attributed transcription, not proof of pixel-level accuracy. Source cards open the relevant image for checking. The first release does not claim calibrated bounding-box provenance.
- Conversation ordering can be changed before extraction. More messages can be appended to an existing draft; accepted field values are not silently overwritten.

### Extraction contract

The model returns a constrained object: detected language, suggested line items, field candidates with source references, unresolved references, conflicting candidates, requested date text, and a clarification draft. Unknown values are null. Product matches are restricted to supplied catalogue IDs or marked unsupported.

Field state is one of **suggested**, **needs clarification**, **conflicting**, or **confirmed**. Confirmation is a recorded human action. Model-generated confidence percentages are not shown as calibrated probabilities. The application validates quantities, units, product compatibility, and required fields independently of the model.

Text evidence must match actual source spans. Screenshot transcription remains explicitly unverified until reviewed. A field without checkable support needs manual confirmation. Source messages are untrusted data and cannot change system instructions, invoke tools, alter a rate card, or authorize an action.

“Friday”, “tomorrow”, “same as before”, and “usual paper” are not silently resolved. Dates use the shop timezone and a known message timestamp where available, and are shown for confirmation. Historical information is only retrieved from the same tenant and explicitly linked customer/order.

### Model and portability

Initial model candidate: **Gemma 4 E4B** with text and image input through an Ollama adapter. This is a candidate subject to the evaluation gate, not a claim of measured speed or accuracy. The current laptop has approximately 16 GB RAM and integrated graphics, so the local benchmark begins with one request at a time and bounded image resolution/context. No CUDA dependency is assumed.

Application code depends on an `InferenceProvider` boundary supporting extraction and reply drafting. Record provider, model identifier/digest, prompt version, schema version, duration, and validation outcome. A hosted adapter may serve an open-weight model using the same validated output contract; switching providers is deliberate and visible. Do not send local-mode inputs to a hosted provider as an automatic fallback.

Keep model inference out of the request-serving process. Model timeout or invalid output leaves the draft intact and offers retry/manual entry. At most one repair attempt for schema-invalid output; exponential backoff applies to transient provider failures only, with a cap of three total attempts per job. A late result for an older request revision is shown as stale and cannot overwrite current fields.

## 6. Catalogue and pricing

### Supported pricing families

- **Visiting cards:** per-piece quantity tiers, size, paper stock/GSM, colour/sides, and finishing.
- **Flyers:** per-piece quantity tiers, size, paper stock/GSM, colour/sides, and finishing.
- **Banners:** width × height × quantity × per-area rate; material, finishing, and setup cost. The pricing unit is always visible; dimensions may be entered in mm, cm, inches, or feet and normalized with decimal arithmetic. Product definitions identify required fields and allowed combinations.

No industry-wide price or tax rate is assumed. The seed catalogue contains explicitly fictional rates. Tax defaults to off; a configured rate is labelled shop-provided. The product creates quotations and payment records, not compliance-certified tax invoices.

### Deterministic formula and rounding

For each line: select the active product/rate match; apply the all-units quantity tier to the line quantity; compute base price; add per-piece/per-area or fixed finishing costs; apply the product minimum charge; add explicit line adjustments. Then sum lines, add shop-configured rush/delivery/design charges, subtract an explicit order discount, calculate configured tax on the post-discount taxable subtotal, and calculate the requested deposit from the final total.

Amounts are evaluated using decimal arithmetic. Round each displayed line subtotal, each order-level charge/discount, and each tax amount to the currency minor unit using half-up; total those rounded components. Store persisted currency amounts as integer minor units. Do not use JavaScript floating-point totals as the source of truth. Reject negative quantities, impossible dimensions, unsupported rate combinations, and discounts exceeding the applicable subtotal. All manual adjustments require an audit reason; employees require owner approval for price overrides.

The application displays intermediate components and distinguishes a blocked estimate from an issuable quote. Unsupported products can be recorded but require an owner-entered manual line price and description before issue.

### Worked sample used in the prototype

Fictional visiting cards: 500 pieces, standard size, 350 GSM matte, double-sided colour. Per-piece rate ₹2.40; matte finishing ₹0.30 per piece; setup ₹150. Sample tax is disabled.

- Printing: 500 × ₹2.40 = ₹1,200.
- Matte finishing: 500 × ₹0.30 = ₹150.
- Setup: ₹150.
- Total: **₹1,500**; 50% requested deposit: **₹750**.

The seed tier is ₹3.00 for 1–249 pieces, ₹2.70 for 250–499, ₹2.40 for 500–999, and ₹2.10 for 1,000+. A separate premium-stock uplift is ₹0.60 per piece. These are sample business rules, not market quotations.

### Quote integrity

An issued revision stores a complete specification and pricing snapshot, rate-card version, terms, currency, tax configuration, expiry, issuer, and issue timestamp. Later rate changes never change an issued quote. A revision supersedes the previous offered revision and requires fresh acceptance. Acceptance is atomic and creates at most one order for that revision. Expired, superseded, cancelled, or already accepted offers cannot be accepted again.

Private Release A records off-platform responses manually, with actor/time and an explicit label. Copy/export does not claim delivery or customer viewing. Public acceptance links belong to B and must resolve the exact revision.

**After acceptance:** Release A prohibits revising an accepted quotation or changing its order's commercial specification/total. A separate new quote may be linked to an existing order as additional work, but cannot replace that order or reuse its payment entries implicitly. Cancellation of the old order and refunds remain explicit audited actions. A true order-amendment workflow, including re-acceptance and allocation of existing payments, belongs to Release B. This prevents a revised acceptance from creating a duplicate job for the original order.

## 7. Lifecycle, production, and payments

**Request:** new → extracting → needs review → ready for quote; extraction may fail/retry. A request may contain multiple line items.

**Quote:** draft → issued → accepted / declined / expired / superseded / cancelled. An issued quote cannot be edited in place. Expiry is evaluated at read/accept time, not only by a scheduled job.

**Order:** proof pending → approved for print → printing → finishing → ready → delivered. Cancellation is explicit and audited. No artwork file is required in A, but “artwork approved” and an approval note/actor/time must be recorded before printing. Due dates are requested dates until Aman confirms them. Workload warnings do not assert machine capacity unless actual capacity data is configured.

**Payments:** immutable receipt/refund entries linked to the order; corrections use reversal entries. Net received = receipts minus refunds/reversals; balance = order total minus net received. Overpayments are shown as credit, not silently clamped to zero. Refunding above the remaining received amount requires correction rather than a negative balance trick. Job stage and payment state are separate; delivered may still have a balance. No refund executes a bank transfer.

**Repeat order:** duplicate confirmed specifications and link the previous order as provenance; use current rates; clear obsolete dates; require review and issue as a new quote.

## 8. Application architecture

### Chosen stack

- Frontend: React + TypeScript + Vite, Tailwind for tokens/layout, Radix primitives for accessible overlays, TanStack Query for server state, React Router for routes, React Hook Form with Zod for forms, and Lucide icons. Custom components define the Chhaap appearance; a stock dashboard template does not.
- Backend: Python + FastAPI, Pydantic request/extraction schemas, SQLAlchemy, and Alembic migrations.
- Database: PostgreSQL, including a durable jobs table for initial background work.
- Worker: separate process from the same backend codebase, claiming jobs with short row-lock transactions and leases. Inference happens outside database transactions.
- Files: private S3-compatible object storage in hosted mode; a mounted private storage directory behind the same storage interface for a single local deployment. Filenames/paths are generated server-side, not taken from users.
- Deployment: containerized frontend/API, worker, and PostgreSQL; separately configured model runtime. The first deployment can be a single host. No paid account or provider provisioning is implied by this design.

Organize modules around identity/workspaces, requests/inference, catalogue/pricing, quotations, customers, jobs/payments, and reporting. They expose service interfaces. Pricing and lifecycle rules are pure domain code. API handlers do not embed prompt logic or pricing formulae.

### Data entities

| Domain | Core records |
|---|---|
| Identity | users, shops, memberships, sessions, audit events |
| Catalogue | products, option definitions, rate-card versions, pricing rules |
| Requests | requests, source messages, attachments, extraction runs, field candidates, confirmation events |
| Quotes | quotes, immutable quote revisions, line items, pricing snapshots, acceptance events |
| Operations | customers, orders, production events, payment ledger entries |
| Infrastructure | background jobs, idempotency records, tenant quotas |

Every business record has `shop_id`. Tenant-aware foreign keys prevent cross-shop links; indexes begin with tenant where the query pattern requires it. Attachments are referenced by opaque IDs. Relational fields capture money, status, dates, and relationships; JSON is limited to versioned extraction payloads and snapshots.

### API shape and concurrency

Version the API under `/api/v1`. Define typed endpoints for sessions/current shop, catalogue/rate cards, requests/sources/extractions, quote preview/issue/revise/record-response, customers, orders/transitions, and payment entries. An extraction submission returns HTTP 202 and a job ID. The frontend polls pending jobs with backoff and stops after completion or leaving the view.

Use opaque IDs and cursor pagination for growing lists. Client-supplied `shop_id` never establishes authorization. Resolve the active shop from authenticated membership. Mutations include an expected resource revision; stale updates return a conflict with a refresh/review path. Issue, accept, create-order, and ledger-entry operations use idempotency keys and transactional uniqueness constraints. Editing a draft increments its revision and invalidates older extraction/preview results.

The frontend may optimistically update harmless filters or draft presentation, but final prices, quote issue, order transitions, and payment records wait for server acknowledgement.

### Tenant and access protection

Use signed secure HTTP-only same-site session cookies, standard password hashing, CSRF/origin checks on mutations, and server-side authorization. Owner can manage rates/team and approve overrides. Counter staff can manage drafts/quotes and permitted payment records. Production staff can access assigned job specifications and stage actions, not private financial settings.

Enable PostgreSQL row-level security with explicit per-shop policies and a non-owner application role without `BYPASSRLS`. Set tenant context transaction-locally, including worker jobs; never leave it set on a pooled connection. Workers receive a tenant-scoped job descriptor rather than unrestricted raw queries. Migration/admin credentials are separate. Verify every relevant route, job, report, attachment, export, and foreign-key reference across two shops.

### Durable background work

Create the job in the same transaction that saves the source revision. Workers claim with `FOR UPDATE SKIP LOCKED`, store a lease/attempt count, release database locks, then perform inference. A heartbeat extends active leases. A crashed worker's expired lease permits another worker to retry. Completion is compare-and-set against job state, lease owner, and source revision. Cancellation and stale results cannot publish updates. The design provides at-least-once work with idempotent commits, not exactly-once execution.

Apply per-shop pending-job limits, maximum input sizes, fair scheduling, and a global inference concurrency cap. Return an actionable queue status; one shop cannot monopolize the runtime. Retry exhausted jobs remain visible for manual recovery. Separate the queue storage interface if a dedicated broker becomes justified later.

## 9. Scale and operations

Design for growth without claiming unmeasured capacity:

1. **One shop/local pilot:** one API process, one worker, PostgreSQL, private files, and one model request in flight. Manual quoting keeps working when inference is unavailable.
2. **Multiple shops:** stateless API replicas behind a load balancer; shared PostgreSQL/object storage; additional workers within model concurrency limits; bounded database pools; tenant quotas; indexed queries and pagination.
3. **Sustained inference demand:** independently expand model serving capacity; batch only where latency allows; scale worker concurrency against measured memory/latency; isolate expensive image workloads from short text work.
4. **Larger deployment:** add a dedicated broker, read replicas for reporting, and selective service extraction only after measured contention or ownership needs justify them. Branches add explicit branch-scoped permissions, rates, and stock rather than overloading shop IDs.

First benchmark target: seed 100 fictional shops, 100,000 quotes overall, and 20 concurrent non-inference clients. Aim for p95 under 500 ms for ordinary reads/mutations and under 200 ms for pricing preview on a documented deployment. Measure cold/warm model latency and queue wait separately; do not promise an inference SLA before benchmarking. This target is a test configuration, not an advertised supported capacity.

Observe request IDs, queue age/depth, model durations, validation failures, retries, pricing errors, issue/accept conflicts, database pool usage, and per-shop resource use. Logs omit source text, screenshots, tokens, and private customer data. Health/readiness distinguish API/database health from model availability. Set timeouts, request limits, and resource limits.

Daily encrypted database backups plus storage backups; execute a restore drill before a private pilot. Migrations use expand/contract when live users exist. Deploy schema before dependent app changes; retain an app rollback path. Use feature flags for new catalogue/pricing/model versions and re-run fixed evaluation fixtures before enabling them. No silent rate-card or model upgrade changes business behaviour.

## 10. Privacy, demo safety, and retention

- **Sample mode:** obvious “Fictional sample shop” label, isolated per-browser/session state, reset control, no shared editable tenant, and no real screenshot uploads to a public demo by default. Precomputed AI examples are labelled as recorded example outputs.
- **Private mode:** authenticated access, chosen inference location shown before processing, encrypted transport, private attachment access, and tenant isolation. A hosted deployment is never described as fully on-device.
- Delete private raw screenshots after 30 days by default, configurable to deletion after extraction/review. Warn that deleting originals reduces later evidence review. Keep business records until owner deletion/export rather than implying a statutory retention policy.
- Tenant deletion revokes access and enqueues file/record deletion, completed within seven days; backups age out within 30 days. Explain this window. Logs do not become a second copy of customer content.
- Model providers receive only the current request and minimum relevant catalogue/history context. No cross-customer or cross-tenant memory; no training on customer data by default.
- File processing validates media and output encoding. Render messages as text, not HTML. Never fetch arbitrary user URLs server-side.

## 11. Acceptance and evaluation

### UI and workflow

Test source → clarification → confirmed fields → deterministic preview → issued quote → recorded acceptance → production → payment record. Test lost network, refresh, duplicate clicks, mobile navigation, stale edits, retry, and return to an interrupted draft. Inspect visual screenshots in light/dark and the four target widths; keyboard-test overlays and core actions.

### Pricing

Use hand-calculated fixtures for tier boundaries, quantity changes, unit conversions, area rounding, minimum charges, finishing/setup, discounts, configured tax, deposits, owner overrides, zero/negative inputs, and unsupported combinations. Verify historical quote totals after rate updates. No AI call is needed for these tests.

### AI

Create 60 fictional scenarios: 20 clear text, 15 incomplete, 10 conflicting/change-of-mind, 10 screenshot inputs, and five adversarial/unsupported requests, distributed across English/Hindi/Hinglish. Include “last time”, relative dates, multiple products, bad crops, mixed units, customer corrections, and instructions embedded in chat.

Measure field-level accuracy, unsupported suggestions, missing/conflict detection, source match, complete-request success, latency, peak memory, and manual corrections. Separate screenshot transcription errors from downstream extraction errors. Use a simple rule-based text extractor as a baseline. Proposed gates: at least 90% supported-field accuracy and 95% missing-required-field detection on this labelled set, no unreviewed unsupported field can issue a quote, and 100% deterministic pricing fixtures. If the model misses the accuracy gate, keep AI suggestions gated and report the result; do not disguise failure with scripted output presented as live inference. No measured results exist yet.

### Reliability and isolation

Test worker death/restart, duplicate delivery, expired lease, stale completion, invalid JSON, model timeout, storage failure, quote expiration/accept race, simultaneous acceptance, unauthorized price override, and ledger reversals. Cross-tenant attempts must fail for reads, writes, exports, attachments, workers, and relationship IDs. Verify backup restoration and account/session revocation.

### Challenge presentation

Use the user's pasted Week 2 brief as the current supplied reference; live DevRelay lookup was blocked by a disconnected account. Recheck the official deadline and submission instructions before publishing. The pasted cutoff is 18 October 2026 at 11:59 pm PDT, corresponding to 19 October 2026 at 12:29 pm India time. A staged demo/write-up must accurately distinguish implemented features, prototype features, recorded examples, and future design. No real-user validation will be fabricated.

## 12. Delivery order and approval boundary

1. Review this product design and visual prototype; collect one consolidated round of changes.
2. After approval, write an implementation plan, with the UI design system and core workflow first.
3. Build one complete vertical slice with real inference, pricing, persistence, and a polished workbench.
4. Expand the core operations screens, failure states, and isolation/reliability checks.
5. Validate, deploy the chosen mode, and prepare the evidence-led submission.

No product dependencies, accounts, deployments, paid services, database schema, or application code have been created by the design step. The prototype uses local fictional data only. In the eventual repository, ignore `.superpowers/` session artifacts; keep the approved design under `docs/`.

## 13. Evidence and sources

- Google, [Gemma 4 model overview](https://ai.google.dev/gemma/docs/core): official model-family and input capability reference. Capability documentation does not establish task accuracy or performance on this laptop.
- Ollama, [Structured outputs](https://docs.ollama.com/capabilities/structured-outputs): JSON-schema constrained output and vision examples. Structural validation is not factual validation.
- PostgreSQL, [Row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): tenant policy foundation; owner/superuser bypass must be accounted for.
- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/): accessibility target.
- Sepehr Mohseni, [From monolith to modular monolith to microservices: realistic migration patterns](https://dev.to/sepehr/from-monolith-to-modular-monolith-to-microservices-realistic-migration-patterns-36f2), tags backend/architecture/refactoring/php: an author's experience supporting explicit module boundaries before selective service extraction. The inspected post had zero comments; it is one viewpoint, not evidence of a community consensus. DevRelay semantic search was unavailable without account connection, so the public article was read directly.

## 14. Decisions intentionally left to implementation

Exact compatible package patches, CSS implementation details, database column naming, and the final hosting account can be settled during implementation. Choose current supported versions, lock dependencies, and record deployment/model configuration. Hosting credentials, paid provisioning, and real customer communication are separate actions, not authorization granted by this design. These choices must preserve the contracts, privacy boundaries, visual direction, and tested workflow above.

## 15. Design review and prototype checks

A fresh builder review identified one material question: changes after acceptance. Section 6 now explicitly prohibits editing accepted commercial terms in Release A and reserves proper amendments for B. This is the design author's decision.

Browser checks on the disposable prototype verified a 1,000-piece sample quote of ₹2,550; the saved snapshot stayed ₹2,550 after changing the workbench back to 500 pieces. Moving a sample job from proof pending to printing updated the board counts. The incomplete request initially prevents quote preparation. No console errors were captured during the final inspection.

Responsive inspection covered 360, 768, 1024, and 1440 px widths, with no document-level horizontal overflow. The initial phone navigation was revised to a page picker. Both light and dark workspaces were visually inspected. Screenshots are saved under `docs/design-assets/`.

These checks validate prototype interactions and layout only. Product inference, durable state, backend authorization, accessibility conformance, load targets, and production deployment remain unimplemented and unverified.
