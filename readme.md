# Bazak Shopping Copilot

A local conversational product discovery app using the DummyJSON product catalog.

## Current checkpoint

Stage 5: the architecture review and automated test suites are complete. The minimal flow includes persisted conversations, in-chat product cards, Gemini and OpenAI adapters, follow-up searches, and retryable failures. A live OpenAI check, the final clean-setup review, and remaining README answers are still pending. See [the assignment compliance and review record](docs/assignment-review.md) for requirement-by-requirement status; this is not yet a final submission.

## Requirements

- Node.js 24
- pnpm 12.6.0

## Setup and run

Run commands from the workspace root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env` before starting the API:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-local-key
GEMINI_MODEL=your-enabled-model-id
```

Use the exact Gemini model ID available to your account. To use the assignment provider instead, set `LLM_PROVIDER=openai`, supply `OPENAI_API_KEY`, and use `OPENAI_MODEL=gpt-5.4-mini` or `gpt-5.4-nano`. The API validates the selected provider configuration at startup. It does not automatically switch providers or retry paid LLM calls.

Then run:

```sh
pnpm db:migrate
pnpm dev
```

Open <http://localhost:5173>. The API runs on <http://127.0.0.1:3001/api>; `GET /api/health` verifies that the migrated database is readable. The Vite development server proxies `/api` requests to Nest.

Never commit `.env` or expose provider credentials using `VITE_` variables. LLM SDKs and credentials stay exclusively in the backend. Migration commands do not require LLM credentials.

`API_HOST`, `API_PORT`, `WEB_PORT`, `WEB_ORIGIN`, and `DATABASE_PATH` can be configured in the root `.env` file. Relative database paths are resolved from the workspace root, regardless of the shell's working directory. If port 5173 is occupied, change `WEB_PORT` and update `WEB_ORIGIN` to match. Environment variables provided by the shell take precedence over `.env`.

## Commands

| Command                          | Purpose                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                       | Build and watch shared contracts; run the API and web dev servers |
| `pnpm build`                     | Build packages in dependency order                                |
| `pnpm check`                     | Run lint, formatting checks, type checks, and builds              |
| `pnpm lint`                      | Run ESLint with zero warnings allowed                             |
| `pnpm format:check`              | Check formatting without modifying files                          |
| `pnpm format`                    | Apply Prettier formatting                                         |
| `pnpm typecheck`                 | Check TypeScript types                                            |
| `pnpm db:generate`               | Generate a migration after changing the database schema           |
| `pnpm db:migrate`                | Apply pending, versioned database migrations                      |
| `pnpm test`                      | Run backend integration, browser E2E, then unit suites            |
| `pnpm test:integration`          | Run Nest HTTP integration tests with a temporary SQLite database  |
| `pnpm test:e2e`                  | Build the API test harness and run Chromium browser tests         |
| `pnpm test:unit`                 | Run backend Jest and frontend Vitest/React Testing Library tests  |
| `pnpm --filter @bazak/api start` | Start the built API                                               |

Database migrations are explicit and are not run automatically at API startup. Run `pnpm db:migrate` after pulling schema changes. Generated SQL migrations and their Drizzle metadata belong in version control; the local database does not.

## Architecture

- `apps/api`: NestJS backend with explicit feature modules. Controllers handle HTTP concerns; services coordinate behavior; repositories own database queries. Configuration, database lifecycle, and HTTP error handling are separate concerns.
- `apps/web`: React and Vite frontend. Feature components, API functions, and TanStack Query hooks have separate responsibilities. React Router owns navigation. Local component state does not need Zustand at this stage.
- `packages/contracts`: public Zod request/response schemas and inferred TypeScript types, built as ESM for the browser and Nest. Database models and provider SDK types stay private to the backend.

The API is compiled with TypeScript's decorator metadata enabled, including during development, so Nest constructor injection behaves consistently in development and built code. The API TypeScript import-style lint exception preserves runtime class references required by decorator metadata.

`ChatService` owns turn persistence and lifecycle; `ChatDiscoveryService` constructs the bounded model context and coordinates catalog discovery. Factual result wording and product ranking/filtering are separate pure functions. Frontend mutation callbacks reconcile optimistic messages with server state; failed sends remain retryable without leaving the composer permanently blocked. Background refresh errors preserve cached history while an authoritative 404 replaces it. Local optimistic messages are not durable until the API accepts them, so an unsent message cannot survive a page refresh during a network outage.

SQLite and Drizzle keep this local assignment easy to run without Docker or a database server. For a future shared service with greater concurrency and operational requirements, PostgreSQL would be the preferred database. Repositories contain the database-specific implementation, but changing databases still requires appropriate Drizzle schema changes and migrations.

