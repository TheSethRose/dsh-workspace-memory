# Workspace memory semantic retrieval evaluation

## Decision and delivery status

**Semantic retrieval was warranted, was authorized, and is now delivered as an optional local hybrid path.** The original lexical baseline missed most low-overlap paraphrases; that gap is the reason this work existed. Improving token boundaries or stop words would have reduced noise but would not have implemented semantic retrieval, so a real embedding backend was added instead.

**Resolved deployment constraint:** the user authorized searching for an existing local model and, when none was suitable, approved the local download **`nomic-embed-text:v1.5`** (274 MB, Ollama, loopback only). No memory text leaves the machine; there is no remote embedding provider, and the adapter refuses any non-loopback endpoint.

This document therefore reports three things separately and honestly: the original lexical baseline, the measured behavior of two candidate local models, and the delivered hybrid path with its real, still-imperfect precision.

The initial baseline added only this document and [retrieval-evaluation.cjs](./retrieval-evaluation.cjs). The model search added an offline Swift probe, a Node evaluation harness for both candidate models, and their raw results. The delivered implementation added [embeddings.js](./embeddings.js), [embeddings.test.cjs](./embeddings.test.cjs), optional hybrid scoring in [core.js](./core.js), async orchestration and settings in [host.mjs](./host.mjs), and semantic controls and disclosure in [client.js](./client.js).

## Delivered hybrid retrieval (current status)

The approved local model **`nomic-embed-text:v1.5`** (Ollama, 274 MB, 768 dimensions, loopback `http://127.0.0.1:11434`) is now wired into the plugin as an **opt-in, on-by-default-for-new-settings** meaning-based ranking path. Delivery distinguishes four states and never overstates them:

1. **Lexical path** — complete and unchanged, and still the fallback.
2. **Semantic adapter** — implemented in [embeddings.js](./embeddings.js): role prefixes (`search_document:` / `search_query:`), batching, bounded in-memory revision-keyed cache, strict response validation, and refusal of any non-loopback endpoint.
3. **Local backend** — configured and verified on this machine, exposed read-only in the settings card.
4. **Semantic benchmark** — measured on the authored diagnostic corpus, below.

[core.js](./core.js) accepts optional `semanticScores` (`{id, revision, score}`) and applies a documented additive hybrid score: `lexical + 4 × distinctKeywords × cosine`, only for scores strictly above `semanticThreshold` (default 0.5) whose `revision` matches the current record. Pins still rank first, and the exact ASCII frame budget, limit, overflow, approval, expiry, enablement, and supersession gates are unchanged. `eligibleRecords()` is exported so asynchronous scoring never sees ineligible records.

Request-time orchestration happens in the `system-prompt/assemble` waterfall, which is the first hook that permits asynchronous work; the synchronous context provider still supplies the lexical text so a slow or missing service can never block or empty a prompt. Failures enter a 30-second cooldown, fall back to keywords, and are disclosed as `fallback`.

### Production hybrid measurement

`node --test` plus a live run against the local service on the same authored corpus (8 records, 20 queries, 5 unrelated negatives, threshold 0.5):

| Query group | Cases | Recall@20 | Top-1 |
| --- | --- | --- | --- |
| Exact | 8 | 8/8 | 8/8 |
| Concise paraphrase | 8 | 8/8 | 8/8 |
| Natural paraphrase | 4 | 4/4 | 3/4 |
| Unrelated negative queries selected | 5 | — | 2/5 selected |

This clears the previously proposed engineering gate (≥7/8 concise-paraphrase recall, ≥6/8 top-1, 8/8 exact) for paraphrase recall and top-1, and top-1 for natural paraphrases except one case. **The negative-query result does not clear the gate**: two unrelated questions still returned records, and natural paraphrases pull in many extra records. The corpus is small and authored, not a random sample, so this is a diagnostic, not an accuracy claim.

