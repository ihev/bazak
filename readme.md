# Bazak Shopping Copilot

A local conversational product discovery app using the DummyJSON product catalog.

## Current checkpoint

Stage 2: project foundation. The API exposes a database-backed health endpoint and the web app displays its status. Conversation management, product retrieval, and LLM adapters are planned for stage 3. The application is not yet a completed assignment submission.

## Requirements

- Node.js 24
- pnpm 12.6.0

## Setup and run

Run commands from the workspace root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Open <http://localhost:5173>. The API runs on <http://127.0.0.1:3001/api>; `GET /api/health` verifies that the migrated database is readable. The Vite development server proxies `/api` requests to Nest.

No LLM credentials are needed for this checkpoint. Stage 3 will introduce provider configuration and validate the selected provider's credentials. Never commit `.env` or expose provider credentials using `VITE_` variables.

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
| `pnpm --filter @bazak/api start` | Start the built API                                               |

Database migrations are explicit and are not run automatically at API startup. Run `pnpm db:migrate` after pulling schema changes. Generated SQL migrations and their Drizzle metadata belong in version control; the local database does not.

## Architecture

- `apps/api`: NestJS backend with explicit feature modules. Controllers handle HTTP concerns; services coordinate behavior; repositories own database queries. Configuration, database lifecycle, and HTTP error handling are separate concerns.
- `apps/web`: React and Vite frontend. Feature components, API functions, and TanStack Query hooks have separate responsibilities. React Router owns navigation. Local component state does not need Zustand at this stage.
- `packages/contracts`: public Zod request/response schemas and inferred TypeScript types, built as ESM for the browser and Nest. Database models and provider SDK types stay private to the backend.

The API is compiled with TypeScript's decorator metadata enabled, including during development, so Nest constructor injection behaves consistently in development and built code. The API TypeScript import-style lint exception preserves runtime class references required by decorator metadata.

SQLite and Drizzle keep this local assignment easy to run without Docker or a database server. For a future shared service with greater concurrency and operational requirements, PostgreSQL would be the preferred database. Repositories contain the database-specific implementation, but changing databases still requires appropriate Drizzle schema changes and migrations.

Connections enable foreign keys, a busy timeout, and WAL journaling. The database connection is closed during graceful shutdown. Failures do not automatically reset or delete data.

## Verification at this checkpoint

Run `pnpm check`, then start the app and verify that the page reports “API connected · Database ready.” An unknown API route returns a structured JSON error. With the API stopped, the page provides an error message and a retry action.

Automated tests are intentionally scheduled after the first working version and architecture review: backend integration tests first, browser E2E second, backend and frontend unit tests third. This checkpoint does not claim test coverage or working LLM integration.

## Next checkpoints

1. Stage 3: implement the complete conversational product discovery flow and persistence.
2. Stage 4: review architecture, errors, edge cases, and user feedback.
3. Stage 5: add integration, browser E2E, and unit tests, in that order.
4. Stage 6: repeat the architecture review, run all checks, verify a clean setup, and smoke-test actual Gemini and allowed OpenAI models.
5. Stage 7: complete the assignment README, including framework alternatives, retrieval strategy, storage failure behavior, evaluation limits, known limitations, and improvements for another week.

Each stage ends at a review checkpoint before the next stage begins. Streaming is deferred from the first version and will be documented as a possible improvement.
