# Workspace memory

Persistent, workspace-isolated memory for DeepSeek Harness, with explicit approval and request transparency. The local bundle targets DSH `0.2.0-rc.2` and registers Host and Web Client plugins.

## Using memory

Open **Workspace memory** in the sidebar, or **Memory** in a conversation header to open that session's workspace and controls.

- Create a memory, choose its type, and **Save & approve** for future reuse. **Save as suggestion** keeps it out of requests until you approve it.
- Browse or search by title/content, status, or type. Select an entry to edit, pin, enable/disable, or exclude it from the current session.
- Optional expiry uses an ISO timestamp in UTC. A replacement suppresses the original only after approval and while eligible.
- Expand **Source & revision history** for provenance, earlier content, and restore-as-suggestion. Restoring never silently approves an old version.
- **Delete** is always visible in the selected memory's action row, and every row in the list carries its own delete control. Either route opens the same confirmation card — nothing is removed until you confirm, and confirmation states plainly that deletion also removes the revision history. The **Replacement** section marks a memory superseded instead of deleting it.
- Expand **Memory settings** to configure automatic injection, assistant suggestions, and the context budget. Save changes explicitly. Session settings can override workspace defaults or reset to them.
- **Context preview & activity** exposes selection reasons, revisions, budget omissions, and recent request records.
- **Remember…** on an assistant reply opens the same editor with a link to that reply. It does not automatically copy or approve assistant content.
- Switch **Workspace** to **Global · all workspaces** to keep something that applies to every project: a writing style, tone, or a stable fact about you. Global entries accept only Preference and Fact types — project decisions and working context stay in their workspace — and they join every project's requests. Pin one to include it in every request rather than only matching ones. A project entry overrides a global entry when the two conflict.

Conversation requests such as “Remember: use pnpm for this project” authorize a conversational write. Correction and deletion require explicit user intent and optimistic revision checks. Retrieved/quoted text cannot grant that authorization. Unsolicited assistant suggestions remain proposed until approved.

## Request disclosure

Chat shows a compact **Memory** disclosure per turn. Empty selections are summarized once, rather than as repeated zero-character rows. Expand it to review a bounded, scrollable step-by-step log, selected IDs/revisions/reasons, and omissions. “Started” means a model invocation began; it is not a delivery receipt.

Only approved, enabled, unexpired, nonexcluded records are eligible. Global records are eligible in every workspace; excluding one by id still removes it for that session or workspace. Pins take priority but still respect the exact serialized-context budget. Each rendered entry states its scope, and a project entry overrides a global entry when the two conflict. Disabling or deleting an entry cannot retract earlier requests or source conversations.

## Privacy and boundaries

The DSH storage domain `workspace_memory` stores records, revision history, settings, and usage metadata in the active profile. Every record is keyed by registered workspace identity. Conversational ownership follows the executing session, not the workspace currently selected in the sidebar. Global records use a reserved global key that no workspace can hold, so the two scopes can never read each other's records, and the global API path accepts no workspace or session input at all. Turning memory off for a workspace stops global injection there too, because context is assembled per workspace.

The browser API requires the Harness authentication boundary and local same-origin POST requests with a custom header. Memory is not encrypted by this plugin. Approved, selected text becomes context sent to the session's configured model provider; the plugin itself adds no embedding-provider transmission.

## Retrieval status

Ranking is hybrid and local. Deterministic keyword matching always runs, and when **Find memories by meaning** is on, eligible memories are also ranked by cosine similarity from a **local** embedding model through a loopback-only endpoint. Global and workspace records share one ranked list and one budget; pins come first, then score, with a project entry ahead of a global entry on a tie. Any non-loopback endpoint is refused, so memory text and queries never leave this machine. If the model or service is unavailable, retrieval falls back to keywords, enters a short cooldown, and the request disclosure says so per step.

The default backend is Ollama with `nomic-embed-text:v1.5` on `http://127.0.0.1:11434`, overridable with `WORKSPACE_MEMORY_EMBED_ENDPOINT` and `WORKSPACE_MEMORY_EMBED_MODEL`. Vectors are cached in memory and keyed by workspace, record ID, and revision, so an edited memory never reuses a stale vector; they are recomputable rather than authoritative and are not stored in the durable domain.

