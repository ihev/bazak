# Assignment compliance and stage 4 review

Reviewed against the original Bazak assignment on 30 October 2026. This is a checkpoint record, not a declaration that the submission is complete.

## Assignment requirements

| Original requirement                                                      | Current status                               | Evidence and remaining work                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locally runnable application                                              | Implemented                                  | pnpm workspace, explicit Drizzle migrations, Nest API and Vite frontend. Build and focused checks pass. Repeat the clean-install procedure during stage 6.                                                                                     |
| Conversational interface                                                  | Implemented                                  | React conversation screen, composer, messages and loading/error states. Interactive browser verification remains part of stage 5.                                                                                                              |
| Understand intent and retrieve relevant DummyJSON products                | Implemented, model quality remains imperfect | Gemini and OpenAI planning adapters; validated search criteria; categories, keyword search and category endpoints. Gemini was exercised with real synthetic queries in stage 3. A valid plan does not guarantee correct intent interpretation. |
| Product widget inside chat, including title, description, price and image | Implemented                                  | Separate product results and card components, image fallback, factual catalog data. Component rendering and HTTP checks are available; browser interaction and image-error behavior still need E2E coverage.                                   |
| History survives page refresh                                             | Implemented                                  | Server-side SQLite messages, search state and card snapshots; URL-based active conversation. HTTP checks verify history across API restart. Browser refresh requires E2E verification.                                                         |
| New conversation, list past conversations, continue an old conversation   | Implemented                                  | Create/list/read/message endpoints and frontend navigation. HTTP checks exercise continuation and multiple conversations.                                                                                                                      |
| Included tests or evaluation suite for input → retrieval → rendering      | **Not complete**                             | There are no committed automated test suites or test commands yet. Temporary verification scripts are not the required deliverable. Stage 5 must add backend integration, browser E2E, then unit tests.                                        |
| OpenAI model access, restricted to the permitted models                   | Adapter implemented; **not verified live**   | Configuration permits `gpt-5.4-mini` and `gpt-5.4-nano`. The current local environment uses Gemini and has no OpenAI key configured. Verify the permitted OpenAI provider before submission; Gemini support is an extra development option.    |
| Credentials use environment variables and are not committed               | Implemented                                  | Server-only config, ignored `.env`, blank example credentials, no SDKs or provider credentials in the frontend. Repeat repository and asset scanning before submission.                                                                        |
| Source repository submitted by email                                      | **Pending**                                  | Repository preparation and the submission email belong to stage 7. No email has been sent.                                                                                                                                                     |

## Required README answers

| Required topic                                                  | Current status                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup and run                                                   | Present. A clean-install rehearsal remains in stage 6.                                                                                                                          |
| Architecture and chosen approach                                | Present: Nest modules, repositories, separate React responsibilities, shared Zod contracts, small provider interface.                                                           |
| At least two concrete rejected framework alternatives           | **Missing.** Stage 7 must add specific comparisons with LangChain and Vercel AI SDK, reviewed by the candidate in their own words.                                              |
| Retrieval endpoints, query parameters and reasoning             | Present. Describes `q`, `limit`, `skip`, category selection, server-side price/brand filters, ranking and limits.                                                               |
| Ambiguous, off-catalog and multi-intent requests                | Present. Actual model behavior still requires broader evaluation beyond the earlier smoke checks.                                                                               |
| Persistence location, rationale, full/corrupted/cleared storage | Present. Server storage is independent of browser clearing. Corrupt data returns an error without reset; missing conversations return 404. Single-process recovery is explicit. |
| What the test suite catches and misses                          | **Not complete.** Describe the actual suites after stage 5; do not present temporary checks as included tests.                                                                  |
| Known limitations and another week of work                      | Limitations are present; streaming is identified as one improvement. Stage 7 must finish the prioritized improvement list and explain the choices.                              |

