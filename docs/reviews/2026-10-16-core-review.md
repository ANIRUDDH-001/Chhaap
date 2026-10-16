# Chhaap core review and fixes

A fresh, read-only reviewer examined the complete implementation at `badbf6c` against the accepted design and plan. The review found no critical issue and five important defects. This record does not certify public production readiness.

| Finding | Resolution and evidence |
| --- | --- |
| Retry discarded unsaved specifications | Retry now resubmits the saved draft state. A deferred network-boundary client test failed with the old behavior and passes with quantity 1000 preserved. Conflicting revisions keep both versions visible and require an explicit choice. |
| Upload/source responses overwrote newer edits | Upload, append and reorder now reconcile editable fields with new source metadata/revision, clear confirmations and update recovery storage. A deferred screenshot-response test reproduces the race and verifies the following autosave uses the new revision. |
| Float multipliers changed half-up rounding | Multipliers pass through decimal strings. Independent numeric/string fixtures both require 15 paise for 50 × 1 paise × 0.29; the numeric case originally returned 14. |
| Today counts missed older active work beyond page one | PostgreSQL aggregates supply global counts. Action queues filter before limiting. The production board similarly filters active/closed jobs on the server. A real database test inserts 55 newer closed records and verifies the older active job remains visible. |
| Production details omitted accepted print choices | Production, printed quotations and copied quotations now use one formatter for dimensions/units, stock, sides, colour, finishing and owner notes. The production record links to the exact accepted quote. |

Minor findings also addressed: copied quotations use frozen shop/customer identity; payment and production activity display stored notes.

The reviewer did not execute Docker, certify UI/accessibility, rerun database-mutating tests or validate the full scale target. The implementer ran the real PostgreSQL/client suites and built the frontend, exercised the actual local browser workflow, checked 360/768/1024/1440 widths and preserved actual screenshots. Docker's Linux engine was unavailable. Measurements and limitations are recorded under `eval/` and in the README.

The original schema-v1 model evaluation is preserved unchanged. It exposed weak screenshot source references and conflict reporting. Schema v2 constrains evidence to supplied source IDs, names its print-job index explicitly, and normalizes literal GSM suffixes. Its selected follow-ups are separate from the original benchmark; there is no claim that the full v2 corpus has passed.
