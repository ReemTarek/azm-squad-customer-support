# Backend Integration Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a committed, runnable (`npm test`) Vitest + Supertest integration suite against a real, isolated SQLite test database, covering the security/correctness boundaries already documented as manually-verified in `docs/verification.md`.

**Architecture:** Split `src/index.ts` into an importable `src/app.ts` (Express app, no `listen()`) and a thin `src/index.ts` entrypoint. Tests import `app` and drive it with Supertest against a dedicated `test.db`, reset between tests via direct Prisma `deleteMany()` calls (children-before-parents order), with SLA policy rows seeded once. Auth fixtures use the app's own `signAccessToken()` directly (no HTTP round-trip) except in `auth.test.ts`, which tests the real HTTP login/refresh flow.

**Tech Stack:** Vitest, Supertest, existing Prisma/Express/zod stack (no new runtime dependencies, only dev dependencies).

**Spec:** `docs/specs/001-customer-support-crm/features/19-backend-integration-tests.md`

## Global Constraints

- Tests run against `backend/test.db` (SQLite) — never `backend/dev.db`. `NODE_ENV=test`, `DATABASE_URL=file:./test.db` set programmatically in a setup file, not by editing the real `.env`.
- No AI/Gemini-dependent endpoints are tested here (suggest-reply, summary, suggested-articles, chat) — those need a live external API call, which is slow/costly/non-deterministic for a fast repeatable suite. Out of scope per the spec.
- Every test file is independent — no test relies on state left by another test or by manual dev-server usage.
- `npm test` must work from a clean clone after `npm install` (plus the existing `npx prisma migrate dev` a developer would already run for normal dev use — the test suite's own global setup handles the *test* database's migrations itself).

---

### Task 1: Split `app.ts` from `index.ts`

**Files:**
- Create: `backend/src/app.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Produces: `app` (default export from `backend/src/app.ts`, an `express.Express` instance with all routes/middleware mounted, no `listen()` call) — every later task's tests import this.

- [ ] **Step 1: Create `backend/src/app.ts` with the full app setup moved out of `index.ts`**

```typescript
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import customersRouter from "./routes/customers";
import ticketsRouter from "./routes/tickets";
import kbRouter from "./routes/kb";
import reportsRouter from "./routes/reports";
import quickRepliesRouter from "./routes/quickReplies";
import auditLogsRouter from "./routes/auditLogs";
import notificationsRouter from "./routes/notifications";
import adminSlaConfigRouter from "./routes/adminSlaConfig";
import adminOrgRouter from "./routes/adminOrg";
import chatRouter from "./routes/chat";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/kb", kbRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/quick-replies", quickRepliesRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin/sla-config", adminSlaConfigRouter);
app.use("/api/admin", adminOrgRouter);
app.use("/api/chat", chatRouter);

app.use(errorHandler);

export default app;
```

Copy the exact router import list and mount order from the current `backend/src/index.ts` — if it has drifted from the above (e.g. a router added since this plan was written), preserve the current file's actual list instead of the snippet above.

- [ ] **Step 2: Replace `backend/src/index.ts` with just the entrypoint**

```typescript
import app from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
```

- [ ] **Step 3: Verify the dev server still boots identically**

Run: `npm run dev` (in `backend/`), then in another shell: `curl -s http://localhost:4000/api/health`
Expected: `{"status":"ok"}` — same as before the split. Stop the dev server after confirming (`Ctrl+C` or kill the process) since this is a manual smoke check, not part of the automated suite.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.ts backend/src/index.ts
git commit -m "refactor: split Express app from server entrypoint for testability"
```

---

### Task 2: Test harness (Vitest config, env setup, DB setup, smoke test)

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/tests/globalSetup.ts`
- Create: `backend/tests/env.setup.ts`
- Create: `backend/tests/db.setup.ts`
- Create: `backend/tests/helpers/fixtures.ts`
- Create: `backend/tests/smoke.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `app` from Task 1 (`backend/src/app.ts`).
- Produces: `createUser(overrides)` and `tokenFor(user)` from `tests/helpers/fixtures.ts` — every later test file uses these exact names/signatures.

- [ ] **Step 1: Write the failing smoke test**

```typescript
// backend/tests/smoke.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("smoke", () => {
  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails (vitest/supertest not installed yet)**

Run: `cd backend && npx vitest run tests/smoke.test.ts`
Expected: FAIL — `vitest`/`supertest` not found, or config missing.

