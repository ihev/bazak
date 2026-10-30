# Bazak Shopping Copilot

A local shopping assistant that turns natural-language requests into DummyJSON product searches. Products appear as cards inside chat; conversations and card snapshots survive refreshes and API restarts.

## Run locally

Requirements: Node.js 24 and pnpm 12.6.0. Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set these values in `.env`:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your-assignment-key
OPENAI_MODEL=gpt-5.4-mini
```

Only `gpt-5.4-mini` and `gpt-5.4-nano` are accepted for OpenAI. Gemini is optional: set `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` and an exact `GEMINI_MODEL` enabled for your account. Credentials stay on the backend. Never commit `.env` or put secrets in `VITE_` variables.

```sh
pnpm db:migrate
pnpm dev
```

Open <http://localhost:5173>. The API listens at <http://127.0.0.1:3001/api>; Vite proxies `/api`. `GET /api/health` checks database readability. Migrations are explicit; rerun `pnpm db:migrate` after schema changes. Restart the development server after editing `.env`.

`API_HOST`, `API_PORT`, `WEB_PORT`, `WEB_ORIGIN` and `DATABASE_PATH` are configurable. Relative paths resolve from the repository root; shell variables override `.env`. If changing `WEB_PORT`, update `WEB_ORIGIN` too. Vite reads the shared file for host/port settings without inheriting its `NODE_ENV`; root mode-specific env files are not loaded.

| Command                                                      | Purpose                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `pnpm check`                                                 | ESLint, Prettier, strict TypeScript and production builds       |
| `pnpm build`                                                 | Build all workspace packages                                    |
| `pnpm test`                                                  | Backend integration → browser E2E → backend/frontend unit tests |
| `pnpm test:integration` / `pnpm test:e2e` / `pnpm test:unit` | Run individual suites                                           |
| `pnpm db:generate` / `pnpm db:migrate`                       | Generate/apply Drizzle migrations                               |
| `pnpm format`                                                | Apply formatting                                                |

## Architecture and framework choice

The implementation uses a small custom workflow: one structured planning call followed by deterministic catalog retrieval and response composition. There is no autonomous tool loop. This makes model cost, allowed HTTP operations and persistence boundaries explicit, at the cost of maintaining provider adapters and chat state ourselves.

- `apps/api`: NestJS modules for configuration, database, conversations, chat, products, LLM and logging. Controllers validate requests and delegate; small services coordinate behavior; repositories own SQL. Provider SDKs sit behind one interface. The DummyJSON client handles HTTP/schema conversion, while filtering and ranking are separate functions.
- `apps/web`: React/Vite with CSS Modules. Components, HTTP functions and TanStack Query hooks are separate. Query owns server state, React owns local input, and React Router owns the active conversation URL. No additional state store is needed.
- `packages/contracts`: public Zod schemas and inferred TypeScript types shared across the API and browser. Database records and provider types stay private. Responses use explicit public mappers; a common exception filter returns `{ error: { code, message } }`.

Nest provides module boundaries and constructor injection for integration testing. SQLite/Drizzle avoids a database-server prerequisite for this local assignment. For a shared service, PostgreSQL would be preferable for concurrent workloads; the switch would require schema/migration changes while repositories contain its impact. TypeScript compilation preserves the decorator metadata Nest needs, including in tests.

Alternatives evaluated for this scope:

| Alternative                                                               | Why it was not selected                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LangChain](https://docs.langchain.com/oss/javascript/langchain/overview) | Its model/tool orchestration and middleware are useful for a tool loop. Here the model makes one bounded decision, and the server always executes the same retrieval pipeline. An extra orchestration layer would not remove the custom pagination, price filtering, transactions or retry rules. Reconsider it if multiple tools and iterative planning become necessary.                                                                                                                     |
| [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)                     | Its unified provider API and chat hooks could replace parts of the adapters/UI. This version returns a complete persisted conversation per request and already uses TanStack Query for history and optimistic updates. Adopting its chat state/transport would require mapping our persisted card snapshots and request-ID retries into that model; direct SDK adapters were smaller for this flow. Reconsider it when adding streaming or more providers. It does not require Vercel hosting. |

These are scope tradeoffs, not claims that either library cannot implement the application. Neither alternative was prototyped in this repository.

## Retrieval and conversation flow

1. Save the user message as pending before external work.
2. Give the planner available categories, previous search criteria and the latest 20 completed messages, including previously displayed product names/prices.
3. Validate its structured decision with Zod: search, clarification, capability response or unsupported request. Reject invented categories and invalid price ranges.
4. Execute searches on the server and compose a factual summary from actual results. Persist the assistant response, card snapshots and completed turn together.

Endpoints were selected using the OpenAPI specification supplied with the assignment: `/products/category-list` (cached five minutes), `/products/category/{slug}` for a known category, and `/products/search?q=...` for keyword discovery. `limit=100` and `skip` page through up to 500 candidates per intent before local price/brand filtering and ranking. The API has no documented price-filter parameter, so prices are filtered locally. Results are sorted by price, rating or title relevance with stable ID ties; each group displays up to five cards and marks truncated searches. No embeddings or vector database are needed for this small catalog.

“Something cheap and cool” asks for a product type. A flight request explains catalog scope. Up to three intents become separate groups; more require prioritization. Mixed requests search supported intents and include a scope note. Follow-ups reconstruct applicable constraints; “cheaper” uses an exclusive threshold below the lowest relevant displayed price. No matches produce an empty-result message. Planning can still misunderstand intent; schema validity is not semantic correctness.

Cards use actual catalog titles, descriptions, prices and safe HTTP(S) images, with a missing-image fallback. USD is an application convention because the supplied schema has no currency field; explicit other currencies prompt clarification. Search text is not reused as a claim about inventory or prices.

Application endpoints: `POST /api/conversations`, `GET /api/conversations`, `GET /api/conversations/:id` and `POST /api/conversations/:id/messages`. Sending accepts `{ requestId, content }`, where the ID is a UUID and trimmed content has 1–2000 characters. An unknown conversation returns 404.

## Persistence, retries and failures

SQLite lives at `.data/bazak.sqlite` by default. It stores conversations, ordered messages, search criteria and rendered card snapshots; reopening history does not fetch changed catalog data. Clearing browser storage leaves server history intact. If server-side records are deleted, a refreshed view returns 404. Unsaved local input is lost on reload.

Transactions are short and never span network calls. A request ID deduplicates retries within a conversation; reusing it with different content returns 409. Only one turn can be pending per conversation, and only the latest failed message is retryable. Run one API process: startup marks interrupted pending turns as failed. Multiple workers would need leases or job ownership.

Provider/catalog calls have timeouts, with no automatic paid retries or provider fallback. `LLM_TIMEOUT_MS` defaults to 60000 (maximum 60000); the browser waits up to 120 seconds. Failed turns remain retryable when storage is writable. Optimistic updates reconcile with server state; cached history stays visible during refresh errors, while an authoritative 404 removes it. Switching chats does not put a pending reply into another conversation.

Full, unavailable or corrupt storage produces errors rather than false success or an automatic reset. Corrupt search state in one chat does not prevent listing other chats. For a damaged file, stop the API and restore a backup or explicitly select a new `DATABASE_PATH`; there is no automatic repair. A failed write is not confirmed as saved.

Structured logs go to the console and `.data/logs/api.log`, rotating daily or at 5 MB with seven compressed archives. `LOG_LEVEL=debug` adds diagnostics; `LOG_TO_FILE=false` disables files. File failures fall back to console. Logs allowlist metadata and exclude prompts, message text, credentials and raw provider errors. Correlate events using `X-Request-ID` and `tail -f .data/logs/api.log`. An invalid provider key yields a safe 503 with `LLM_UPSTREAM_HTTP`; internal diagnostics retain the upstream 401.

## Tests and evaluation

```sh
pnpm exec playwright install chromium
pnpm check
pnpm test
```

Minimal Linux installations may require `pnpm exec playwright install --with-deps chromium`. Tests need no credentials or running application: temporary SQLite files use real migrations; external model/catalog HTTP is intercepted with synthetic fixtures. E2E starts separate servers on 39101/39102; override `E2E_API_PORT`/`E2E_WEB_PORT` if occupied. Failed runs retain traces/screenshots in `test-results/`; `pnpm exec playwright show-report` opens the report. Jest uses Node's experimental VM-modules flag for ESM.

| Suite                    | What it verifies                                                                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend integration (22) | Real Nest routing → services → repositories → SQLite; budget/pagination, follow-ups, ambiguous/unsupported/multiple intents, idempotency, concurrent turns, dependency failures, rollback, restart and corrupt/deleted data. |
| Browser E2E (7)          | Actual React input → API → retrieval → rendered card fields; reload, multiple conversations, resumption, refinement, retries, pending-chat switching, network failure and 404.                                               |
| Backend unit (21)        | Price boundaries, matching/ranking, image safety, pagination limits, factual summaries, safe diagnostics and OpenAI SDK serialization/parsing.                                                                               |
| Frontend unit (12)       | Composer keyboard/IME behavior, images, HTTP errors, offline/retry state, stale polling cancellation and cached-history recovery.                                                                                            |

All 62 cases pass. The suites catch regressions in the complete application path, but fixtures do not evaluate real model understanding or external-service availability. Timeout errors are simulated; write failure uses a SQLite trigger, not a full physical disk. Browser coverage is desktop Chromium only; there is no load, hardware-recovery or broad prompt-injection evaluation.

On 30 October 2026, clean installation, repeatable migrations and startup were checked in an isolated source copy. Live Gemini and permitted OpenAI `gpt-5.4-mini` each passed five synthetic prompts: budget, cheaper follow-up, ambiguity, off-catalog and multiple intents; history survived restart. A separate intentionally invalid OpenAI key produced one 401, a safe application error and a persisted retryable turn. This is a small smoke sample, not a model-quality benchmark. No existing user conversations were sent during evaluation.

## Limitations and future work

Local single-user scope: no authentication, checkout, deployment or streaming. Catalog keyword matching misses semantic synonyms; valid plans can still use overly narrow filters. Context is limited to 20 completed messages, three intents, 500 candidates and five displayed products per group. Conversation lists/history are unpaginated. Cold category discovery is needed even for non-search turns. The single-process recovery strategy does not support multiple API workers.

The following is a proposed roadmap, not implemented functionality. Prioritize measured retrieval quality, latency and cost before introducing more infrastructure.

### One additional week

1. **Establish a quality and performance baseline.** Add a versioned set of realistic queries covering ambiguity, brands, synonyms, currency and follow-ups. Record retrieval success, end-to-end/dependency latency, token usage and estimated cost without logging conversations. Use the failures to improve clarification and retrieval. Deliver a reproducible report rather than a claim of universal model accuracy.
2. **Cache repeated catalog reads.** Extend the existing category cache to validated product pages with bounded memory, configurable TTL and shared in-flight requests for identical reads. Key entries by endpoint and canonical query parameters, including pagination. Test expiry, concurrent misses, upstream failures and unchanged historical card snapshots; compare upstream calls and latency against the baseline. Start within one process; Redis is not required for this local version.
3. **Improve delivery and mobile usability.** Add CI for the existing quality checks and test suites. Refine mobile card layout, history scrolling and composer behavior with the on-screen keyboard, then verify the main mobile flows. Keep streaming and database migration outside this week's committed scope.

### Caching boundaries

Cache public catalog data separately from private conversation state. Successful validated pages can be reused across conversations, but prices can change: bound staleness, choose TTL from measured freshness needs and never present an expired price as current. Keep historical card snapshots unchanged. Do not cache provider errors as successful results; empty catalog results can have a shorter TTL. Coalesce concurrent misses so a popular query does not trigger many identical upstream calls. With multiple replicas, consider a shared cache and coordinated refresh, following the [cache-aside pattern](https://redis.io/docs/latest/develop/use-cases/cache-aside/).

Do not cache a whole assistant response by message text alone: “anything cheaper?” depends on history. Request-ID replay already avoids repeating completed turns. Only consider an additional planning cache if measurements justify it, scoped to the user/conversation and keyed by the exact validated input context plus model, prompt and schema versions. Apply access controls and retention limits; cross-user semantic response caching is outside the initial design.

### Analytics, errors and operational metrics

- **Product analytics:** track conversation creation/resumption, completed turns, displayed result groups, clarification, empty results and retries. Measure the funnel from a sent message to rendered results and later refinement; a rendered card alone does not prove user satisfaction. Use explicit feedback to evaluate relevance. Deduplicate events by event/turn ID so refreshes and request retries do not inflate completion counts.
- **Sentry:** add frontend and backend error reporting with release versions, source maps and request/trace correlation. Scrub sensitive data before export, following [Sentry's data-scrubbing guidance](https://www.sentry.help/en/articles/13964268-what-are-sentry-s-data-scrubbing-options). Exclude message text, prompts, model output, request bodies, credentials and sensitive headers from events, breadcrumbs and traces. Keep session replay disabled initially and verify outbound test events before enabling reporting.
- **Technical metrics:** record request/turn throughput, p50/p95 latency, error and timeout rates by dependency, provider 429s, input/output token usage, estimated cost per successful turn, cache-hit ratio and upstream calls avoided. Add queue depth/wait and database pool saturation when those components exist. Use bounded labels such as provider, route template and error class; keep user, conversation and request IDs out of metric labels. Define dashboards and alerts from the measured baseline, including error-rate and spending increases.

Keep product analytics separate from diagnostic telemetry. Define retention, access controls and pseudonymous user/session identifiers, respecting user telemetry preferences. Start with basic metrics and error reporting; deeper analytics and distributed tracing follow shared deployment. None of these integrations are enabled in the current local application.

### Growth beyond the local application

| Trigger                                | Next change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared deployment                      | Add sign-in to identify users and associate each conversation with its owner, making saved history available across sessions and devices. Derive user identity from the authenticated session, scope conversation lists and every read/write to that owner, and test cross-user access denial. Define an explicit migration policy for existing local history. Add per-user request/token budgets, provider concurrency limits, backup/restore verification and secret management before opening access. |
| Growing histories                      | Introduce cursor pagination and matching indexes for messages and conversations; load older messages on demand. Consider context summarization only after evaluating information loss.                                                                                                                                                                                                                                                                                                                   |
| Multiple API replicas                  | Move persistence to PostgreSQL with a bounded connection pool. Preserve unique turn/request constraints and replace startup-wide pending recovery with expiring worker ownership and conditional completion. Use short [database locks](https://www.postgresql.org/docs/current/explicit-locking.html), never transactions held across LLM calls. A replica restart must not fail another replica's active turn.                                                                                         |
| Independent LLM scaling and deployment | Extract the LLM module into an internal service owning provider adapters, prompt/schema versions, credentials, concurrency limits and token/cost metrics. The main API assembles bounded context, validates the returned plan against catalog rules, executes searches and persists turns. Use a versioned request/response contract, service authentication, deadlines and request-ID propagation. The LLM service has no direct access to the conversation database or catalog.                        |
| Repeated reads across replicas         | Add Redis for shared catalog caching if cache-hit and upstream-load measurements justify it. Bound memory/TTL, prevent simultaneous refreshes and allow cache failure without losing conversation history. PostgreSQL remains the durable source of truth.                                                                                                                                                                                                                                               |
| Slow turns or provider quota pressure  | Move turn execution to durable background jobs with atomic job creation, bounded concurrency and queue capacity. Return a turn ID and expose progress through polling or streaming. Use retry backoff and retry budgets for eligible failures, with no automatic cross-provider fallback. Duplicate job delivery must not duplicate saved replies; a crash can still cause a repeated paid model call.                                                                                                   |
| Poor perceived responsiveness          | Add streaming progress/results and explicit cancellation, preserving persisted turn status and reconnect/retry behavior.                                                                                                                                                                                                                                                                                                                                                                                 |

Validate each step with realistic load and failure tests: monitor p95 latency, queue wait, provider 429s, cache-hit ratio, database pool saturation and cost per successful turn. Test worker crashes, expired ownership, cache outages and restore procedures. Keep the modular application together initially. The LLM module is the first planned service extraction when inference needs independent scaling or deployment; keep catalog retrieval and conversation persistence in the main API.

## Demo

Create a chat and ask “Find smartphones under $500.” Inspect the card fields, then ask “Anything cheaper?” Reload, create another conversation, and reopen the first from the sidebar. Finally try “Something cheap and cool,” “Book a flight to Tokyo,” and “Find smartphones under $500 and fragrances under $50.”