Measured limits matter here: on the authored diagnostic corpus the hybrid path reached 8/8 exact, 8/8 concise-paraphrase, and 4/4 natural-paraphrase recall. The default **Relevance threshold** is 0.55, calibrated on 2026-10-05 — unrelated queries top out at 0.5409 cosine on a real project corpus while the weakest relevant match scores 0.5754, and 0.55 was the only swept value with zero unrelated selections and full top-1 recall (0.50 admitted 2 of 10). Raise it for precision, lower it for recall, or turn meaning search off. See [the evaluation](SEMANTIC-EVALUATION.md) for both sweeps and the remaining gaps — long memories are embedded from a bounded prefix rather than chunked, and there is no durable cross-session index.

## Install

Requires DeepSeek Harness `0.2.0-rc.2`.

Add the bundle to your profile through the plugin manager, using the spec:

```
github:TheSethRose/dsh-workspace-memory
```

With the `dsh` CLI on PATH the same install is:

```sh
dsh plugin --profile desktop add github:TheSethRose/dsh-workspace-memory
```

Then enable `dsh-workspace-memory` and refresh the Harness page to load the panel.

The generated runtime artifacts (`runtime-<hash>.mjs`, `core-runtime-<hash>.cjs`, `embeddings-runtime-<hash>.cjs`, `cordis.patch.yml`) are committed, so a git install needs no build step and no pnpm `allowBuilds` entry. Memory is stored in the profile's `workspace_memory` storage domain, keyed by registered workspace, and global entries use the reserved `global` key.

Semantic search is optional and stays local. It needs Ollama serving `nomic-embed-text:v1.5` on `http://127.0.0.1:11434`; without it, retrieval falls back to keyword matching and the request disclosure says so. Override with `WORKSPACE_MEMORY_EMBED_ENDPOINT` and `WORKSPACE_MEMORY_EMBED_MODEL`. Non-loopback endpoints are refused.

## Development and activation

From this directory:

```sh
node build.cjs
node --test core.test.js integration.test.cjs client.test.cjs embeddings.test.cjs build.test.cjs
node retrieval-evaluation.cjs
node nomic-embedding-evaluation.cjs
```

`build.cjs` hashes the generator and every implementation file (`build.cjs`, `host.mjs`, `core.js`, `embeddings.js`, `client.js`), writes a content-addressed Host entry `runtime-<hash>.mjs`, writes physical per-revision copies of the CommonJS helpers (`core-runtime-<hash>.cjs`, `embeddings-runtime-<hash>.cjs`), and points the bundle patch at that entry. Node caches CommonJS by resolved path, so the helper copies — not the Host query string — are what keep a rebuild from running stale code. Each build prunes the previous revision, so the directory keeps exactly one. Run `node build.cjs` after any source edit; `build.test.cjs` fails when the committed artifacts fall behind the sources. The Client is a prebuilt ModuleLoader module; this bundle does not depend on an application-shell watcher. Refresh the existing Harness URL after activation to load Client changes. Do not start a replacement Vite server.

Toggle the exact installed bundle through the plugin manager after a build; that reload is enough for Host, core, embeddings and Client changes, so no Harness restart is needed. The HTTP route and the Inspect provider are registered as Cordis effects so disabling/re-enabling releases them cleanly.

Tests cover durable CRUD and optimistic revisions, workspace ownership, approval/source/history rules, injection and budget gates, suppression, request disclosure, HTTP authentication/CSRF, session settings, preview, route disposal, compact disclosure rendering, hybrid ranking gates, and the embedding transport (prefixes, batching, cache invalidation, truncation, malformed responses, and loopback refusal) using a stubbed fetch so no test contacts a service. Component-contract tests are lightweight mocks; live browser checks additionally verified desktop/mobile rendering, both theme contrasts, keyboard focus, and a disabled synthetic approval/restore/delete fixture with no residual test records.

## License

MIT — see [LICENSE](LICENSE).