- [ ] **Step 3: Install test dependencies**

Run: `cd backend && npm install -D vitest supertest @types/supertest`

- [ ] **Step 4: Create `backend/tests/env.setup.ts` (env vars only, no other imports)**

```typescript
// This file MUST have no imports besides none at all — ES module import
// hoisting means any import here would resolve before these assignments
// run if they came from another module that itself imports prisma/app.
// Keeping this file import-free guarantees these are the first env
// values anything in the process sees.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "file:./test.db";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.PORT = "4001";
```

- [ ] **Step 5: Create `backend/tests/globalSetup.ts` (runs once, migrates test.db fresh)**

```typescript
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

export default async function globalSetup() {
  const backendDir = path.resolve(__dirname, "..");
  const dbPath = path.join(backendDir, "test.db");
  if (existsSync(dbPath)) rmSync(dbPath);
  const journalPath = `${dbPath}-journal`;
  if (existsSync(journalPath)) rmSync(journalPath);

  execSync("npx prisma migrate deploy", {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}
```

- [ ] **Step 6: Create `backend/tests/helpers/fixtures.ts`**

```typescript
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma";
import { signAccessToken } from "../../src/lib/jwt";
import type { Role } from "@prisma/client";

export async function createUser(overrides: {
  email: string;
  role: Role;
  name?: string;
  departmentId?: string;
  branchId?: string;
}) {
  const passwordHash = await bcrypt.hash("Password123!", 10);
  return prisma.user.create({
    data: {
      email: overrides.email,
      passwordHash,
      role: overrides.role,
      name: overrides.name ?? overrides.email,
      departmentId: overrides.departmentId,
      branchId: overrides.branchId,
    },
  });
}

export function tokenFor(user: { id: string; role: Role }) {
  return signAccessToken({ sub: user.id, role: user.role });
}
```

- [ ] **Step 7: Create `backend/tests/db.setup.ts` (reset + seed hooks)**

```typescript
import { beforeAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

async function resetDb() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.ticketTask.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.customerFeedback.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.quickReply.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.knowledgeBaseArticle.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.branch.deleteMany();
}

async function seedSlaPolicies() {
  const defaults = [
    { priority: "Urgent" as const, responseMinutes: 30, resolutionMinutes: 240 },
    { priority: "High" as const, responseMinutes: 120, resolutionMinutes: 480 },
    { priority: "Medium" as const, responseMinutes: 480, resolutionMinutes: 1440 },
    { priority: "Low" as const, responseMinutes: 1440, resolutionMinutes: 4320 },
  ];
  for (const d of defaults) {
    await prisma.slaPolicy.upsert({ where: { priority: d.priority }, update: {}, create: d });
  }
}

beforeAll(async () => {
  await seedSlaPolicies();
});

beforeEach(async () => {
  await resetDb();
});
```

- [ ] **Step 8: Create `backend/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./tests/globalSetup.ts",
    setupFiles: ["./tests/env.setup.ts", "./tests/db.setup.ts"],
    testTimeout: 10000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
```

`poolOptions.forks.singleFork: true` keeps all test files in one process
sharing one SQLite connection sequentially — avoids SQLite file-lock
contention between parallel test-file workers.

- [ ] **Step 9: Add the `test` script to `backend/package.json`**

Run: `cd backend && npm pkg set scripts.test="vitest run"`

- [ ] **Step 10: Run the smoke test to confirm it passes**

Run: `cd backend && npm test`
Expected: PASS — 1 test, `GET /api/health returns ok`.

- [ ] **Step 11: Commit**

```bash
git add backend/vitest.config.ts backend/tests backend/package.json backend/package-lock.json
git commit -m "test: add Vitest+Supertest harness with isolated test.db"
```

---

### Task 3: Auth tests

**Files:**
- Create: `backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `app` (Task 1), `createUser`/`tokenFor` (Task 2).

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/tests/auth.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("auth", () => {
  it("registers a new customer and returns tokens", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "newcustomer@test.com",
      password: "Password123!",
      name: "New Customer",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("Customer");
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send({
      email: "logintest@test.com",
      password: "Password123!",
      name: "Login Test",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "logintest@test.com",
      password: "Password123!",
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("logintest@test.com");
  });

  it("rejects login with wrong password", async () => {
    await request(app).post("/api/auth/register").send({
      email: "wrongpass@test.com",
      password: "Password123!",
      name: "Wrong Pass",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "wrongpass@test.com",
      password: "IncorrectPassword!",
    });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it("refreshes tokens with a valid refresh token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      email: "refreshtest@test.com",
      password: "Password123!",
      name: "Refresh Test",
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: registerRes.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects an invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "not-a-real-token" });
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with no Authorization header", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("rejects a Customer token on an Admin-only route", async () => {
    const customer = await createUser({ email: "cust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd backend && npm test -- auth.test.ts`