Known limits, stated plainly: precision is weaker than recall (`natural-paraphrase` selections can include most of the corpus), one negative query crossed the threshold, the model window is limited and long records are embedded from a 6,000-character prefix rather than chunked and merged, and vectors live in memory so the first request after a restart re-embeds the workspace. Raise the threshold for precision, lower it for recall, or turn meaning search off entirely; the settings card exposes all three choices per workspace or per session.

## Installed local-model search and the Apple benchmark

Read-only checks before the download found:

- Ollama CLI is installed, but no Ollama listener was present. Its `OLLAMA_MODELS` override points to `/Volumes/Models`, which is currently absent; the normal manifests directory is absent too. Models could exist on a disconnected volume; this is not a claim that none exist anywhere.
- LM Studio CLI is installed but could not find/connect to a valid running installation. Its normal model cache exposed a speech-model configuration, not an embedding model. Normal Hugging Face/fastembed caches were absent.
- Apple's built-in `NaturalLanguage.NLEmbedding.sentenceEmbedding(for: .english)` **is available locally**, revision 1, with 512 finite dimensions. The probe calls no asset-download or network API, and processed only authored synthetic text.

[apple-embedding-probe.swift](./apple-embedding-probe.swift) performs real offline inference. [apple-embedding-evaluation.cjs](./apple-embedding-evaluation.cjs) reuses the original corpus and queries, adds five unrelated negative queries, and ranks cosine similarities. [Actual results](./apple-embedding-evaluation-results.json) contain the complete rankings and threshold sweep. Run:

```sh
node workspace-memory/apple-embedding-evaluation.cjs
```

Observed on this machine: 33 texts took **123.8 ms of measured vector inference**, with **1,531 ms total process time including Swift startup/compilation/model initialization**. These are single-run batch measurements, not production latency guarantees.

| Cosine threshold | Exact recall / top-1 (8) | Concise paraphrase recall / top-1 (8) | Natural paraphrase recall / top-1 (4) | Negatives selected (5) |
|---|---|---|---|---|
| 0.25 | 8 / 5 | 8 / 4 | 4 / 2 | 3 |
| 0.35 | 7 / 5 | 7 / 3 | 1 / 1 | 1 |
| 0.45 | 7 / 5 | 4 / 2 | 0 / 0 | 0 |

This is semantic-only ranking, **not the production hybrid implementation**. The exploratory threshold sweep is not held-out validation. The Apple model failed the proposed 6/8 concise-paraphrase top-1 gate at every threshold; higher thresholds also lost most relevant queries. It is an existing usable offline vector source, but **not recommended as the default memory backend** based on this diagnostic.

