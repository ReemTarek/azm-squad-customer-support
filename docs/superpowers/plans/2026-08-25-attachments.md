# Customer & Ticket Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-25

**Goal:** Let staff and customers attach files to a ticket message and/or
a customer profile, stored on local disk, downloadable only through an
authenticated endpoint that re-derives the exact same visibility rules
as the attachment's parent (ticket message or customer record).

**Architecture:** One `Attachment` model with two nullable FKs
(`ticketMessageId`, `customerId`) — never both set. Files land on disk
under `backend/uploads/` (git-ignored) via `multer`'s disk storage,
named by a random UUID (never the original filename, to avoid path
traversal/collision), with the real filename kept only in the DB row.
A single `GET /api/attachments/:id` endpoint serves every attachment
regardless of parent type, re-deriving access by re-running the exact
same ownership/scoping checks the ticket and customer routes already
use (`assertTicketAccess`, exported for reuse) — never a second,
drifting copy of that logic.

**Tech Stack:** `multer` (new dependency) for multipart upload parsing,
existing Prisma/Express/zod/Vitest+Supertest stack otherwise.

**Spec:** `docs/specs/001-customer-support-crm/features/22-attachments.md`

## Global Constraints

- 10MB max file size; allowed types: PNG/JPEG/GIF/WebP images, PDF,
  DOCX, CSV, plain text — anything else rejected with the project's
  shared `VALIDATION_ERROR` shape (`12-validation-error-handling.md`),
  not multer's default error format.
- Uploaded files are never served as static files from a public path —
  every download goes through `GET /api/attachments/:id`, which
  authenticates and re-checks ownership/visibility before streaming
  the file.
- Customer-profile attachments (`POST/GET /api/customers/:id/attachments`)
  are staff-only (Admin/Manager/Agent) for both upload and viewing —
  matching this project's existing `CustomerNote` precedent (customers
  don't see internal-facing content about themselves). Ticket-message
  attachments follow the ticket's own visibility rules instead — a
  Customer can attach to and download from their own ticket's
  non-internal messages, per the spec's acceptance criteria.
- Tests must never write into the real `backend/uploads/` dev
  directory — use a separate `backend/uploads-test/` directory when
  `NODE_ENV=test`, cleared fresh by the test suite's existing
  `globalSetup.ts`.

---

### Task 1: Schema, multer infrastructure, and ticket-message attachments

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: new migration (via `npx prisma migrate dev`)
- Modify: `backend/package.json` (add `multer`, `@types/multer`)
- Create: `backend/src/lib/upload.ts`
- Create: `backend/src/lib/attachmentDto.ts`
- Modify: `backend/src/middleware/errorHandler.ts`
- Modify: `backend/src/validation/tickets.schema.ts`
- Modify: `backend/src/routes/tickets.ts`
- Create: `backend/src/routes/attachments.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/globalSetup.ts`
- Modify: `.gitignore`
- Create: `backend/tests/attachments.test.ts`

**Interfaces:**
- Produces: `assertTicketAccess` (exported from `tickets.ts` — was
  local-only before this task; Task 2 doesn't need it, but the
  download endpoint in this same task does, and exporting it here
  keeps it a single source of truth rather than a second copy).
  `UPLOAD_DIR`, `upload` (multer instance) from `lib/upload.ts` —
  Task 2 imports `upload` for the customer-attachment route.
  `toAttachmentDto` from `lib/attachmentDto.ts` — Task 2 reuses it.

- [ ] **Step 1: Add the `Attachment` model to `backend/prisma/schema.prisma`**

Add this model (anywhere among the other models, e.g. after
`TicketMessage`):