Expected: all 7 tests PASS. If any fail, read the actual response body in the
failure output before changing test expectations — this suite mirrors
already-verified curl behavior from `docs/verification.md`, so a failure here
means either a real regression or a test bug, not a spec change.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/auth.test.ts
git commit -m "test: auth integration tests (register/login/refresh/RBAC)"
```

---

### Task 4: Customer ownership tests

**Files:**
- Create: `backend/tests/customers.test.ts`

**Interfaces:**
- Consumes: `app`, `createUser`, `tokenFor`.

- [ ] **Step 1: Write the tests**

```typescript
// backend/tests/customers.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("customers", () => {
  it("Admin creates a customer", async () => {
    const admin = await createUser({ email: "admin@test.com", role: "Admin" });
    const token = tokenFor(admin);

    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "created-customer@test.com", password: "Password123!", name: "Created Customer" });

    expect(res.status).toBe(201);
    expect(res.body.customer.email).toBe("created-customer@test.com");
  });

  it("a Customer can view their own record", async () => {
    const customer = await createUser({ email: "self@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .get(`/api/customers/${customer.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("a Customer cannot view another customer's record", async () => {
    const customerA = await createUser({ email: "a@test.com", role: "Customer" });
    const customerB = await createUser({ email: "b@test.com", role: "Customer" });
    const tokenA = tokenFor(customerA);

    const res = await request(app)
      .get(`/api/customers/${customerB.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to confirm all pass**

Run: `cd backend && npm test -- customers.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/customers.test.ts
git commit -m "test: customer ownership integration tests"
```

---

### Task 5: Ticket tests (creation, SLA math, history, internal notes, ownership)

**Files:**
- Create: `backend/tests/tickets.test.ts`

**Interfaces:**
- Consumes: `app`, `createUser`, `tokenFor`.

- [ ] **Step 1: Write the tests**

```typescript
// backend/tests/tickets.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("tickets", () => {
  it("a Customer creates their own ticket", async () => {
    const customer = await createUser({ email: "cust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "My issue", priority: "Medium" });

    expect(res.status).toBe(201);
    expect(res.body.ticket.customerId).toBe(customer.id);
  });

  it("Admin creates a ticket on behalf of a customer", async () => {
    const admin = await createUser({ email: "admin@test.com", role: "Admin" });
    const customer = await createUser({ email: "cust2@test.com", role: "Customer" });
    const token = tokenFor(admin);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "On behalf", priority: "Low", customerId: customer.id });

    expect(res.status).toBe(201);
    expect(res.body.ticket.customerId).toBe(customer.id);
  });

  it("computes SLA due dates from the seeded Urgent policy (30/240 min)", async () => {
    const customer = await createUser({ email: "cust3@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Urgent issue", priority: "Urgent" });

    const created = new Date(res.body.ticket.createdAt).getTime();
    const responseDue = new Date(res.body.ticket.responseDueAt).getTime();
    const resolutionDue = new Date(res.body.ticket.resolutionDueAt).getTime();

    expect(Math.round((responseDue - created) / 60000)).toBe(30);
    expect(Math.round((resolutionDue - created) / 60000)).toBe(240);
  });

  it("records a TicketStatusHistory entry on status change", async () => {
    const admin = await createUser({ email: "admin2@test.com", role: "Admin" });
    const customer = await createUser({ email: "cust4@test.com", role: "Customer" });
    const adminToken = tokenFor(admin);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subject: "Status test", priority: "Low", customerId: customer.id });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "InProgress" });

    const historyRes = await request(app)
      .get(`/api/tickets/${ticketId}/history`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(historyRes.body.history).toHaveLength(2);
    expect(historyRes.body.history[1]).toMatchObject({ fromStatus: "Open", toStatus: "InProgress" });
  });

  it("hides an internal note from the owning customer", async () => {
    const agent = await createUser({ email: "agent@test.com", role: "Agent" });
    const customer = await createUser({ email: "cust5@test.com", role: "Customer" });
    const agentToken = tokenFor(agent);
    const customerToken = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Note test", priority: "Low" });
    const ticketId = createRes.body.ticket.id;

    await request(app)
      .post(`/api/tickets/${ticketId}/assign`)
      .set("Authorization", `Bearer ${tokenFor(await createUser({ email: "mgr@test.com", role: "Manager" }))}`)
      .send({ agentId: agent.id });

    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "internal escalation note", isInternalNote: true });
    await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ body: "visible reply", isInternalNote: false });

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/messages`)
      .set("Authorization", `Bearer ${customerToken}`);

    const bodies = res.body.messages.map((m: { body: string }) => m.body);
    expect(bodies).toContain("visible reply");
    expect(bodies).not.toContain("internal escalation note");
  });

  it("blocks a customer from viewing another customer's ticket", async () => {
    const customerA = await createUser({ email: "ownerA@test.com", role: "Customer" });
    const customerB = await createUser({ email: "ownerB@test.com", role: "Customer" });
    const tokenA = tokenFor(customerA);
    const tokenB = tokenFor(customerB);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ subject: "Private ticket", priority: "Low" });

    const res = await request(app)
      .get(`/api/tickets/${createRes.body.ticket.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("blocks an unassigned agent from updating a ticket", async () => {
    const customer = await createUser({ email: "cust6@test.com", role: "Customer" });
    const otherAgent = await createUser({ email: "otheragent@test.com", role: "Agent" });
    const customerToken = tokenFor(customer);
    const otherAgentToken = tokenFor(otherAgent);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ subject: "Unassigned test", priority: "Low" });

    const res = await request(app)
      .patch(`/api/tickets/${createRes.body.ticket.id}`)
      .set("Authorization", `Bearer ${otherAgentToken}`)
      .send({ status: "InProgress" });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to confirm all pass**

Run: `cd backend && npm test -- tickets.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/tickets.test.ts
git commit -m "test: ticket integration tests (creation, SLA math, history, internal notes, ownership)"
```

---

### Task 6: Org (department) scoping regression test

**Files:**
- Create: `backend/tests/org-scoping.test.ts`

**Interfaces:**
- Consumes: `app`, `createUser`, `tokenFor`.

This test reproduces the exact scenario a real bug was found in during
manual testing (TASK-042, `docs/debugging-notes.md`): a Manager scoped
to one department must not see, fetch, or update a ticket in another
department, while Admin remains unrestricted.

- [ ] **Step 1: Write the tests**

```typescript
// backend/tests/org-scoping.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/lib/prisma";
import { createUser, tokenFor } from "./helpers/fixtures";

async function createTicketInDepartment(customerId: string, departmentId: string) {
  const now = new Date();
  return prisma.ticket.create({
    data: {
      customerId,
      departmentId,
      subject: "Dept ticket",
      priority: "Low",
      responseDueAt: new Date(now.getTime() + 1440 * 60000),
      resolutionDueAt: new Date(now.getTime() + 4320 * 60000),
    },
  });
}

describe("department/branch RBAC scoping", () => {
  it("a Manager scoped to Department A only sees Department A tickets", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust@test.com", role: "Customer" });
    const manager = await createUser({ email: "orgmgr@test.com", role: "Manager", departmentId: deptA.id });
    const managerToken = tokenFor(manager);

    const ticketA = await createTicketInDepartment(customer.id, deptA.id);
    await createTicketInDepartment(customer.id, deptB.id);

    const listRes = await request(app).get("/api/tickets").set("Authorization", `Bearer ${managerToken}`);
    const subjects = listRes.body.tickets.map((t: { id: string }) => t.id);
    expect(subjects).toContain(ticketA.id);
    expect(subjects).toHaveLength(1);
  });

  it("a Manager scoped to Department A gets 403 fetching a Department B ticket directly", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust2@test.com", role: "Customer" });
    const manager = await createUser({ email: "orgmgr2@test.com", role: "Manager", departmentId: deptA.id });
    const managerToken = tokenFor(manager);

    const ticketB = await createTicketInDepartment(customer.id, deptB.id);

    const res = await request(app)
      .get(`/api/tickets/${ticketB.id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it("a Manager scoped to Department A gets 403 updating a Department B ticket", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust3@test.com", role: "Customer" });
    const manager = await createUser({ email: "orgmgr3@test.com", role: "Manager", departmentId: deptA.id });
    const managerToken = tokenFor(manager);

    const ticketB = await createTicketInDepartment(customer.id, deptB.id);

    const res = await request(app)
      .patch(`/api/tickets/${ticketB.id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "InProgress" });
    expect(res.status).toBe(403);
  });

  it("Admin remains unrestricted across departments", async () => {
    const deptA = await prisma.department.create({ data: { name: "Dept A" } });
    const deptB = await prisma.department.create({ data: { name: "Dept B" } });
    const customer = await createUser({ email: "orgcust4@test.com", role: "Customer" });
    const admin = await createUser({ email: "orgadmin@test.com", role: "Admin" });
    const adminToken = tokenFor(admin);

    await createTicketInDepartment(customer.id, deptA.id);
    await createTicketInDepartment(customer.id, deptB.id);

    const res = await request(app).get("/api/tickets").set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.tickets).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to confirm all pass**

Run: `cd backend && npm test -- org-scoping.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 3: Prove the test is real, not a tautology — temporarily break the fix and confirm failure**

In `backend/src/routes/tickets.ts`, temporarily neutralize the
department/branch-scoping check in `assertTicketAccess` (around line 51,
`if (user.role === "Manager") { ... }`) and in the `GET /` list handler
(around line 120, `} else if (user.role === "Manager") { ... }`) — e.g.
change both conditions to `if (false && ...)` so the blocks never run.
(The `PATCH /:id` and `POST /:id/assign` handlers have their own
`req.user!.role === "Manager"` checks too, at lines ~158 and ~226, but
disabling the two above is enough to make the list/detail tests fail —
don't bother hunting down all four for this one-time sanity check.) Run:
`cd backend && npm test -- org-scoping.test.ts`
Expected: the first two tests FAIL (Manager now sees/accesses both
departments). This confirms the test actually exercises the boundary.
**Revert the temporary change immediately after observing the failure**
— do not commit this broken state.

Run: `cd backend && npm test -- org-scoping.test.ts`
Expected: back to 4/4 PASS after reverting.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/org-scoping.test.ts
git commit -m "test: department/branch RBAC scoping regression tests (TASK-042 bug)"
```

---

### Task 7: Validation contract test

**Files:**
- Create: `backend/tests/validation.test.ts`

**Interfaces:**
- Consumes: `app`, `createUser`, `tokenFor`.

- [ ] **Step 1: Write the test**

```typescript
// backend/tests/validation.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { createUser, tokenFor } from "./helpers/fixtures";

describe("validation error shape", () => {
  it("returns 400 with field-level details for a missing required field", async () => {
    const customer = await createUser({ email: "valcust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "Low" }); // missing required "subject"

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "subject" })])
    );
  });
});
```

- [ ] **Step 2: Run to confirm it passes**

Run: `cd backend && npm test -- validation.test.ts`
Expected: 1 test PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/validation.test.ts
git commit -m "test: validation error-shape contract test"
```

---

### Task 8: Full suite run + README update

**Files:**
- Modify: `README.md` (repo root)

- [ ] **Step 1: Run the entire suite once from a clean state**

Run: `cd backend && rm -f test.db test.db-journal && npm test`
Expected: all test files pass (smoke + auth + customers + tickets +
org-scoping + validation — 23 tests total across the 6 files).

- [ ] **Step 2: Add a "Running tests" section to the root README**

Add this section to `README.md` after the "Setup" section:

```markdown
## Running tests

```bash
cd backend
npm test   # runs the Vitest+Supertest integration suite against an isolated test.db
```

Covers auth, RBAC/ownership boundaries (customer, agent, department
scoping), SLA due-date computation, and the shared validation error
contract — see `docs/specs/001-customer-support-crm/features/19-backend-integration-tests.md`.
```

- [ ] **Step 3: Update `docs/verification.md` and the feature spec's Status**

In `docs/specs/001-customer-support-crm/features/19-backend-integration-tests.md`,
change `## Status: Not Started` to `## Status: Done`, and check off every
`- [ ]` acceptance criterion to `- [x]`.

Add a row to `docs/verification.md`'s P0 table (or a new small section):
`| Automated test suite | npm test in backend/ — 23 tests | PASS |`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/verification.md docs/specs/001-customer-support-crm/features/19-backend-integration-tests.md
git commit -m "docs: document the automated test suite in README and verification records"
git push origin main
```
