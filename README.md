# chhaap.

**The modern print counter.** Turn a customer conversation into a reviewed quotation, then follow the accepted job through production and a manual payment ledger.

Built around **Aman Printworks, a fictional print shop**. Customers, conversations, rates, evaluation inputs and transaction examples are imaginary. There is no claim of real-user validation or observed business savings.

## What works

- Text and private screenshots; saved requests, editable multiline specifications, source evidence and explicit human confirmation.
- Local Gemma 4 extraction through Ollama, a durable PostgreSQL job queue, leases, bounded retries and protection against stale results. Manual quoting works without the model.
- Deterministic INR pricing for cards, flyers, area-priced banners and owner-priced custom jobs. Quantity tiers, stock upgrades, finishing, minimum/setup charges, reasoned adjustments, tax and deposits use integer paise with decimal half-up rounding.
- Frozen, versioned quotations; print/copy, expiry, manually recorded acceptance and one resulting production job. Accepted commercial terms cannot be revised.
- Artwork approval before printing; production stages, cancellation history, receipts, refunds, corrections, overpayment credit and outstanding balances. These record off-platform actions; the app does not send messages or move money.
- Customer history/repeat requests, rate simulation/publication, reports, isolated sample shops, private owner accounts, export and raw-source retention.
- Responsive paper-and-ink interface, self-hosted type, light/dark themes, keyboard-accessible dialogs, recoverable draft edits and paged searchable lists.

## Start locally on Windows

