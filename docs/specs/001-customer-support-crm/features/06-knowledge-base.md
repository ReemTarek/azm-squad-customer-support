# Feature Spec: Knowledge Base

**Requirement:** CRM-KB-001
**Related task:** TASK-012

## Goal
Agents/Admins author help articles; Customers can browse only the
published ones.

## Scope
- CRUD for articles (title, body, category, published flag).
- Agent can edit only their own articles; Admin can edit any.
- Publish gating enforced on both the list (filtered) and the direct
  fetch (404, not just omitted from a list — so guessing an ID doesn't
  leak unpublished content).

Out of scope: rich-text/markdown rendering, versioning, full-text
search ranking (a category/title browse is enough for P0).

## Acceptance criteria
- [x] Unpublished article invisible to Customer (list and direct GET).
- [x] Publishing makes it visible immediately.
- [x] Agent cannot edit another Agent's article; Admin can edit any.

## Implementation
- Backend: `backend/src/routes/kb.ts`.
- Frontend: `frontend/src/pages/kb/` (list, detail with publish toggle,
  new-article form).

## Verification
`docs/verification.md`: "KB visibility" row — PASS (curl + Playwright).

## Status: Done
