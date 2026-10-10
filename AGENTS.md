# Agent Instructions

## Repository Context

This repository contains EquallyShare, the Stupid Hackathon project “Share แปลว่าหาร”. A Creator shares text or an image through a URL and QR code; every Recipient receives a portion that is recomputed when another Recipient joins.

This repository is the source of truth for work by Codex, Antigravity, and other coding agents. Do not depend on conversation history, provider-specific memory, or hidden context.

Before meaningful work, read `Project.md`, `TODO.md`, the relevant task plan under `docs/superpowers/plans/`, and the relevant source/tests. Inspect `git status` and the current diff before editing.

## Source of Truth and Priority

Use this priority when information conflicts:

1. Current explicit user request
2. Repository code and tests
3. `Project.md`
4. This `AGENTS.md`
5. `TODO.md`
6. Relevant documents under `docs/`
7. Provider-specific configuration
8. Previous conversation context

If a document conflicts with code or tests, investigate and record the decision in `docs/decisions.md`. Do not silently guess.

Important project knowledge must be written to the repository so another agent can continue without this conversation.

## Product Rules

- Creator is Recipient #1 and the initial divisor is 1.
- Recipient count is cumulative. Closing a tab or disconnecting never removes a Recipient or restores a portion.
- The same browser identity must remain one Recipient across refreshes, reconnects, and multiple tabs.
- Text allocation uses grapheme clusters, preserves spaces/newlines, and recomputes from the immutable original.
- Image allocation is a deterministic collage of fragments from different source areas. At N=1 it preserves the full image; at N>1 source pixels are owned exactly once across allocations.
- Existing Recipient pages update automatically after a new Recipient joins. Animation and sound are outside the MVP.
- The original cannot be edited after a share is created.
- Shares expire exactly 24 hours after creation using server time. Joining does not extend expiry.
- When text units are fewer than Recipients, empty allocations remain valid and the UI copy is exactly `คุณได้รับข้อมูล 0 ตัวอักษร`.
- A Recipient must never receive the complete original image hidden behind CSS or in another field.

## Architecture Rules

- Keep server-side business rules in `src/core` and `src/server`; keep browser rendering/state in `src/web`; keep wire types in `src/shared`.
- The server is authoritative for identity, recipient order, count, revision, expiration, and allocations.
- Use one Node process with SQLite and a persistent `DATA_DIR` for the MVP. Do not introduce multi-instance infrastructure unless explicitly requested.
- Browser identity is an opaque HttpOnly same-origin cookie. The browser serializes first-time session bootstrap with Web Locks; the server remains idempotent for every reused cookie.
- Every update carries a monotonically increasing revision. Late snapshots or image responses must not replace newer state.
- Image originals stay outside the public web root. Store only server-generated relative filenames and resolve them with a containment check.
- HTTP and WebSocket origin checks use validated `PUBLIC_ORIGIN`; never trust an arbitrary Host header.
- QR generation is presentation output. A committed share remains usable if QR encoding fails: return its URL/snapshot with nullable QR data and an unavailable status.
- Avoid duplicated allocation logic between HTTP, WebSocket, and the browser. Reuse `src/core` and `src/shared` contracts.

## Coding Rules

- Prefer the smallest safe change that satisfies the requirement.
- Inspect existing code and tests before adding a helper, service, dependency, or abstraction.
- Keep functions focused and validate inputs at HTTP/file boundaries.
- Use parameterized SQL and meaningful HTTP status/error codes.
- Do not store secrets, raw session tokens, credentials, or private keys in the repository.
- Do not modify unrelated files or rewrite history.
- Use `apply_patch` or an equivalent reviewable edit for source changes.
- Keep user-visible copy and API names in English/Thai as established by the existing contracts; keep identifiers and filenames in English.

## Dependencies and Runtime

- Package manager: npm
- Runtime: Node.js `>=22 <23`
- Database: built-in `node:sqlite` `DatabaseSync`; keep the Node 22 runtime pinned because this module is experimental there.
- Frontend: React + Vite + TypeScript
- Backend: Express + `ws`
- Images: Sharp + Multer
- QR: `qrcode`
- Tests: Vitest and Playwright

Before adding a dependency, check the existing package set and standard library. Add a dependency only when it reduces real complexity and is compatible with Node 22.

## Commands

```text
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run load:demo
```

Run the narrowest relevant test first, then the full suite, typecheck, and build before claiming completion. Do not claim a command passed unless it was actually run successfully. If the environment blocks a check, record the exact error and run it in an available permitted environment when safe.

## Task and Git Workflow

The implementation plan is `docs/superpowers/plans/2026-10-10-share-division.md`. Work through it in order; do not start a later task while its predecessor has an unresolved Critical/Important review finding.

After each completed task:

1. Run the task's targeted tests and required checks.
2. Update `Project.md`, `TODO.md`, and `CHANGELOG.md` with verified state.
3. Create a focused commit describing the task.
4. Push that commit to the configured `origin` so another agent can continue if the current session ends.
5. Record the commit SHA, tests, and remaining concerns in the repository handoff docs.

Never force-push, reset, clean, or delete user work. Never push unrelated or unverified changes. If authentication or remote state blocks a push, record the exact blocker and preserve the local commit.

## Testing and Debugging

When fixing a bug:

1. Reproduce or trace it with evidence.
2. Identify the root cause.
3. Add or update a focused regression test when practical.
4. Apply the smallest safe fix.
5. Run the original test and relevant regression suite.
6. Check typecheck/build and inspect the diff for unrelated changes.

Critical tests include Unicode grapheme boundaries, empty allocations, concurrent/idempotent joins, exact expiration, stale revisions, deterministic pixel ownership, same-browser multi-tab identity, reconnect behavior, restart persistence, and original-image isolation.

## Documentation and Handoff

- `Project.md` records project identity, requirements, architecture, verified state, and current limitations.
- `TODO.md` records actionable remaining work; it is not a session transcript.
- `CHANGELOG.md` records completed task-level changes and verification.
- `docs/decisions.md` records meaningful decisions using Context, Decision, Reason, Alternatives, and Consequences.
- `docs/superpowers/plans/` contains the implementation plan; update it if an implementation decision changes the contract.

Before ending substantial work, leave the repository able to answer: what changed, why, what passes, what remains, what is blocked, and what the next agent should do.

## Definition of Done

A task is done only when its requested behavior is implemented, focused tests pass, relevant typecheck/build checks pass, documentation and TODO state are current, the focused commit is pushed to `origin`, and no known Critical/Important review finding remains.