Connections enable foreign keys, a busy timeout, and WAL journaling. The database connection is closed during graceful shutdown. Failures do not automatically reset or delete data.

## Conversation flow and retrieval

`POST /api/conversations` creates a conversation, `GET /api/conversations` lists past conversations, and `GET /api/conversations/:id` restores its messages. `POST /api/conversations/:id/messages` accepts `{ requestId, content }`; the client generates a UUID request ID and the trimmed message must contain 1–2000 characters. The response is the updated conversation with text and product groups. HTTP errors use `{ error: { code, message } }`.

The chat service coordinates one structured LLM planning call per new turn. A small provider interface has official Gemini and OpenAI SDK implementations. Zod validates the plan, category names, and price ranges before any search is executed. The planner sees the most recent 20 completed messages, previously shown product names and prices, and the previous complete search criteria. It receives no database or arbitrary HTTP execution capability.

The backend fetches catalog categories from `/products/category-list` and caches them for five minutes. It retrieves candidate products using `/products/category/{slug}` or `/products/search?q=...`, paging with `limit` and `skip`. It examines at most 500 candidates per intent and explicitly marks a truncated result. Price and brand filtering and ranking happen in the backend before taking up to five cards per group. There are no invented price-filter parameters and no vector database or embeddings.

The planner asks for clarification on vague requests, explains off-catalog requests, and can split up to three product intents into groups. Follow-ups carry forward the applicable category, brand, and budget. “Cheaper” uses an exclusive threshold based on previously displayed products. More than three intents require prioritization. Mixed supported and unsupported requests receive a catalog-scope note. Product-result summaries are composed from actual results; product titles, descriptions, images, and prices come from DummyJSON.

Prices are displayed as USD as an explicit application convention: the supplied catalog schema does not include a currency field. Explicit requests in other currencies should trigger clarification rather than an invented exchange rate.

## Persistence and failure behavior

SQLite stores conversations, messages, the last search criteria, and snapshots of rendered product cards. Message order uses an increasing database sequence rather than UUID order. Refreshing the page or restarting the API preserves history, even if catalog products later change. The active conversation is encoded in the URL. Clearing browser storage does not delete the server database.

A user message is persisted before external calls. Its state is pending, completed, or failed. Successful assistant messages and the user-message state transition are committed together in a short transaction, without holding a database transaction open during network requests. A unique request ID prevents duplicate messages after retries; reusing it with different content is rejected. Only one request may be pending per conversation, and only the latest failed user message can be retried.

Run one API process against this local database. On API startup, pending messages left by a stopped process are marked failed so they can be retried. This recovery strategy is deliberately for a single local process; multiple workers would require coordinated leases or job ownership.

External services have timeouts. `LLM_TIMEOUT_MS` configures the selected provider timeout (default 60000 ms, maximum 60000 ms). The browser waits up to 120 seconds to allow for model planning and catalog pagination. Provider calls are not automatically retried. Timeout, rate-limit, invalid-response, catalog, and storage failures have distinct error codes. Server logs contain only allowlisted diagnostic metadata, such as dependency name, reason, upstream HTTP status, and schema field names; they do not include raw SDK errors, prompts, responses, or credentials. Restart the dev server after editing `.env`.

Catalog or model failures retain the failed user message where storage is available. Interrupted requests are not represented as successful responses. Database read/write errors return service-unavailable errors; corruption or a full disk never causes an automatic database reset. If the file is damaged, stop the API and restore a backup or explicitly choose a fresh `DATABASE_PATH`; resetting data is an operator decision.

## Verification at this checkpoint

Install the dedicated Playwright Chromium browser once, then run quality checks and tests:

```sh
pnpm exec playwright install chromium
pnpm check
pnpm test
```

On a minimal Linux machine, Playwright may also need OS libraries: use `pnpm exec playwright install --with-deps chromium`. The tests do not require a configured `.env`, real provider credentials, or a running application. They create temporary databases and apply the actual migrations; the development database is untouched. The E2E harness starts its own API and Vite server on ports 39101 and 39102 and refuses to reuse existing servers. Override `E2E_API_PORT` and `E2E_WEB_PORT` if those ports are occupied. Failures retain screenshots and traces in `test-results/`; open the HTML report with `pnpm exec playwright show-report`.

