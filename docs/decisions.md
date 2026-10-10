# Technical Decisions

## Node 22 and Built-in SQLite

- Context: The MVP needs persistent state for cumulative recipients and restartable shares without a separate database service.
- Decision: Use Node 22 `node:sqlite` `DatabaseSync` with a persistent local data directory on one server process.
- Reason: It is available in the verified runtime and keeps the hackathon deployment small.
- Alternatives: `better-sqlite3`, a hosted database, or in-memory state.
- Consequences: Node 22 must remain pinned; multi-instance deployment and high-scale concurrency are outside the MVP.

## Browser Identity

- Context: Refreshes and multiple tabs in one browser must not create duplicate Recipients.
- Decision: Use an opaque HttpOnly cookie mapped to a server-side visitor ID, and serialize first-time browser bootstrap with Web Locks.
- Reason: The browser cannot prove human identity, but this gives deterministic same-browser behavior without exposing a client-controlled visitor ID.
- Alternatives: localStorage-only IDs, accounts, IP address, or one WebSocket connection per Recipient.
- Consequences: A new browser/device or cleared cookie may count as a new Recipient; this is an intentional MVP limitation.

## Deterministic Image Collage

- Context: Every image Recipient needs scattered fragments, exact ownership, and stable refresh behavior.
- Decision: Shuffle a fixed source tile stream by share ID, allocate exact pixel intervals, and pack each Recipient's rectangles into a collage. Preserve the original layout when N=1.
- Reason: It gives a visible collage mechanic while allowing tests to prove no pixel overlap or loss.
- Alternatives: random crops, a single strip, or a client-side full image with CSS masking.
- Consequences: Rendering cost grows with recipients; image limits and a render semaphore protect the single-process demo.