**Chosen model:** the installed Ollama runtime with [`nomic-embed-text:v1.5`](https://ollama.com/library/nomic-embed-text), **274 MB**, downloaded and verified locally on this machine after user approval. The configured `OLLAMA_MODELS` pointed at an unavailable external volume (`/Volumes/Models`, and the real models symlink pointed at `/Volumes/T7 Storage`, neither mounted), so the environment now uses `$HOME/.ollama/models`; the broken symlink is preserved as `~/.ollama/models.symlink-to-T7.bak`. 768-dimensional, finite vectors were confirmed, and the search/document task prefixes were confirmed against the model card.

Native semantic-only ranking was measured for this model too ([nomic-embedding-evaluation-results.json](./nomic-embedding-evaluation-results.json), `node nomic-embedding-evaluation.cjs`), but the graded, delivered result is the **production hybrid** measurement in the first section, which is what actually runs. The integration exercises real request-time orchestration, verified live: three paraphrases that returned nothing under lexical search (`statically typed JavaScript`, `relational persistence backend`, `Excel workbook output`) now select the correct memory with reason `semantic`, while `volcanic seismology` still returns nothing.

Long records are embedded from a bounded 6,000-character prefix with the title first, because a memory can hold 32,000 characters while the model window is far smaller; chunk-and-merge was deliberately not attempted, and this is recorded as a precision limit rather than hidden.

## Inspected baseline

- [core.js](./core.js#L202-L230): `retrieve` lowercases query words, scores each distinct word by substring presence (+3 in title, +1 in content), accepts positive-score records or pins, then sorts pins first, score descending, ID ascending.
- The same function first enforces one workspace, confirmed status, enabled flag, and strictly future expiry, and applies supersession using eligible records. The exact ASCII-encoded [renderContext](./core.js#L195-L200) output is budgeted, including framing, with deterministic overflow reasons. Default budget is 8,000 characters and default limit is 20; characters are not a model-specific token budget.
- [core.test.js](./core.test.js) covers CRUD isolation, revisions, explicit approval/reapproval, supersession, expiry, pins, exact context budget, JSON framing, invalid input, and storage failures.
- [package.json](./package.json) at inspection was `dsh-workspace-memory` 0.1.1, CommonJS core with ESM host, `zod` as its only direct dependency, and DSH peers at 0.2.0-rc.2. It declares no embedding dependency or model asset. This metadata does not establish whether the running host has a suitable separately configured provider; that needs explicit verification before implementation.

## Reproducible actual lexical benchmark

Run from workspace root:

```sh
node workspace-memory/retrieval-evaluation.cjs
node --test workspace-memory/core.test.js
```

Executed successfully on Node v24.0.1; both commands exited 0. Core tests: **9 passed, 0 failed**. The script uses the exported `MemoryStore`, explicitly approves each fixture, and invokes the real exported `retrieve`; it does not reimplement scoring. Clock is fixed at `2026-01-01T00:00:00Z`. Main ranking cases use one workspace, eight unpinned records, limit 20, and 8,000-character budget, avoiding a pin or budget masking the recall result.

This is a small, deliberately authored diagnostic corpus, not production user memories and not a random statistical sample. It tests common memory paraphrases and adversarial substring noise; general population accuracy cannot be inferred. No external service receives data. The complete fixture text, queries, scores, and result lists are printed by the script.

### Fixture corpus

| ID | Title | Content |
|---|---|---|
| style | Concise responses | Prefer brief answers without lengthy explanations. |
| language | TypeScript implementation | Use strict types for application code. |
| storage | Database choice | Persist durable records in PostgreSQL. |
| privacy | Offline processing | Keep confidential documents on this machine; avoid external transmission. |
| timezone | Scheduling timezone | Interpret appointments using America/Chicago. |
| testing | Regression coverage | Add automated tests for bug fixes. |
| format | Spreadsheet deliverables | Supply financial tables as XLSX files. |
| approval | Destructive operations | Obtain explicit confirmation before deleting data. |

### Observed results

Recall here means the intended record occurs anywhere in the selected list; top-1 means first place. MRR is mean reciprocal target rank, with absent targets contributing zero. The eight concise paraphrases plus four natural paraphrases together yield recall **4/12 (33.3%)**, top-1 **1/12 (8.3%)**; exact anchors are a separate control.

| Group | Cases | Recall | Top-1 | MRR |
|---|---:|---:|---:|---:|
| Exact lexical anchors | 8 | 8/8 (100%) | 8/8 (100%) | 1.0000 |
| Concise paraphrases | 8 | 1/8 (12.5%) | 0/8 (0%) | 0.0625 |
| Natural-language paraphrases | 4 | 3/4 (75%) | 1/4 (25%) | 0.3542 |

All exact anchors return only their intended target: `concise responses`, `TypeScript`, `PostgreSQL`, `offline processing`, `America/Chicago`, `regression coverage`, `spreadsheet deliverables`, `destructive operations`.

| Paraphrase query | Intended ID | Actual selected IDs in rank order | Target rank |
|---|---|---|---:|
| terse replies | style | none | absent |
| statically typed JavaScript | language | none | absent |
| relational persistence backend | storage | none | absent |
| never upload sensitive material | privacy | none | absent |
| Central US clock | timezone | language, timezone | 2 |
| verify repaired defects automatically | testing | none | absent |
| Excel workbook output | format | none | absent |
| ask permission prior to erasure | approval | testing | absent |
| How should you answer me? | style | timezone, language, privacy, style | 4 |
| Which language should we use? | language | language, style | 1 |
| Where should our app save information? | storage | language, timezone | absent |
| Can you send my private material to a cloud service? | privacy | testing, approval, format, language, storage, privacy, style, timezone | 6 |

The single concise-paraphrase hit is incidental: `US` matches `Use` and `using`. `to` matches `automated` and retrieves `testing` for the erasure query. `me` matches `timezone`, `implementation`, and `appointments`, outranking the actual answer-style record. `a` matches widely, causing the private-material question to include every record. These are substring artifacts, not semantic understanding. Removing stop words and using token boundaries is worthwhile independently, but synonyms such as `terse replies` still require a semantic mechanism.

Additional script assertions passed: irrelevant `volcanic seismology` selects nothing; a confirmed eligible pin is included with score zero; proposed/rejected/disabled/expires-at-now/superseded fixtures are excluded even when pinned and exactly matching; a one-character budget overflows the pin rather than forcing it in; mixed workspaces throw. Main cases assert exact rendered budget accounting.

## Operational backend options

| Option | Concrete implementation direction | Privacy, cost, downloads, and limitations |
|---|---|---|
| In-process local embeddings | Add an explicitly approved inference runtime, e.g. a supported ONNX/transformer runtime, and a pinned sentence-embedding model with documented pooling, tokenizer, dimensions, and query/document prefixes. A small English model or a multilingual model must be chosen according to workspace languages. | No memory/query network transfer after verified local assets are present. Package and model downloads still contact distribution hosts and need approval; do not hide first-run downloads. Assets can range from tens to hundreds of MB or more depending on model/quantization; measure the chosen artifact instead of claiming an exact size now. CPU/RAM/startup latency, native architecture compatibility, licensing, cache location, and packaging need testing. Larger/multilingual models may consume substantially more resources. |
| Explicit local embedding service | Connect to a user-selected loopback/local service with a selected embedding model already installed. Confirm address, API shape, pooling behavior, and readiness. | Avoids bundling an inference runtime, but depends on service availability and preinstalled/downloaded model. Loopback is preferable; LAN or forwarded endpoints are not automatically private. Never launch a service, pull weights, or assume any chat model also produces suitable embeddings. No usage-based remote fee, but compute/disk cost remains. |
| Configured provider embedding API | Select an existing authorized provider credential reference only after verifying an embeddings endpoint and exact model; implement a dedicated adapter, bounded batches, timeout, retry limit, and response validation. An OpenAI-compatible `/embeddings` shape is one possible API, not a universal provider capability. | Sends approved current titles/content for initial indexing and changed records later, plus retrieval queries on requests. Provider retention, logging, geography, endpoint trust, and credential handling require review. Charged by the selected provider's actual pricing/unit; no dollar estimate is justified without the model/rate. Requires network, introduces latency/rate limits, and provider outages. No model download required. Reusing credentials must not imply permission to reuse data for this purpose. **Not used**: the delivered backend is the loopback-only local option below, and the adapter rejects non-loopback endpoints. |

**Chosen delivery:** the *explicit local embedding service* option, with Ollama on loopback and `nomic-embed-text:v1.5`. The in-process local runtime option was also evaluated first: Apple's built-in `NLEmbedding` requires no download and is installed, but its ranking was materially worse than the chosen model on the same fixtures.

For a small workspace, exact cosine scan over normalized vectors is practical and avoids adding a vector database prematurely. Storage for float32 vectors is approximately `records × dimensions × 4` bytes before metadata/index overhead: 1,000 records at 384 dimensions is 1,536,000 bytes (~1.46 MiB). Chunking multiplies this count. This is a design estimate, not a measurement of installed assets.

Remote billing can be planned as initial document input tokens + changed-document tokens + uncached query tokens, priced using the chosen endpoint's rate. Bound document bytes/tokens, batches, cache size, and concurrency; never send complete history just to build an index. Local downloads and remote processing are distinct authorizations from record confirmation.

## How the delivered implementation maps to this design

The section below was written before implementation as a required design. The delivered work satisfies items 1–3 and 6–8 in reduced form, and item 4–5 in part. Kept deliberately visible so the remaining gaps are not mistaken for completeness:

| Design requirement | Status |
| --- | --- |
| One-workspace, confirmed, enabled, unexpired eligibility before scoring | **Met** — `eligibleRecords()` is called before any embedding, and again inside `retrieve`. |
| Never embed pending suggestions | **Met** — `eligibleRecords()` excludes non-confirmed records before the batch is built. |
| Invalidate on revision change; never reuse a stale vector | **Met** — the cache key is workspace + id + revision; a mismatched `revision` in `semanticScores` cannot score, and edits re-embed. |
| No cross-model comparison | **Met** — the cache is in-process per configured model, and the model name is recorded in disclosure. |
| Semantic candidates outside lexical positives | **Met** — optional `semanticScores` create zero-overlap candidates; verified live. |
| Pins first, same limit and exact frame budget | **Met** — unchanged pin ordering and the original exact ASCII-frame packing. |
| Bounded, failure-safe execution with lexical fallback | **Met** — timeout, 30 s cooldown, explicit `fallback` disclosure, no failed request. |
| Reject nonfinite/wrong-shape vectors and non-loopback endpoints | **Met** — `embeddings.js` validates both, with tests. |
| Diagnostics distinguish lexical/semantic/hybrid/fallback | **Met** — per-step `retrieval` appears in the disclosure log. |
| Workspace-and-model-scoped, clearable index | **Partial** — vectors are bounded and workspace/revision keyed but held in memory only; they are lost on restart and are not a durable derived table. |
| Calibrated threshold plus held-out, consented validation set | **Partial** — threshold is user-adjustable and measured on one authored corpus; there is no held-out set, and 2/5 negatives still selected records. |
| Chunk-and-merge for long records | **Not implemented** — a 6,000-character prefixed window is used instead; the tail of a very long memory does not influence similarity. |
| Durable cross-session vector index and rebuild/clear controls | **Not implemented**. |

## Historical design notes (written before implementation)

1. **Workspace-scoped, optional derived index.** Keep authoritative records/history in `MemoryStore`. Derive entries keyed by workspace identity, record ID, revision, embedding-model fingerprint, preprocessing version, and optional chunk number/content hash. Host-side persistence should use a distinct workspace-scoped table or index namespace; never use a global candidate pool filtered only after ranking. Vectors are sensitive derived information, not anonymous public data. Settings should make mode, model, endpoint, threshold, index state, and rebuild/clear operations visible.
2. **Eligibility is independent of similarity.** Before indexing/transmitting and again immediately before context packing, use the same one-workspace, confirmed, enabled, strictly-unexpired eligibility and eligible-supersession logic as current retrieval. Never embed pending suggestions/history automatically. Similarity cannot approve, restore, revive expired records, override enabled flags, or activate superseding suggestions. A query need not produce any semantic candidate.
3. **Invalidate on authoritative revision changes.** After a successful write, invalidate stale entries for the prior revision; delete vectors on record removal and disable/reject/expiry as appropriate. Approval/content changes enqueue derivation for the currently eligible version. Metadata-only revisions can reuse a matching text hash, but must update and validate the current revision key. Async embedding completion may publish only if authoritative ID/revision/eligibility/model still match. Recheck expiry at retrieval even if a cleanup job has not run. Rebuild on model/preprocessing changes; never compare vectors from different models/dimensions.
4. **Real hybrid candidate generation.** Union lexical matches with semantic neighbors above a model-calibrated cosine threshold, plus eligible pins. Search the entire eligible workspace for semantic candidates, not just lexical positives; otherwise the seven concise-paraphrase misses remain misses. Keep pins first, subject to the same limit and budget (no mandatory budget bypass). Normalize/rank lexical and semantic signals using a documented hybrid rule, e.g. reciprocal-rank fusion after semantic thresholding, with deterministic ID tie-breaks. Keep exact-identifier lexical matches useful. Optional local cross-encoder or bounded approved-provider reranking may improve ordering but adds another runtime/download or transmission/cost; it is not required for the first embedding implementation. Pins should not be demoted by a reranker.
5. **Threshold and negatives.** Calibrate on this fixed benchmark plus a larger held-out, consented workspace-representative set, including unrelated topics, negation, multilingual queries, and near-duplicate/conflicting facts. Do not prescribe a universal cosine cutoff such as 0.7 without a model-specific distribution. Empty queries should preserve current pins/all-eligible behavior rather than embedding an empty string. Abstain on low similarity and distinguish lexical-only fallback from successful semantic ranking in diagnostics.
6. **Reuse safety and packing without disguising retrieval.** Factor shared eligibility and exact framed-JSON selection/overflow packing from the core in a separately authorized implementation change. Current `retrieve` always recomputes lexical scores and excludes zero-overlap unpinned records, so merely ordering its input does not add semantics. Passing semantic candidates with an empty query would also lose the desired ranking because it sorts by pins/ID. Do not rewrite record text or mark semantic candidates pinned to trick the old function. Candidate provenance should report lexical/semantic/hybrid/pinned, relevant score, model and revision, and fallback/error state without leaking credentials.
7. **Bounded and failure-safe execution.** Document token limits and truncation/chunk aggregation policy; long records may require chunks, but select the authoritative record only once. Reject nonfinite vectors, wrong dimensions, mismatched fingerprints, and malformed responses. No background indexing before configuration consent. Avoid remote query caching unless configured; any cache must be workspace/model scoped and clearable. Timeout/outage/missing assets should return the lexical selection with explicit degraded-mode status, not fail the whole request or claim semantic results. Never create a suggestion or confirmation as a side effect of retrieval.
8. **Context semantics stay unchanged.** Keep `renderContext` framing, reference/instruction separation, title/content/source as untrusted data, exact character budget, count limit, and overflow reasons. Embedding similarity is not trust or priority over the current request/system/developer instructions. Clearing an index or disabling retrieval cannot retract content already sent in earlier requests.

## Acceptance criteria results

- Same benchmark against lexical and real hybrid backends: **done** for this corpus — lexical recall/top-1 by group is in the baseline tables, hybrid results are in the first section. Latency and first-index duration were measured for the model ([nomic-embedding-evaluation-results.json](./nomic-embedding-evaluation-results.json)); no isolated p50/p95 query-latency series has been collected, and no provider billing applies because the backend is local.
- Proposed gate of ≥7/8 concise-paraphrase recalls and ≥6/8 top-1 with 8/8 exact anchors: **met** (8/8, 8/8, 8/8). The held-out negative criterion is **not met**: 2 of 5 unrelated queries still selected a record.
- Core safety tests against the hybrid path: **met** — unapproved/expired/disabled/rejected/superseded records, foreign workspaces, exact encoded budget, stale revisions, threshold abstention, malformed scores, and deterministic ranking are covered by the new core tests, and 47 tests pass in total.
- Consent, configuration, and transmission behavior visible before activation: **met** — the download was explicitly approved, the settings card shows the local model and its availability per workspace or session, meaning search can be turned off, and the disclosure names the retrieval mode per step.
- Release status, stated precisely: lexical path complete; semantic adapter implemented and tested; local backend configured and verified on this machine; semantic benchmark measured but its precision and negative-query behavior are **not** validated. Treat meaning search as a useful, adjustable aid, not a solved retrieval guarantee.