Prerequisites: Python 3.11, Node.js 22, PostgreSQL 18 binaries. Ollama with `gemma4:e4b` is optional for manual use. The verified laptop uses `C:\Program Files\PostgreSQL\18\bin` and `D:\ollama\bin\ollama.exe` with existing models in `D:\ollama\models`.

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
.venv\Scripts\python.exe -m pip install --no-deps -e backend
npm --prefix web ci
.\scripts\dev.ps1
```

Open **[http://localhost:5175/](http://localhost:5175/)**. The launcher reuses live services and starts missing services in hidden processes. Logs are in `.data/logs`; closing the command does not intentionally stop the services. Change `-OllamaExe`, `-ModelsDir`, or `POSTGRES_BIN` for your installation. Use Settings → Account to create a clean private shop; a fresh sample starts with fictional customers and one request.

Local setup creates a separate cluster/database under `.data/postgres`, listening only on `127.0.0.1:55432`. API: `8767`; frontend: `5175`; model: `11435`. Random credentials are written to ignored `.env`. Keep `.env`, `.data`, backups and model files private. This setup does not modify another project's database.

Restart the worker after changing worker/provider code; only the API and frontend watch files automatically. The readiness endpoint `/api/v1/ready` checks the database; model availability is shown separately because quoting does not depend on inference.

## Architecture and boundaries

React/TypeScript + FastAPI modular monolith + PostgreSQL 18. The runtime database role is neither a superuser nor an RLS bypass role. Transaction-local shop scope and composite tenant foreign keys protect business records. Authentication uses Argon2 passwords and opaque, hashed, expiring HttpOnly session cookies. The owner-only pilot has no employee invitation service.

The AI sees untrusted source material and an extraction schema, never pricing authority or tools. Its output remains unconfirmed and is stored separately until a person applies it. Literal text evidence is checked against its source; screenshot evidence remains explicitly unverified. Image decoding, size/pixel limits, metadata removal and tenant-scoped private reads happen outside the model.

API lists use bounded cursor pagination and server-side search. Reports aggregate in PostgreSQL, and list-page related records are fetched in batches. These are foundations for growth, not proof of the design capacity target.

The [independent review and fixes](docs/reviews/2026-10-16-core-review.md) record the final review findings and reproductions.

See the [accepted design](docs/superpowers/specs/2026-10-16-chhaap-design.md) and [implementation plan](docs/superpowers/plans/2026-10-16-chhaap-core.md). Branch policy for this project: milestone commits and pushes go to **main**.

## Verification and evaluation

```powershell
.venv\Scripts\python.exe -m pytest backend/tests -q
.venv\Scripts\python.exe -m ruff check backend
npm --prefix web test
npm --prefix web run build
.venv\Scripts\python.exe scripts/evaluate.py --resume
.venv\Scripts\python.exe scripts/load_smoke.py
```

Integration tests require a distinct `chhaap_test*` database through `TEST_DATABASE_URL`; the test harness refuses an unconfigured production database. Tests exercise real PostgreSQL RLS, races, quote/payment rules, stale worker completion, expired leases and cleanup. External inference is evaluated separately rather than replaced by a fake model in a benchmark. GitHub Actions defines backend, client and build checks.

The resumable schema-v1 evaluation has **60 labelled fictional cases**: 20 clear, 15 incomplete, 10 corrections/conflicts, 10 synthetic screenshot inputs and five adversarial/unsupported inputs. Expected quantity/paper/product values are independent annotations. See [fixtures](eval/fixtures.json), [per-case outputs](eval/results.jsonl), [measured summary](eval/summary.json), and [group/baseline analysis](eval/analysis.json). Schema-v2 screenshot follow-ups are recorded separately in [screenshot-v2-smoke.json](eval/screenshot-v2-smoke.json); the full 60-case v2 benchmark has not been rerun. A partial summary is a running measurement, not a completed accuracy result. Screenshot cases use rendered English text, including blur; they do not establish performance on real phone screenshots, handwriting, bad crops or multilingual image text. Broader field coverage and independent real-user validation remain necessary.

The [live smoke trace](eval/live-smoke.json) records an actual warm extraction of 500 matte cards on 350 GSM in 23.86 seconds on this laptop. The [load smoke](eval/load-smoke.json) records 200 ordinary API calls with eight clients against 1,000 synthetic requests/quotes/orders in an isolated sample shop. It excludes inference and does **not** validate the design target of 100,000 quotes across 100 shops with 20 concurrent clients. Timings depend on the machine and other concurrent work.

## Retention, export and backups

Raw messages and screenshots expire after 30 days by default (Settings: 1–365 days). The launcher runs cleanup daily; Settings → Clean up expired sources runs it immediately for the current shop. Cleanup removes expired sources and their stored extraction results, invalidates in-flight work, and keeps reviewed business specifications, quotations and ledger history. Run `python -m chhaap.retention` for an operator-triggered pass. Files already copied into backups or exports require a separate deletion policy. Evidence review becomes unavailable when the original is removed.

Settings exports business records as JSON, without credentials or screenshot bytes. Unsaved editable fields use tab-scoped browser storage for navigation recovery; raw messages and AI outputs are excluded. Private sign-out clears that tab storage.

```powershell
.venv\Scripts\python.exe scripts/backup.py --verify
```

This creates an ignored `.data/backups/<timestamp>/shop.dump` and `media.zip`, then restores the dump into a **new** `chhaap_test_backup_*` database and compares business row counts. It never overwrites or drops the active database. For a consistent operational backup, pause writes and the worker during backup, protect both files, and verify the restored attachments as well. The included smoke verified database restoration on the local installation. Production restore/cutover and backup scheduling require an operator; do not copy an active PostgreSQL data directory.

## Deployment preparation

**Vercel:** root-level `vercel.json` builds `web/` and serves SPA routes. Set the Vercel project Root Directory to the repository root. The shared [chhaap-ruby.vercel.app](https://chhaap-ruby.vercel.app/) initially returned `404 NOT_FOUND`; after the main-branch configuration update it served the frontend with HTTP 200, while `/api/v1/health` remained 404. Without API routes the frontend offers a clearly labelled read-only visual preview, using actual fictional-workspace screenshots. `/preview` opens that view explicitly without creating a shop session. It does not submit business data or simulate live business actions. A frontend-only build cannot run the durable worker, PostgreSQL, private media or this laptop's Ollama. Host those separately and add a same-origin `/api/*` reverse proxy to that backend before treating a Vercel build as a functional hosted application. Never expose the local database/model ports. [Vercel build configuration](https://vercel.com/docs/project-configuration/vercel-json).

**Containers:** `compose.yaml` and Dockerfiles provide a same-origin web/API setup, migration dependency, restricted DB role, persistent media/database volumes and a daily retention process. Set strong URL-safe `POSTGRES_PASSWORD` and `APP_DB_PASSWORD` values in `.env`, then run `docker compose up --build -d` instead of the native launcher, since both use frontend port 5175. The model URL defaults to `host.docker.internal:11435`; verify host reachability from the worker or configure a private model service. The model port must stay private. Container execution is **not yet verified here** because the Docker Desktop Linux engine was unavailable. PostgreSQL 18 uses the `/var/lib/postgresql` volume layout. [Official image documentation](https://hub.docker.com/_/postgres).

Before public use: TLS with `COOKIE_SECURE=true`, trusted frontend origin, private object storage shared across API/worker replicas, scheduled backups, auth abuse controls, tenant storage/inference quotas, observability and the full scale benchmark. The current media adapter is local disk and is not suitable for ephemeral serverless storage. Account recovery/email verification, employees, share links, messaging, inventory, branches and subscription billing are future work. The local-only pilot should not be presented as a hardened public multi-tenant service.

## Community Wisdom

The modular backend keeps pricing and business workflows together while isolating the long-running model worker. This follows the practical, gradual scaling direction described in [From Monolith to Modular Monolith to Microservices: Realistic Migration Patterns](https://dev.to/sepehr/from-monolith-to-modular-monolith-to-microservices-realistic-migration-patterns-36f2) by Sepehr Mohseni. This is architectural context, not evidence of this app's performance.

## License

Application code: MIT. Model weights are not included; their own license applies.
