# Feature Spec: Validation & Error Handling

**Requirement:** CRM-VALID-001
**Related task:** TASK-018

## Goal
Every write endpoint validates input consistently and fails
predictably — never a raw 500 for bad client input.

## Scope
- zod schema per endpoint (`backend/src/validation/*.schema.ts`),
  parsed at the top of each handler.
- Central error middleware (`backend/src/middleware/errorHandler.ts`)
  converts `AppError` and `ZodError` into one JSON shape:
  `{ error: { code, message, details? } }`.
- Standard codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401),
  `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409),
  `AI_UNAVAILABLE` (503).

Out of scope: client-side schema duplication/generation from the
backend schemas (forms validate via HTML `required`/`type` attributes
plus server-side rejection, not a shared schema library).

## Acceptance criteria
- [x] Missing/invalid field on every write endpoint (auth, users,
      customers, tickets incl. assign/messages, kb) → 400 with
      field-level `details`.
- [x] Nonexistent resource → 404.
- [x] Duplicate email → 409.
- [x] Referencing the wrong role (e.g. assigning a Customer as an
      agent) → 400 with a clear message.

## Implementation
- Backend: `backend/src/lib/errors.ts`,
  `backend/src/middleware/errorHandler.ts`, one `*.schema.ts` per
  resource.

## Verification
`docs/verification.md`: "Validation errors", "Nonexistent resource",
"Duplicate uniqueness", "Invalid role assignment" rows — all PASS,
every write endpoint checked individually.

## Status: Done
