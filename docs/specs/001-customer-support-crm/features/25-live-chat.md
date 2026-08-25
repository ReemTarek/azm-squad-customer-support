# Feature Spec: Live Chat (Real-Time Agent ↔ Customer)

**Date:** 2026-08-24
**Requirement:** CRM-LIVECHAT-001
**Round:** Round 2 — Post-Test-Suite Enhancements, item 6 of 9

## Goal

A real-time chat channel between a customer and a human agent —
distinct from the existing AI chatbot (`18-ai-chatbot.md`, which only
answers from the knowledge base and hands off to ticket creation, never
talks to a human live).

## Assumptions

- **Transport: WebSockets (Socket.IO), not polling.** Originally
  scoped as polling to avoid new infrastructure (this project has
  deliberately avoided background-job/push infra elsewhere — SLA is
  compute-on-read, escalation is an admin-triggered sweep, not a cron
  job, `decisions.md`). That trade-off was surfaced explicitly for
  confirmation before building; **the user overrode it 2026-08-24 and
  asked for real WebSockets instead.** `socket.io`/`socket.io-client`
  (not raw `ws`) — handles reconnection, auth-on-handshake, and
  room-based broadcast (one room per `LiveChatSession`) without hand-
  rolling those concerns.
- The existing `backend/src/index.ts`/`app.ts` split (done for the
  backend test suite, `19-backend-integration-tests.md`) is what makes
  this clean: Socket.IO attaches to the raw `http.Server` created in
  `index.ts` (alongside Express), not to `app.ts` itself — so the
  Supertest-driven test suite (which imports `app.ts` directly, never
  boots a real server) is completely unaffected by this change.
- REST stays the persistence layer (message POST still validates and
  writes to the DB exactly as any other endpoint in this app does);
  Socket.IO is purely a push notification on top of it — after a
  successful `POST .../messages`, the server also emits the new
  message to that session's room, and separately emits a "new session
  waiting" event to a shared agents' room when one is created. The
  initial message history on opening/rejoining a session still loads
  via a normal `GET`, matching this app's existing REST-first pattern
  everywhere else.
- Socket connections authenticate via the same JWT access token already
  used for HTTP (`socket.handshake.auth.token`, verified with the
  existing `verifyAccessToken` used by the HTTP auth middleware) —
  no separate auth mechanism.
- Reuses the existing `/chat` widget UI shell rather than building a
  second, separate live-chat screen: the AI chatbot conversation gets
  a "Connect to an agent" escalation button that switches that same
  conversation into live-human mode. This is a much smaller UI lift
  than a parallel live-chat surface, and matches how the chatbot
  already hands off to ticket creation as an escalation path.
- New, separate schema models from the AI chatbot's `ChatConversation`/
  `ChatMessage` — conflating AI-chatbot history with human-agent chat
  history in one table would make both harder to reason about
  (different authors, different lifecycle: AI chat has no "agent
  picks it up from a queue" step).

## Scope

- **Schema:** `LiveChatSession` (id, customerId, status:
  `Waiting`|`Active`|`Ended`, assignedAgentId nullable, createdAt,
  endedAt), `LiveChatMessage` (id, sessionId, authorId, authorRole,
  body, createdAt).
- **Backend:**
  - `POST /api/live-chat/sessions` (Customer) — starts a session,
    status `Waiting`; emits a `queue:new-session` event to the shared
    agents' Socket.IO room.
  - `GET /api/live-chat/sessions` (Agent/Manager/Admin) — lists
    `Waiting` and the requester's own `Active` sessions (initial load
    for the agent queue view; kept live afterward via the socket
    event above, no polling/refetch needed).
  - `POST /api/live-chat/sessions/:id/claim` (Agent) — moves a
    `Waiting` session to `Active`, sets `assignedAgentId`, joins the
    claiming agent's socket to that session's room.
  - `GET/POST /api/live-chat/sessions/:id/messages` — post/list
    messages; ownership: the session's customer, or its assigned
    agent, or Admin/Manager. `POST` also emits the new message to the
    session's Socket.IO room.
  - `POST /api/live-chat/sessions/:id/end` — either party ends it;
    emits a `session:ended` event to the room.
  - `backend/src/lib/socket.ts` (new) — creates the Socket.IO server,
    the JWT-handshake auth middleware, and the room-join/leave logic
    (a customer joins their own session's room on connect; an agent
    joins on claim).
- **Frontend:**
  - `frontend/src/lib/socketClient.ts` (new) — one shared Socket.IO
    client instance, connected with the current access token.
  - Customer side: the existing `ChatPage.tsx` gets a "Talk to a
    human" button that starts a `LiveChatSession`, joins its room, and
    switches the widget into live-human mode for that conversation —
    new messages arrive via the socket, no refetching.
  - Agent side: a new "Live Chat" nav item/page showing the queue
    (`Waiting` sessions, updated live via `queue:new-session`) and the
    agent's own active session(s), with messages arriving live via the
    socket once claimed.

