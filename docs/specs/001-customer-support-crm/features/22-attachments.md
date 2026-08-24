# Feature Spec: Customer & Ticket Attachments

**Date:** 2026-08-24
**Requirement:** CRM-ATTACH-001 (extends CRM-CUSTOMER-001/CRM-TICKET-001)
**Round:** Round 2 — Post-Test-Suite Enhancements, item 3 of 9

## Goal

Let staff and customers attach files to a ticket message and/or a
customer profile — the one piece of "Customer Management" (notes and
**attachments**) never built (notes shipped in `16-customer-notes.md`;
attachments didn't).

## Assumptions

- **Local disk storage**, not a cloud bucket (S3/etc.) — this project
  is self-hosted on SQLite with no cloud infra anywhere else in the
  stack; adding a cloud storage dependency for a single-deployment CRM
  would be disproportionate. Files are stored under a new
  `backend/uploads/` directory (git-ignored), addressed by an
  Attachment DB row, never served as static files directly (auth must
  gate every download — see Scope).
- One `Attachment` model covers both attach points (a ticket message,
  or a customer profile) via two nullable foreign keys, with an
  app-level (not DB-level) invariant that exactly one is set —
  simpler than two separate tables for what's otherwise identical
  metadata.
- File-size and type limits are needed (10MB per file; images, PDF,
  DOCX, CSV, plain text) — an unrestricted upload endpoint is a
  real security/ops risk (disk-fill DoS, arbitrary file execution
  risk from unexpected types) and out of proportion to what a support
  CRM needs attachments for (screenshots, log files, receipts).

## Scope

- **Schema:** new `Attachment` model — `id`, `fileName`, `mimeType`,
  `sizeBytes`, `storagePath`, `uploadedById`, `ticketMessageId`
  (nullable), `customerId` (nullable), `createdAt`.
- **Backend:**
  - `POST /api/tickets/:id/messages` — accept an optional file upload
    (multipart, via `multer`) alongside the existing message body;
    creates the `TicketMessage` and its `Attachment` row together.
    RBAC/ownership: identical to the existing message-post check
    (`assertTicketAccess`) — an attachment inherits the same
    visibility as the message it's on (including the existing
    internal-note isolation from Customers).
  - `POST /api/customers/:id/attachments` — Admin/Manager/Agent only
    (matches who can already edit a customer record), attaches a
    file directly to the customer profile (not tied to a specific
    ticket message).
  - `GET /api/attachments/:id` — authenticated download endpoint;
    re-derives visibility from whichever parent (ticket message or
    customer) the attachment belongs to, reusing the existing
    ownership-check logic rather than serving the file unauthenticated
    from a static path.
  - Reject uploads over 10MB or outside the allowed MIME-type list
    with the existing shared validation error shape
    (`12-validation-error-handling.md`).
- **Frontend:** a file input next to the existing message composer on
  the ticket detail page; a small attachments list (filename, size,
  download link) on both the ticket message thread and the customer
  detail page.

## Out of scope

- Virus/malware scanning of uploaded files (no such infra exists
  anywhere in this project; noted as a real limitation for a
  production deployment, not solved here).
- Image thumbnails/previews — a plain download link is sufficient for
  this scope.
- Editing or replacing an existing attachment (upload a new one
  instead; deleting is in scope only if trivial at implementation
  time, not a hard requirement).

## Acceptance criteria

- [ ] A Customer can attach a file to their own new ticket message.
- [ ] An Agent can attach a file to a ticket message (internal note or
      visible reply) and to a customer's profile directly.
- [ ] A file over 10MB is rejected with a clear validation error.
- [ ] A disallowed file type (e.g. `.exe`) is rejected.
- [ ] Downloading an attachment enforces the same visibility rules as
      its parent — a Customer cannot download an attachment on another
      customer's ticket, and cannot download one attached to an
      internal note.
- [ ] Uploaded files persist correctly across a backend restart (they
      live on disk under `backend/uploads/`, not in memory).

## Implementation

New migration (`Attachment` model); `npm install multer @types/multer`
in `backend/`; `backend/src/routes/tickets.ts` (extend the messages
route), `backend/src/routes/customers.ts` (new sub-route),
`backend/src/routes/attachments.ts` (new, the download endpoint);
`backend/uploads/` (git-ignored); `frontend/src/pages/tickets/TicketDetailPage.tsx`,
`frontend/src/pages/customers/CustomerDetailPage.tsx`.

## Verification plan

Real file upload/download round-trip via curl and the browser for
each role combination in the acceptance criteria above, including the
existing internal-note-isolation negative test extended to also cover
attachment visibility.

## Status: Not Started
