# Feature Spec: Customer Notes

**Requirement:** CRM-CUSTOMER-004
**Related task:** TASK-038

## Goal

Staff can leave internal notes on a customer's profile — general
context that isn't tied to any one ticket (e.g. "VIP customer",
"prefers phone contact", "escalate to manager on any complaint").

## Scope

- New `CustomerNote` model: `customerId` (FK → User), `authorId`
  (FK → User), `body`, `createdAt`.
- `GET /customers/:id/notes` (Admin/Manager/Agent).
- `POST /customers/:id/notes` (Admin/Manager/Agent).
- Frontend: a "Notes" section on the customer detail page (staff-only,
  reusing the `isStaff` check already used there for Ticket History),
  listing notes newest-first with author name, plus a simple add form.
- Not visible to the customer themselves — same staff-only pattern
  already used for ticket internal notes and the ticket-history
  section on this same page.

Out of scope: editing/deleting a note once posted, rich text,
@mentions, attachments.

## Acceptance criteria

- [ ] Staff adds a note to a customer's profile.
- [ ] Note is visible to other staff (Admin/Manager/Agent) immediately.
- [ ] The customer viewing their own profile never sees the notes
      section or receives note data from the API.
- [ ] Customer role calling the API directly gets 403.

## Implementation notes

- `backend/prisma/schema.prisma`: add `CustomerNote`, relation from
  `User` (as both customer-side notes and author-side written notes —
  two separate relation names needed, e.g. `notesAboutMe` and
  `notesAuthored`, since a User can be either side).
- `backend/src/routes/customers.ts`: two new sub-routes under the
  existing `/customers/:id` resource, or a new file
  `customerNotes.ts` mounted at `/customers/:id/notes` — implementer's
  call based on which keeps the file size reasonable.
- `frontend/src/pages/customers/CustomerDetailPage.tsx`: new section
  alongside the existing (staff-only) Ticket History section.

## Verification plan

curl: staff posts a note → GET returns it with correct author name →
Customer role gets 403 on both GET and POST. Playwright: staff adds a
note via UI, reload shows it; log in as that customer, confirm no
Notes section renders and no note content appears anywhere on the page.

## Status: Not Started