## Out of scope

- File attachments inside live chat (text only for this version —
  `22-attachments.md` covers tickets/customers, not chat).
- Chat history search or transcripts emailed after the session ends.
- Multiple simultaneous agents on one session (one assigned agent at a
  time, matching the existing single-assignee ticket model).
- Read receipts/typing indicators.

## Acceptance criteria

- [x] A customer can start a live-chat session and send a message.
      Verified Task 7: two-browser Playwright run, "Talk to a human"
      starts a session and messages send successfully.
- [x] An agent sees the session appear in the queue in real time (no
      refresh/poll needed), claims it, and can reply.
      Verified Task 7: the new session appeared in the agent's
      "Waiting" list with no page reload (`queue:new-session` socket
      event → query invalidation), Claim switched the agent into the
      active-chat view, and the agent's reply sent successfully.
- [x] The customer sees the agent's reply in real time (sub-second,
      pushed over the socket — not a polling refetch).
      Verified Task 7: measured message delivery at 40ms and 41ms
      (both directions) in the live two-browser round-trip, well
      under the sub-second bar, pushed via `message:new` socket
      events (no polling).
- [x] A Customer cannot see or claim another customer's session; an
      Agent cannot post into, or receive socket events for, a session
      assigned to a different agent (room membership enforces this —
      verify a stray/forged room-join attempt is rejected server-side,
      not just hidden client-side).
      Verified by the automated backend suite (part of the 65 passing
      tests, Task 7 Step 1): `liveChat.test.ts` — "a Customer cannot
      see or claim another customer's session" and "an unassigned
      Agent cannot post into a session assigned to a different agent";
      `liveChatSocket.test.ts` — "rejects a stray join-session attempt
      for a session the socket's user doesn't own" (server-side ack
      `{ ok: false }`, not a client-side hide).
- [x] Ending a session stops it from appearing in the active queue for
      either party, and both sockets leave the room.
      Verified by the automated backend suite: `liveChatSocket.test.ts`
      — "ending a session removes every joined socket from that
      session's room" asserts the Socket.IO room is empty
      (`rooms.get(sessionId)` is `undefined`) immediately after `end`.
      Queue exclusion follows directly from `GET /sessions`' query
      (`status: "Waiting"` or `status: "Active"` only — an `Ended`
      session matches neither), also confirmed live in the Task 7
      round-trip (agent's active-chat view left the ended session).
- [x] A socket connection with an invalid/expired/missing token is
      rejected at handshake — same auth guarantee as every HTTP route.
      Verified by the automated backend suite: `liveChatSocket.test.ts`
      — "rejects a connection with a missing token" and "rejects a
      connection with an invalid token" (part of the 65 passing
      tests).
- [x] A dropped connection (e.g. network blip) reconnects and rejoins
      its session's room automatically, with no lost messages (missed
      messages are recoverable via the existing `GET .../messages` on
      reconnect, since REST remains the source of truth).
      Verified Task 7 with a genuine forced WebSocket close
      (`context.routeWebSocket()` closing the live transport — plain
      `context.setOffline()` was tried first per the original plan but
      was found, empirically, not to interrupt an already-established
      Socket.IO WebSocket in this Chromium/Playwright setup, so it
      could not exercise real reconnect behavior on its own): the
      client's `disconnect` event fired, `socket.io-client`'s built-in
      reconnection manager auto-reconnected ~700ms later with a new
      socket id (`connect` re-fired), and `join-session` re-ran,
      confirmed by fresh messages flowing live again in both
      directions immediately after. A message sent by the agent
      *during* the outage window was not delivered live (expected —
      Socket.IO room broadcasts aren't queued for a disconnected
      socket) but was confirmed recoverable via `GET .../messages`
      afterward, matching the spec's own accepted fallback wording.

## Implementation

New migration (`LiveChatSession`/`LiveChatMessage`); `npm install
socket.io` (backend), `npm install socket.io-client` (frontend); new
`backend/src/lib/socket.ts` (Socket.IO server + JWT-handshake auth);
`backend/src/index.ts` (modified — creates the `http.Server`, attaches
both Express `app` and the Socket.IO server to it, replacing the plain
`app.listen()`); new `backend/src/routes/liveChat.ts`, mounted in
`app.ts`; new `frontend/src/lib/socketClient.ts`;
`frontend/src/lib/liveChatApi.ts` (new); new
`frontend/src/pages/LiveChatQueuePage.tsx` (agent side);
`frontend/src/pages/ChatPage.tsx` (extend with the escalation button
and live socket-driven mode).

## Verification plan

Real two-browser-session verification (one as Customer, one as Agent)
confirming the message round-trip appears on both sides near-
instantly (no polling delay to account for), plus the standard RBAC
negative-case checks this project verifies for every feature (cross-
customer, unassigned-agent) — extended here to also cover a rejected
socket handshake (bad token) and a rejected cross-session room-join
attempt.

## Status: Done
