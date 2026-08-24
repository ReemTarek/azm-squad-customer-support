# Feature Spec: Gemini-Assisted Reply Suggestions

**Requirement:** CRM-AI-001
**Related task:** TASK-013

## Goal
An Agent can get a draft reply suggestion from Gemini, grounded in the
actual ticket content, without it ever being sent automatically.

## Scope
- `POST /tickets/:id/suggest-reply` (Agent/Manager/Admin only) builds a
  prompt from the ticket subject, priority, and full message thread
  (internal notes included as context for the model — never exposed to
  the customer, since this is a draft the agent edits before sending).
- Real Gemini API call via `@google/generative-ai`, using a live key.
- Any failure (missing key, API error, timeout) → 503 `AI_UNAVAILABLE`,
  logged server-side, never a crash or a raw 500.

Out of scope: auto-sending the suggestion, streaming responses,
ticket summarization, multi-turn chat with the model.

## Acceptance criteria
- [x] Clicking "Suggest Reply" on a real ticket returns a real,
      contextually relevant draft into the editable reply box.
- [x] With `GEMINI_API_KEY` unset, the endpoint returns 503 and the
      server stays healthy.

## Implementation
- Backend: `backend/src/services/gemini.ts`, wired into
  `backend/src/routes/tickets.ts`.
- Frontend: "Suggest Reply" button on
  `frontend/src/pages/tickets/TicketDetailPage.tsx`.

## Verification
`docs/verification.md`: "Gemini suggest-reply", "Gemini disabled" rows
— both PASS against the real API. See `docs/debugging-notes.md` for a
real issue hit and fixed (retired model name) and `docs/ai-usage.md`
for the full before/after.

## Status: Done
