# Feature Spec: AI Chatbot (Full)

**Status: approved 2026-08-24 — full version, despite the brief's own
P2 warning against over-investing in "sophisticated real-time chat
infrastructure."**
**Requirement:** CRM-AI-005
**Related tasks:** TASK-044 through TASK-047

## Scoping decision (read this first)

"Full chatbot" here means **persisted, multi-turn conversation with
KB-grounded Gemini answers** — not real-time streaming/WebSocket
infrastructure. The brief's specific warning was about *"sophisticated
real-time chat infrastructure"* (typing indicators, live streaming
tokens, websocket presence, etc.) — that part is skipped. A
request/response chat (send message → wait → see reply, same
interaction model as every other page in this app) delivers a genuine
multi-turn chatbot without the operational complexity/risk the brief
specifically flagged. If real-time streaming is actually wanted,
that's a separate, explicit ask.

## Goal

A customer can have a multi-turn conversation with an AI assistant
that answers from the knowledge base and can hand off to a real
ticket when it can't help.

## Scope

- `ChatConversation` (customerId, createdAt) and `ChatMessage`
  (conversationId, role: user/assistant, body, createdAt) models.
- `POST /chat/conversations` (Customer) — start one.
- `POST /chat/conversations/:id/messages` (Customer) — send a message,
  synchronously returns the assistant's reply (no streaming).
- `GET /chat/conversations/:id` — full history.
- Gemini prompt constrained to answer **only** from published KB
  article content passed in context (same trust boundary as the
  existing AI-suggested-articles feature) plus the conversation so
  far; if it can't answer confidently, it says so and offers to create
  a ticket.
- "Create a ticket from this conversation" action — pre-fills a new
  ticket's subject/body from the chat transcript.
- Chat widget on the customer portal.

Out of scope: streaming responses, typing indicators, agent-side
live-chat handoff (an agent joining the same conversation in
real-time), voice/multimedia messages.

## Task breakdown

### TASK-044 — Schema
**Database:** `ChatConversation`, `ChatMessage` models; migration.

### TASK-045 — Backend
**Backend:** the three endpoints above; `services/gemini.ts` gains
`answerFromKnowledgeBase(question, history, articles)` — same
constrained-JSON-or-plain-answer pattern already used for
`suggestRelevantArticleIds`, but returning prose instead of IDs, with
an explicit "I don't have a confident answer" fallback path baked into
the prompt.
**Verification:** curl — ask a question the KB actually answers (real
answer expected), ask an unrelated question (fallback/offer-to-escalate
expected), confirm conversation history persists across turns.

### TASK-046 — Frontend
**Frontend:** chat widget (message list + input) on the customer
portal, "Create a ticket from this" button when the bot can't help.
**Verification:** Playwright — multi-turn conversation, confirm
history renders correctly on reload, confirm the ticket-creation
hand-off actually creates a real ticket pre-filled from the transcript.

### TASK-047 — Guardrails
Explicit system-prompt constraint to KB content only (never invent an
answer), a hard fallback message when confidence is low, and a check
that the bot never fabricates ticket/account-specific details it
wasn't given.
**Verification:** ask the bot something outside KB scope entirely
(e.g. "what's my ticket status" without providing ticket context) and
confirm it doesn't hallucinate an answer.

## Status: Done

Verified against the real Gemini API, both directions:
- A KB-answerable question ("How do I reset my password?") returned
  the exact grounded answer from the published article, `confident:
  true`.
- An out-of-scope question ("What is the status of my flight
  booking?") correctly triggered the `NO_CONFIDENT_ANSWER` guardrail
  sentinel rather than inventing an answer, mapped to a fixed fallback
  message, `confident: false`.
- The "Create a ticket about this" hand-off (shown only when
  `confident: false`) correctly pre-fills the new-ticket form's
  subject with the customer's original question.
- Conversation history persists across turns (4 messages after 2
  question/answer exchanges); cross-customer conversation access
  blocked (403); non-Customer roles blocked entirely (403) — the
  chatbot is a customer-portal-only surface.

Confirms the scoping decision held: no streaming/websocket
infrastructure was needed to deliver a genuine multi-turn, KB-grounded
chatbot.
