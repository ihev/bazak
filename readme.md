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

Endpoints are chosen from the supplied `dummyjson_products_openapi.yaml`: `/products/category-list` (cached five minutes), `/products/category/{slug}` for a known category, and `/products/search?q=...` for keyword discovery. `limit=100` and `skip` page through up to 500 candidates per intent before local price/brand filtering and ranking. The API has no documented price-filter parameter, so prices are filtered locally. Results are sorted by price, rating or title relevance with stable ID ties; each group displays up to five cards and marks truncated searches. No embeddings or vector database are needed for this small catalog.

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

## Limitations and another week

Local single-user scope: no authentication, checkout, deployment or streaming. Catalog keyword matching misses semantic synonyms; valid plans can still use overly narrow filters. Context is limited to 20 completed messages, three intents, 500 candidates and five displayed products per group. Conversation lists/history are unpaginated. Cold category discovery is needed even for non-search turns. The single-process recovery strategy does not support multiple API workers.

With another week, prioritize:

1. A versioned live-query evaluation set for ambiguity, brands, synonyms, currency and follow-ups, recording model accuracy, latency and cost. Improve retrieval using observed failures before introducing embeddings.
2. Streaming progress/results and explicit cancellation, keeping the current durable turn/retry semantics.
3. Paginated history and conversation lists, accessibility/mobile browser checks, and stronger storage-failure tests. For shared deployment, add PostgreSQL, authentication and coordinated turn ownership first.

## Demo

Create a chat and ask “Find smartphones under $500.” Inspect the card fields, then ask “Anything cheaper?” Reload, create another conversation, and reopen the first from the sidebar. Finally try “Something cheap and cool,” “Book a flight to Tokyo,” and “Find smartphones under $500 and fragrances under $50.”