```prisma
model Attachment {
  id              String         @id @default(uuid())
  fileName        String
  mimeType        String
  sizeBytes       Int
  storagePath     String
  uploadedById    String
  uploadedBy      User           @relation("AttachmentUploader", fields: [uploadedById], references: [id])
  ticketMessageId String?
  ticketMessage   TicketMessage? @relation(fields: [ticketMessageId], references: [id], onDelete: Cascade)
  customerId      String?
  customer        User?          @relation("AttachmentCustomer", fields: [customerId], references: [id], onDelete: Cascade)
  createdAt       DateTime       @default(now())

  @@index([ticketMessageId])
  @@index([customerId])
}
```

Add one line to the `TicketMessage` model (inside its existing braces,
alongside its other fields):

```prisma
  attachments Attachment[]
```

Add two lines to the `User` model (inside its existing braces,
alongside its other back-relation lists like `notesAboutMe`):

```prisma
  uploadedAttachments Attachment[] @relation("AttachmentUploader")
  attachments         Attachment[] @relation("AttachmentCustomer")
```

- [ ] **Step 2: Generate the migration**

Run: `cd backend && npx prisma migrate dev --name add_attachments`

- [ ] **Step 3: Install multer**

Run: `cd backend && npm install multer && npm install -D @types/multer`

- [ ] **Step 4: Add `backend/uploads/` (and the test variant) to `.gitignore`**

Add this line to the root `.gitignore` (alongside the existing `*.db`
line):

```
backend/uploads/
backend/uploads-test/
```

- [ ] **Step 5: Create `backend/src/lib/upload.ts`**

```typescript
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

export const UPLOAD_DIR = path.resolve(
  __dirname,
  "../..",
  env.nodeEnv === "test" ? "uploads-test" : "uploads"
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});
```

- [ ] **Step 6: Create `backend/src/lib/attachmentDto.ts`**

```typescript
export function toAttachmentDto(attachment: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt,
  };
}
```

- [ ] **Step 7: Translate multer/file-type errors to the shared validation shape**

In `backend/src/middleware/errorHandler.ts`, add an import and two new
branches, before the existing `ZodError` check:

```typescript
import multer from "multer";
```

```typescript
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File exceeds the 10MB limit" : err.message;
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: [{ field: "file", message }],
      },
    });
  }

  if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Unsupported file type",
        details: [{ field: "file", message: "Unsupported file type" }],
      },
    });
  }
```

- [ ] **Step 8: Make `createMessageSchema` accept `isInternalNote` as either a real boolean or a multipart-form string**

In `backend/src/validation/tickets.schema.ts`, replace
`createMessageSchema`'s definition:

```typescript
export const createMessageSchema = z.object({
  body: z.string().min(1, "Message body is required"),
  isInternalNote: z.preprocess(
    (v) => (typeof v === "string" ? v === "true" : v),
    z.boolean().optional()
  ),
});
```

(Multipart/form-data requests — used when a file is attached — arrive
with every non-file field as a string, unlike a plain JSON request
where `isInternalNote` is already a real boolean. This preprocessing
step makes both request shapes parse identically.)

- [ ] **Step 9: Export `assertTicketAccess`, add the upload middleware to `POST /:id/messages`, and include attachments in both message routes**

In `backend/src/routes/tickets.ts`:

1. Add these two imports near the top:
```typescript
import { upload } from "../lib/upload";
import { toAttachmentDto } from "../lib/attachmentDto";
```

2. Change `async function assertTicketAccess(...)` to
   `export async function assertTicketAccess(...)` (no other change to
   its body).

3. Replace the `GET /:id/messages` handler:

```typescript
router.get("/:id/messages", requireAuth, requireRole("Admin", "Manager", "Agent", "Customer"), async (req, res) => {
  const user = req.user!;
  await assertTicketAccess(String(req.params.id), user);

  const messages = await prisma.ticketMessage.findMany({
    where: {
      ticketId: String(req.params.id),
      ...(user.role === "Customer" ? { isInternalNote: false } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { attachments: true },
  });
  res.json({
    messages: messages.map((m) => ({ ...m, attachments: m.attachments.map(toAttachmentDto) })),
  });
});
```

4. Replace the `POST /:id/messages` handler:

