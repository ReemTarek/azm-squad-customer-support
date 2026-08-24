# Discussion Spec: AI Chatbot

**Status: not approved — this document exists to support a scoping
decision, not as a commitment to build.**

## What was asked

The full feature catalog listed "AI chatbot" under AI Features. Not
in the original P0/P1 plan, and directly adjacent to a specific
warning in the original brief.

## The specific risk here

The original brief's P2 list names *"sophisticated real-time chat
infrastructure"* as something to explicitly avoid over-investing in
for this project. A full chatbot is exactly that: persisted
conversation state, streaming responses, guardrails against
hallucinated answers presented as fact, and a genuinely new UX
surface — not a small extension of what exists.

## Draft scope — full version (not recommended)

- Conversation model (messages, session), a chat widget UI, streaming
  Gemini responses, logic for "answer from KB" vs. "hand off to a
  human ticket," guardrails/fallbacks when the model doesn't know.
- This is comparable in size to the entire ticket-management feature
  that took the bulk of the P0 effort — not a bolt-on.

## Draft scope — minimal version (if wanted at all)

- A single non-streaming `POST /kb/ask` endpoint: takes a customer's
  question, does the same constrained-match approach already built for
  `suggestRelevantArticleIds` (pass published KB articles + the
  question to Gemini, ask for the most relevant answer or "none
  found"), returns one answer, no persisted conversation.
- A simple "Ask a question" box on the customer portal — one request,
  one response, no chat history, no follow-up turns.
- Every answer sourced only from KB content already in the system
  (same trust boundary as the existing AI-suggested-articles feature)
  — never a free-form answer the model invents.

## Options

1. **Full chatbot** — not recommended; explicitly the kind of thing
   the brief warns against over-building.
2. **Minimal KB Q&A** (draft above) — reuses existing Gemini
   integration patterns, small and bounded, genuinely different in
   size from option 1.
3. **Skip** — the existing "Suggest Articles" + KB browse already
   covers most of the practical value.

## Recommendation

Skip, or build option 2 only if there's a specific reason a browsable
KB + agent-facing suggestions aren't enough. Do not build option 1
within this project's scope.