The assignment allows a custom implementation and does not require every catalog endpoint. Authentication, checkout, deployment, streaming, embeddings and an agent framework are outside the agreed first-version scope.

## Stage 4 findings and fixes

| Finding                                                                                                                                                                    | Result                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A failed network request could leave an optimistic user message pending forever when the history refetch also failed. The composer and retry action could remain disabled. | Failed mutations cancel stale reads and release only the matching local pending message into a retryable state. The next successful refetch reconciles it with durable server state. Mutations run immediately while offline and fail visibly rather than pausing indefinitely. |
| A polling read started during a message request could overwrite its successful response with an older pending snapshot.                                                    | Mutation success cancels in-flight reads before installing the authoritative response.                                                                                                                                                                                          |
| Background query errors replaced previously loaded history and the conversation list with an error-only screen.                                                            | Cached content stays visible with a refresh warning. An authoritative 404 still replaces stale history and removes the composer.                                                                                                                                                |
| A retry could temporarily change an already completed user message back to pending; mutation errors could remain visible after polling confirmed completion.               | Completed messages are preserved; recovered completions suppress obsolete send errors. Only the latest unresolved user message receives an error retry action.                                                                                                                  |
| An unexpected render or lazy-module failure could blank the application.                                                                                                   | An application error boundary provides a reload action to restore persisted history. Browser reload behavior remains to be tested in stage 5.                                                                                                                                   |
| The chat service mixed turn persistence, LLM-context construction, product retrieval and response wording.                                                                 | `ChatService` now coordinates turn lifecycle and persistence; `ChatDiscoveryService` performs discovery. Factual response wording and product ranking/filtering are separate pure functions.                                                                                    |

Database reads and writes remain within repositories, except for connection lifecycle and explicit migration scripts. Controllers contain HTTP validation and service delegation. Public DTO mappers strip database-only fields. No schema migration or endpoint change was needed for the stage 4 fixes.

## Verification performed during this review

Focused checks used a new temporary SQLite database and synthetic requests. External HTTP and LLM results were mocked, so no stored user conversation or credentials were sent to a model during this review.

- `pnpm check`: ESLint, Prettier, strict TypeScript and production builds.
- Fresh migration application; full catalog pagination before price ranking; public DTO field exclusion.
- Request idempotency and content conflicts; one pending turn per conversation.
- Invalid plan rejection; clarification, unsupported and multiple-intent response paths.
- Transactional assistant-write failure and retry without duplicate user messages.
- Full history and card-snapshot preservation across restart; interrupted-turn recovery.
- Corrupted message data returns 503 without deletion; other conversations remain readable. Removing a conversation produces 404. This checks the application's handling of these cases, not physical disk or hardware recovery.
- Empty/overlong input and malformed JSON return 400; malformed JSON still has a request ID.
- Actual React Query mutation callbacks: offline send settles, content remains retryable, retry deduplicates, and delayed reads cannot replace completed results.
- Server-rendered React: cached history remains visible during a background error, and an authoritative 404 removes stale history and the composer. These are rendering checks, not browser E2E tests.
- Synthetic message text is absent from persistent logs. Earlier logging checks also verified request correlation, credential exclusion and file-unavailable fallback.

## Remaining gates before submission

1. Review this checkpoint with the candidate and incorporate requested changes.
2. Stage 5: commit the agreed integration → browser E2E → unit test suites, including regressions for the findings above.
3. Stage 6: repeat architecture review, run all suites, rehearse a clean setup and verify an allowed OpenAI model using an actual key.
4. Stage 7: complete README alternatives/evaluation/improvement answers, review them in the candidate's own words, verify repository contents, and prepare the Git link and email.

Non-blocking limitations remain documented in the README. The web build currently warns about a JavaScript chunk slightly above 500 kB; build completion is successful, and this size warning is not an assignment failure. Historical 503 logs without their original cause cannot establish a root cause retrospectively; the current classified logs support diagnosis of future failures.