```typescript
router.post(
  "/:id/messages",
  requireAuth,
  requireRole("Admin", "Manager", "Agent", "Customer"),
  upload.single("file"),
  async (req, res) => {
    const user = req.user!;
    const id = String(req.params.id);
    await assertTicketAccess(id, user);

    const body = createMessageSchema.parse(req.body);
    const isInternalNote = user.role === "Customer" ? false : Boolean(body.isInternalNote);

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: user.id,
        body: body.body,
        isInternalNote,
        ...(req.file
          ? {
              attachments: {
                create: {
                  fileName: req.file.originalname,
                  mimeType: req.file.mimetype,
                  sizeBytes: req.file.size,
                  storagePath: req.file.filename,
                  uploadedById: user.id,
                },
              },
            }
          : {}),
      },
      include: { attachments: true },
    });
    res.status(201).json({
      message: { ...message, attachments: message.attachments.map(toAttachmentDto) },
    });
  }
);
```

- [ ] **Step 10: Create `backend/src/routes/attachments.ts`**

```typescript
import { Router } from "express";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { UPLOAD_DIR } from "../lib/upload";
import { assertTicketAccess } from "./tickets";

const router = Router();

router.get("/:id", requireAuth, async (req, res) => {
  const user = req.user!;
  const id = String(req.params.id);

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { ticketMessage: { select: { ticketId: true, isInternalNote: true } } },
  });
  if (!attachment) throw Errors.notFound("Attachment not found");

  if (attachment.ticketMessageId && attachment.ticketMessage) {
    await assertTicketAccess(attachment.ticketMessage.ticketId, user);
    if (user.role === "Customer" && attachment.ticketMessage.isInternalNote) {
      throw Errors.forbidden("Cannot access this attachment");
    }
  } else if (attachment.customerId) {
    if (user.role === "Customer") {
      throw Errors.forbidden("Cannot access this attachment");
    }
  }

  res.download(path.join(UPLOAD_DIR, attachment.storagePath), attachment.fileName);
});

export default router;
```

(The `customerId` branch rejects every `Customer` role outright,
matching this task's constraint that customer-profile attachments are
staff-only — a Customer's own uploaded ticket-message attachments are
handled entirely by the first branch, which they can pass.)

- [ ] **Step 11: Mount the new router in `backend/src/app.ts`**

Add the import (alongside the other route imports):
```typescript
import attachmentsRouter from "./routes/attachments";
```

Add the mount (alongside the other `app.use("/api/...")` lines):
```typescript
app.use("/api/attachments", attachmentsRouter);
```

- [ ] **Step 12: Clear the test uploads directory in global test setup**

In `backend/tests/globalSetup.ts`, add a step to remove the test
uploads directory fresh on every run (alongside the existing
`test.db` cleanup). Read the current file first, then add, near the
existing `rmSync` calls for `test.db`:

```typescript
const uploadsTestDir = path.join(backendDir, "uploads-test");
if (existsSync(uploadsTestDir)) rmSync(uploadsTestDir, { recursive: true, force: true });
```