| Suite                          | Included coverage                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend integration — 21 cases | Real Nest HTTP routing, validation, services, repositories and SQLite migrations; budget-aware pagination, follow-up context, clarification, unsupported/multiple intents, empty and malformed catalog results, idempotency, concurrent turns, provider errors, transactional write failure, restart recovery, corrupted data and missing conversations. |
| Browser E2E — 7 cases          | Real React UI → Nest → retrieval → rendered cards; title, description, price and image, refresh persistence, separate conversations and resumption, clarification, unsupported/multiple intents, retries without duplicate messages, switching during a pending response, network failure and 404.                                                       |
| Backend unit — 21 cases        | Price boundaries, normalized matching, ranking/ties, safe images, pagination limits/repeated pages, factual summaries, classified diagnostics, log redaction and the OpenAI SDK request/response contract.                                                                                                                                               |
| Frontend unit — 12 cases       | Composer keyboard and IME behavior, image fallback, HTTP errors/cancellation, offline mutations, retry deduplication, stale polling cancellation, cached history during refresh errors and authoritative 404 handling.                                                                                                                                   |

Tests live in `apps/api/test`, `tests/e2e`, and `apps/web/test`. Backend tests use compiled TypeScript with the same Nest decorator metadata as production; Jest currently needs Node's experimental VM-modules flag for ESM. Frontend unit tests use jsdom; actual browser interaction belongs to Playwright. The full suite currently contains 61 cases.

All model and catalog HTTP traffic in automated tests is intercepted with deterministic synthetic fixtures. The real SDKs still serialize and parse responses, and the application path through controllers, services and persistence remains intact. Browser product images are served by a test route. Unexpected external destinations are blocked, so these suites incur no model charges. They catch application regressions, not real model interpretation quality, provider availability, current catalog relevance, or physical disk/hardware failure. Timeout tests simulate provider errors rather than waiting for a production-length timeout; the write-failure test uses a SQLite trigger rather than filling the disk. Browser coverage currently uses desktop Chromium only; no performance or multi-worker load evaluation is included.

For live verification, start a conversation and request “Find smartphones under $500.” Check the cards, ask “Anything cheaper?”, refresh, switch conversations, and resume an older conversation. Also try “Something cheap and cool,” “Book me a flight to Tokyo,” and a request combining laptops and fragrances. The OpenAI adapter must still be checked with an actual permitted key/model before submission; deterministic SDK tests and a working Gemini configuration alone do not fulfill that requirement.

## Logs and troubleshooting

The API writes structured JSON logs to the terminal and, by default, `.data/logs/api.log`. Files rotate daily or at 5 MB, with up to seven compressed rotated files retained in addition to the active file. `.data/` is ignored by Git. `LOG_LEVEL` defaults to `info`; use `debug` for category-cache and HTTP-start events. Set `LOG_TO_FILE=false` to keep console output only, or change `LOG_DIRECTORY`. Restart the API after changing `.env`.

```sh
tail -f .data/logs/api.log
```

Each HTTP request receives a server-generated `requestId`, returned in `X-Request-ID`. HTTP, turn, LLM, catalog, and search events share that identifier; turn events also carry a conversation ID and a client-generated `turnId`. Logs include duration, result counts, dependency, upstream status when available, and a classified failure reason. Request bodies, query strings, headers, message text, product contents, and raw provider errors are excluded. SQL queries and their parameters are not logged. Configured provider credentials are also scrubbed from log text as a second line of defense.

```sh
rg '"requestId":"your-request-id"' .data/logs/api.log
rg '"event":"llm.failed"' .data/logs/api.log
```

For example, `LLM_TIMEOUT` identifies a provider timeout, `LLM_RATE_LIMIT` identifies rate limiting, and `LLM_INVALID_RESPONSE` identifies a parsing or plan-validation failure. A bare 503 without a recorded original cause cannot establish which dependency failed; do not assume it means the API key is invalid. File logging falls back to the console if its directory or stream becomes unavailable. In frontend development, failed HTTP calls also print only status, error code, and request ID to the browser console; they are not uploaded to a logging service.

## Current limitations

- Local, single-user application without authentication, checkout, or deployment.
- English interface and responses; catalog keyword search can miss semantic matches.
- LLM-generated search plans can misinterpret intent even when they pass schema validation.
- Context is limited to 20 completed messages plus the previous search state.
- Three intents per turn, 500 candidates per intent, and five displayed products per group.
- Conversation lists and histories are not paginated yet.
- Category discovery is needed before planning a turn; a cold catalog outage also prevents non-search turns.
- Ready responses with an activity indicator; streaming is deferred and is a candidate improvement for another week.

## Next checkpoints

1. Review the stage 5 test suites and incorporate user feedback.
2. Stage 6: repeat the architecture review, run all checks, verify a clean setup, and smoke-test actual Gemini and allowed OpenAI models.
3. Stage 7: complete the assignment README, including concrete framework alternatives and improvements for another week. Review the design explanations in your own words before submission.

Each stage ends at a review checkpoint before the next stage begins. Streaming is deferred from the first version and will be documented as a possible improvement.