(`rmSync`/`existsSync` are already imported in this file for the
`test.db` cleanup — reuse those imports, don't re-import.)

- [ ] **Step 13: Write the tests**

Create `backend/tests/attachments.test.ts`:

```typescript
// backend/tests/attachments.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("attachments", () => {
  it("a Customer can attach a file to their own new ticket message", async () => {
    const customer = await createUser({ email: "attachcust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Attachment test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "Here is a screenshot")
      .attach("file", Buffer.from("fake png bytes"), { filename: "shot.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.message.attachments).toHaveLength(1);
    expect(res.body.message.attachments[0].fileName).toBe("shot.png");
  });

  it("the uploading customer can download their own attachment", async () => {
    const customer = await createUser({ email: "attachcust2@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Download test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "attaching a file")
      .attach("file", Buffer.from("fake file contents"), { filename: "doc.txt", contentType: "text/plain" });
    const attachmentId = msgRes.body.message.attachments[0].id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe("fake file contents");
  });

  it("a different customer cannot download another customer's attachment", async () => {
    const customerA = await createUser({ email: "attacha@test.com", role: "Customer" });
    const customerB = await createUser({ email: "attachb@test.com", role: "Customer" });
    const tokenA = tokenFor(customerA);
    const tokenB = tokenFor(customerB);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Private attachment test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${tokenA}`)
      .field("body", "private file")
      .attach("file", Buffer.from("private contents"), { filename: "private.txt", contentType: "text/plain" });
    const attachmentId = msgRes.body.message.attachments[0].id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("a Customer cannot download an attachment on an internal note", async () => {
    const agent = await createUser({ email: "attachagent@test.com", role: "Agent" });
    const customer = await createUser({ email: "attachcust3@test.com", role: "Customer" });
    const agentToken = tokenFor(agent);
    const customerToken = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Internal note attachment test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(await createUser({ email: "attachmgr@test.com", role: "Manager" }))}`)
      .send({ agentId: agent.id });

    const msgRes = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .field("body", "internal escalation")
      .field("isInternalNote", "true")
      .attach("file", Buffer.from("internal contents"), { filename: "internal.txt", contentType: "text/plain" });
    const attachmentId = msgRes.body.message.attachments[0].id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a file over the 10MB limit", async () => {
    const customer = await createUser({ email: "attachcust4@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Oversized file test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const oversized = Buffer.alloc(11 * 1024 * 1024);
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "too big")
      .attach("file", oversized, { filename: "huge.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a disallowed file type", async () => {
    const customer = await createUser({ email: "attachcust5@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Bad file type test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("body", "sketchy file")
      .attach("file", Buffer.from("MZ fake exe"), { filename: "virus.exe", contentType: "application/x-msdownload" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
```

- [ ] **Step 14: Run the tests**

Run: `cd backend && npm test -- attachments.test.ts`
Expected: all 6 tests PASS.

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes (31 existing + 6 new = 37).

- [ ] **Step 15: Manually verify the dev server still boots**

Run: `cd backend && npm run dev`, then `curl -s http://localhost:4000/api/health` →
`{"status":"ok"}`. Stop the dev server after confirming.

- [ ] **Step 16: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/package.json backend/package-lock.json backend/src/lib/upload.ts backend/src/lib/attachmentDto.ts backend/src/middleware/errorHandler.ts backend/src/validation/tickets.schema.ts backend/src/routes/tickets.ts backend/src/routes/attachments.ts backend/src/app.ts backend/tests/globalSetup.ts backend/tests/attachments.test.ts .gitignore
git commit -m "feat: ticket message attachments (upload, download, visibility-scoped)"
```

---

### Task 2: Customer-profile attachments

**Files:**
- Modify: `backend/src/routes/customers.ts`
- Modify: `backend/tests/attachments.test.ts`

**Interfaces:**
- Consumes: `upload` (Task 1's `lib/upload.ts`), `toAttachmentDto`
  (Task 1's `lib/attachmentDto.ts`).

- [ ] **Step 1: Add two routes to `backend/src/routes/customers.ts`**

Add these imports near the top:
```typescript
import { upload } from "../lib/upload";
import { toAttachmentDto } from "../lib/attachmentDto";
```

Add these two routes (after the existing `/:id/notes` routes, before
`export default router;`):

```typescript
router.post(
  "/:id/attachments",
  requireAuth,
  requireRole("Admin", "Manager", "Agent"),
  upload.single("file"),
  async (req, res) => {
    const customerId = String(req.params.id);
    const customer = await prisma.user.findUnique({ where: { id: customerId } });
    if (!customer || customer.role !== "Customer") throw Errors.notFound("Customer not found");
    if (!req.file) {
      throw Errors.validation("A file is required", [{ field: "file", message: "A file is required" }]);
    }

    const attachment = await prisma.attachment.create({
      data: {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storagePath: req.file.filename,
        uploadedById: req.user!.id,
        customerId,
      },
    });
    res.status(201).json({ attachment: toAttachmentDto(attachment) });
  }
);

router.get("/:id/attachments", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const customerId = String(req.params.id);
  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer || customer.role !== "Customer") throw Errors.notFound("Customer not found");

  const attachments = await prisma.attachment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ attachments: attachments.map(toAttachmentDto) });
});
```

- [ ] **Step 2: Add tests**

Append to `backend/tests/attachments.test.ts`, inside the existing
`describe("attachments", ...)` block:

```typescript
  it("an Agent can attach a file directly to a customer's profile", async () => {
    const agent = await createUser({ email: "profileagent@test.com", role: "Agent" });
    const customer = await createUser({ email: "profilecust@test.com", role: "Customer" });
    const agentToken = tokenFor(agent);

    const res = await request(app)
      .post(`/api/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .attach("file", Buffer.from("id scan contents"), { filename: "id-scan.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.attachment.fileName).toBe("id-scan.pdf");
  });

  it("a Customer cannot upload or list their own profile attachments", async () => {
    const customer = await createUser({ email: "profilecust2@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const uploadRes = await request(app)
      .post(`/api/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("contents"), { filename: "file.txt", contentType: "text/plain" });
    expect(uploadRes.status).toBe(403);

    const listRes = await request(app)
      .get(`/api/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(403);
  });

  it("a Customer cannot download an attachment on any customer's profile", async () => {
    const agent = await createUser({ email: "profileagent2@test.com", role: "Agent" });
    const customer = await createUser({ email: "profilecust3@test.com", role: "Customer" });
    const agentToken = tokenFor(agent);
    const customerToken = tokenFor(customer);

    const uploadRes = await request(app)
      .post(`/api/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .attach("file", Buffer.from("profile doc contents"), { filename: "doc.pdf", contentType: "application/pdf" });
    const attachmentId = uploadRes.body.attachment.id;

    const res = await request(app)
      .get(`/api/attachments/${attachmentId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
```

- [ ] **Step 3: Run the tests**

Run: `cd backend && npm test -- attachments.test.ts`
Expected: all 9 tests in this file PASS (6 from Task 1 + 3 new).

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: full suite passes (31 pre-Task-1 + 9 attachment tests = 40 total).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/customers.ts backend/tests/attachments.test.ts
git commit -m "feat: customer-profile attachments (staff-only upload and viewing)"
```

---

### Task 3: Frontend — attachment upload/list UI

**Files:**
- Create: `frontend/src/lib/attachmentsApi.ts`
- Modify: `frontend/src/lib/ticketsApi.ts`
- Modify: `frontend/src/pages/tickets/TicketDetailPage.tsx`
- Modify: `frontend/src/pages/customers/CustomerDetailPage.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/tickets/:id/messages` (now returning
  `attachments` per message, and accepting multipart uploads — Task
  1); `GET/POST /api/customers/:id/attachments` (Task 2).

- [ ] **Step 1: Create `frontend/src/lib/attachmentsApi.ts`**

```typescript
import { apiClient } from "./apiClient";

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export async function listCustomerAttachments(customerId: string) {
  const { data } = await apiClient.get<{ attachments: Attachment[] }>(`/customers/${customerId}/attachments`);
  return data.attachments;
}

export async function uploadCustomerAttachment(customerId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<{ attachment: Attachment }>(
    `/customers/${customerId}/attachments`,
    form
  );
  return data.attachment;
}

// A plain `<a href>` to a download URL would NOT send the app's
// Authorization header, and every download must be authenticated —
// so this fetches the file as a blob (with the token already attached
// by apiClient's interceptor) and triggers the save via a throwaway
// object URL, shared by both the ticket message thread and the
// customer profile attachments section.
export async function downloadAttachment(attachmentId: string, fileName: string) {
  const response = await apiClient.get(`/attachments/${attachmentId}`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Update `frontend/src/lib/ticketsApi.ts`'s message types and `postMessage`**

Read the current file first. Add an `attachments` field to the
`TicketMessage` interface:

```typescript
export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  attachments: { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }[];
}
```

Replace `postMessage` to send multipart form data when a file is
provided, plain JSON otherwise (so the vast majority of replies with
no attachment keep working exactly as before, unchanged wire format):

```typescript
export async function postMessage(
  ticketId: string,
  input: { body: string; isInternalNote?: boolean; file?: File }
) {
  if (input.file) {
    const form = new FormData();
    form.append("body", input.body);
    if (input.isInternalNote !== undefined) form.append("isInternalNote", String(input.isInternalNote));
    form.append("file", input.file);
    const { data } = await apiClient.post<{ message: TicketMessage }>(`/tickets/${ticketId}/messages`, form);
    return data.message;
  }
  const { data } = await apiClient.post<{ message: TicketMessage }>(`/tickets/${ticketId}/messages`, input);
  return data.message;
}
```

- [ ] **Step 3: Add a file input and attachment list to `frontend/src/pages/tickets/TicketDetailPage.tsx`**

Read the current file's message-composer section
(`const messageMutation = useMutation(...)` and the `<form onSubmit={handleReplySubmit}>`
block) before editing.

Add one new state hook near the existing `replyBody`/`isInternalNote`
state:
```typescript
const [replyFile, setReplyFile] = useState<File | null>(null);
```

Change `messageMutation`'s `mutationFn` to pass the file through, and
reset it on success:
```typescript
const messageMutation = useMutation({
  mutationFn: () => postMessage(id!, { body: replyBody, isInternalNote, file: replyFile ?? undefined }),
  onSuccess: () => {
    setReplyBody("");
    setIsInternalNote(false);
    setReplyFile(null);
    queryClient.invalidateQueries({ queryKey: ["ticket", id, "messages"] });
  },
  onError: (err) => setActionError(extractApiErrorMessage(err)),
});
```

Add this import (the shared download helper from Step 1, reused by
Task 3 Step 4 as well — don't redefine it locally):
```typescript
import { downloadAttachment } from "../../lib/attachmentsApi";
```

In the message thread's `<li>` (inside the `.map((m) => ...)` block),
add an attachment list right after the message body `<p>`:
```tsx
{m.attachments.length > 0 && (
  <ul className="list-unstyled mb-0 mt-1">
    {m.attachments.map((a) => (
      <li key={a.id}>
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          onClick={() => downloadAttachment(a.id, a.fileName)}
        >
          📎 {a.fileName} ({Math.round(a.sizeBytes / 1024)} KB)
        </button>
      </li>
    ))}
  </ul>
)}
```

In the reply `<form>`, add a file input right after the reply
`<textarea>`'s wrapping `<div className="mb-3">`:
```tsx
<div className="mb-3">
  <label className="form-label" htmlFor="ticket-reply-file">Attach a file (optional)</label>
  <input
    id="ticket-reply-file"
    type="file"
    className="form-control"
    accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain"
    onChange={(e) => setReplyFile(e.target.files?.[0] ?? null)}
  />
</div>
```

- [ ] **Step 4: Add an attachments section to `frontend/src/pages/customers/CustomerDetailPage.tsx`**

Read the current file's Notes section (`notesQuery`, the notes `<ul>`,
the add-note `<form>`) before editing — mirror its structure exactly
for consistency.

Add imports:
```typescript
import { downloadAttachment, listCustomerAttachments, uploadCustomerAttachment } from "../../lib/attachmentsApi";
```

Add a query and a mutation, alongside the existing `notesQuery`/note
mutation:
```typescript
const attachmentsQuery = useQuery({
  queryKey: ["customer", id, "attachments"],
  queryFn: () => listCustomerAttachments(id!),
  enabled: Boolean(id) && isStaff,
});

const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

const uploadAttachmentMutation = useMutation({
  mutationFn: () => uploadCustomerAttachment(id!, attachmentFile!),
  onSuccess: () => {
    setAttachmentFile(null);
    queryClient.invalidateQueries({ queryKey: ["customer", id, "attachments"] });
  },
  onError: (err) => setError(extractApiErrorMessage(err)),
});
```

(Check the existing `error`/`setError` state and `extractApiErrorMessage`
import already exist in this file from the notes feature — reuse them,
don't duplicate. `downloadAttachment` is the same shared helper Task 3
Step 3 uses on the ticket detail page — imported here, not redefined.)

Add a new section, right after the existing Notes `</section>`:
```tsx
{isStaff && (
  <section className="card card-body mb-3">
    <h2>Attachments</h2>
    <ul className="list-group list-group-flush mb-3">
      {attachmentsQuery.data?.map((a) => (
        <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center">
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            onClick={() => downloadAttachment(a.id, a.fileName)}
          >
            📎 {a.fileName} ({Math.round(a.sizeBytes / 1024)} KB)
          </button>
          <span className="form-text text-muted mb-0">{new Date(a.createdAt).toLocaleString()}</span>
        </li>
      ))}
      {attachmentsQuery.data?.length === 0 && <li className="list-group-item">No attachments yet.</li>}
    </ul>
    <div className="d-flex gap-2 align-items-end">
      <div className="flex-grow-1">
        <label className="form-label" htmlFor="customer-attachment-file">Add a file</label>
        <input
          id="customer-attachment-file"
          type="file"
          className="form-control"
          onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!attachmentFile || uploadAttachmentMutation.isPending}
        onClick={() => uploadAttachmentMutation.mutate()}
      >
        Upload
      </button>
    </div>
  </section>
)}
```

- [ ] **Step 5: Verify in the browser**

Log in as a Customer, open a ticket, attach a file to a new reply,
confirm it appears in the message thread with a working download link
(click it, confirm the file downloads with the right name/content).
Log in as an Agent/Admin, attach a file to an internal note on the
same ticket, confirm the Customer's view never shows that message or
its attachment. Log in as Admin, open a customer's detail page, upload
a file directly to their profile, confirm it appears in the
Attachments section and downloads correctly; confirm a Customer
visiting their own detail page never sees an Attachments section at
all (not just empty — absent). Try uploading a >10MB file and a `.exe`
file, confirm both show a clear validation error. At 375px width,
confirm no layout overflow on either page. No console errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/attachmentsApi.ts frontend/src/lib/ticketsApi.ts frontend/src/pages/tickets/TicketDetailPage.tsx frontend/src/pages/customers/CustomerDetailPage.tsx
git commit -m "feat: attachment upload/download UI (ticket messages + customer profiles)"
```

---

### Task 4: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/22-attachments.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-051 Done)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Run the full backend test suite from a clean state**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all tests pass (40 total: 31 from before Round 2's
attachments work + 9 new attachment tests).

- [ ] **Step 2: Verify persistence across a backend restart**

Per the spec's explicit acceptance criterion: upload a file (via curl
or the UI), stop the dev server, start it again, confirm the same
attachment still downloads correctly — proving it lives on disk, not
in memory.

- [ ] **Step 3: `npm run build` (frontend) succeeds**

Run: `cd frontend && npm run build`

- [ ] **Step 4: Update the spec, verification doc, and implementation plan**

In `22-attachments.md`, change `## Status: Not Started` to
`## Status: Done` and check every acceptance-criteria box that's
genuinely true based on Steps 1-2 and the prior tasks' verification.
Add a row to `docs/verification.md`:
`| Customer/ticket attachments (upload, download, visibility-scoped, size/type limits) | Full backend test suite + UI verification | PASS |`.
In `docs/specs/001-customer-support-crm/implementation-plan.md`, find
TASK-051 in the "Round 2" table and change its status from
`Not Started` to `Done`.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/22-attachments.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md
git commit -m "docs: mark customer/ticket attachments done, record verification"
```
