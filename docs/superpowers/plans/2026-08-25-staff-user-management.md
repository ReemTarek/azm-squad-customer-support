# Staff & User Management UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Date:** 2026-08-25

**Goal:** Give an Admin a real in-app screen to create, list, edit, and
deactivate Agent/Manager/Admin accounts (today API-only), including
department/branch assignment — and add the account-deactivation
capability that doesn't exist anywhere in the app yet (no `isActive`
field, no login enforcement).

**Architecture:** One new Prisma field (`User.isActive`), enforced at
login (`POST /api/auth/login` rejects a deactivated account the same
way it rejects a wrong password — no distinguishing error message,
so a disabled account can't be fingerprinted from the outside).
`updateUserSchema`/`PATCH /api/users/:id` gain an optional `isActive`
boolean, guarded so an Admin can never deactivate themselves. One new
frontend page (`/admin/users`, Admin-only) reusing the existing
department/branch `<select>` picker pattern already used on the
ticket form, and the existing generic list/card/form Bootstrap
conventions from the rest of the app.

**Tech Stack:** Existing Prisma/Express/zod/Vitest+Supertest backend,
existing React/Vite/React Query/Bootstrap frontend — no new
dependencies.

**Spec:** `docs/specs/001-customer-support-crm/features/21-staff-user-management.md`

## Global Constraints

- A deactivated account is rejected at login with the exact same
  `401 UNAUTHENTICATED` shape as a wrong password — never a
  distinguishing message that would let an attacker enumerate which
  accounts exist vs. are disabled.
- An Admin can never deactivate their own account — guarded in both
  the frontend (button disabled/hidden) and the backend (defensively,
  independent of the frontend).
- This page never creates `Customer` accounts — `createStaffUserSchema`
  already restricts `POST /api/users`'s role to Admin/Manager/Agent;
  that restriction is unchanged.
- No token-revocation list — a deactivated user's already-issued
  access token keeps working until it naturally expires (documented
  accepted trade-off, consistent with this project's existing
  stateless-JWT design).
- Every existing RBAC/ownership check anywhere else in the app
  (Manager department/branch scoping, ticket assignment, etc.) must
  keep working identically — this plan only adds a new field and a
  new page, it never changes existing authorization logic.

---

### Task 1: Backend — `isActive` field, login enforcement, self-deactivation guard, audit log

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: new migration (via `npx prisma migrate dev`)
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/validation/users.schema.ts`
- Modify: `backend/src/routes/users.ts`
- Modify: `backend/tests/helpers/fixtures.ts`
- Modify: `backend/tests/auth.test.ts`

**Interfaces:**
- Produces: `User.isActive: boolean` (Prisma field, default `true`);
  `toPublicUser()` in `users.ts` now includes `isActive` in every
  response — Task 2's frontend depends on this field being present in
  `GET /api/users`'s response shape.
- Consumes: existing `createUser`/`tokenFor` test fixtures, existing
  `Errors.forbidden`/`Errors.unauthenticated` helpers.

- [ ] **Step 1: Extend the test fixture to support creating a deactivated user**

Modify `backend/tests/helpers/fixtures.ts` — change `createUser`'s
overrides type and body to accept an optional `isActive`:

```typescript
export async function createUser(overrides: {
  email: string;
  role: Role;
  name?: string;
  departmentId?: string;
  branchId?: string;
  isActive?: boolean;
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
      isActive: overrides.isActive ?? true,
    },
  });
}
```

(Everything else in the file — `tokenFor` — is unchanged.)

- [ ] **Step 2: Write the failing test**

Add this test to `backend/tests/auth.test.ts`, inside the existing
`describe("auth", ...)` block, after the "rejects login with wrong
password" test:

```typescript
  it("rejects login for a deactivated account", async () => {
    const user = await createUser({
      email: "deactivated@test.com",
      role: "Agent",
      isActive: false,
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "deactivated@test.com",
      password: "Password123!",
    });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });
```

(This test creates the user directly via the fixture rather than
registering through the API, since `POST /api/auth/register` always
creates active `Customer` accounts and has no way to create a
pre-deactivated user — the fixture is the only path.)

- [ ] **Step 3: Run the test to confirm it fails**

Run: `cd backend && npm test -- auth.test.ts`
Expected: FAIL — `Property 'isActive' does not exist` (TypeScript) or,
if the fixture change alone doesn't fail to compile, the test itself
fails because the login route doesn't check `isActive` yet and
returns 200/tokens for the deactivated user.

- [ ] **Step 4: Add `isActive` to the Prisma schema and generate the migration**

In `backend/prisma/schema.prisma`, add one field to the `User` model,
directly after `role`:

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role
  isActive     Boolean  @default(true)
  name         String
  ...
```

Run: `cd backend && npx prisma migrate dev --name add_user_is_active`
This both applies the migration to `dev.db` and creates the migration
file under `backend/prisma/migrations/` that the test suite's
`globalSetup.ts` will pick up via `prisma migrate deploy` on its next
run.

- [ ] **Step 5: Reject login for a deactivated user**

In `backend/src/routes/auth.ts`, in the `POST /login` handler, add the
check immediately after the existing password-mismatch check (so both
failure paths return the identical error):

```typescript
router.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) throw Errors.unauthenticated("Invalid email or password");

  const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
  if (!passwordMatches) throw Errors.unauthenticated("Invalid email or password");

  if (!user.isActive) throw Errors.unauthenticated("Invalid email or password");

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });
  res.json({ user: toPublicUser(user), accessToken, refreshToken });
});
```

- [ ] **Step 6: Accept `isActive` in the update schema**

In `backend/src/validation/users.schema.ts`, add one field to
`updateUserSchema`:

```typescript
export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["Admin", "Manager", "Agent", "Customer"]).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});
```

- [ ] **Step 7: Return `isActive` from `toPublicUser`, guard self-deactivation, and log the edit**

In `backend/src/routes/users.ts`, update `toPublicUser`'s parameter
type and return shape to include `isActive`:

```typescript
function toPublicUser(user: {
  id: string;
  email: string;
  role: string;
  name: string;
  locale: string;
  departmentId: string | null;
  branchId: string | null;
  isActive: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    locale: user.locale,
    departmentId: user.departmentId,
    branchId: user.branchId,
    isActive: user.isActive,
  };
}
```

Then update the `PATCH /:id` handler to guard self-deactivation and
write an audit log entry (this route currently has no audit logging at
all — the spec's Out-of-Scope note asks to check this and add it if
missing):

```typescript
router.patch("/:id", requireAuth, requireRole("Admin"), async (req, res) => {
  const id = String(req.params.id);
  const body = updateUserSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("User not found");

  if (body.isActive === false && id === req.user!.id) {
    throw Errors.forbidden("Cannot deactivate your own account");
  }

  const user = await prisma.user.update({ where: { id }, data: body });
  await writeAuditLog(req.user!.id, "user.update", "User", user.id, body);
  res.json({ user: toPublicUser(user) });
});
```

- [ ] **Step 8: Run tests to confirm the new test passes and nothing else broke**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all test files pass, including the new "rejects login for a
deactivated account" test — full suite should now be 26 tests (25
existing + 1 new).

- [ ] **Step 9: Manually verify the dev server still boots and the migration applied cleanly**

Run: `cd backend && npm run dev`, then in another shell:
`curl -s http://localhost:4000/api/health` → `{"status":"ok"}`. Stop
the dev server after confirming.

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/routes/auth.ts backend/src/routes/users.ts backend/src/validation/users.schema.ts backend/tests/helpers/fixtures.ts backend/tests/auth.test.ts
git commit -m "feat: add user deactivation (isActive field, login enforcement, audit logging)"
```

---

### Task 2: Frontend — Users management page

**Files:**
- Modify: `frontend/src/lib/usersApi.ts`
- Create: `frontend/src/pages/admin/UsersPage.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `isActive`/`departmentId`/`branchId` now present in
  `GET /api/users`'s response shape (Task 1); `listDepartments`/
  `listBranches` from `frontend/src/lib/orgApi.ts` (existing); the
  `useAuth()` hook's `user.id`/`user.role` (existing).

- [ ] **Step 1: Extend `frontend/src/lib/usersApi.ts` with the fields and API calls this page needs**

Replace the file's content with:

```typescript
import { apiClient } from "./apiClient";
import type { Role } from "./authApi";

export interface StaffUser {
  id: string;
  email: string;
  role: Role;
  name: string;
  locale: "en" | "ar";
  departmentId: string | null;
  branchId: string | null;
  isActive: boolean;
}

export async function listUsersByRole(role: Role) {
  const { data } = await apiClient.get<{ users: StaffUser[] }>("/users", { params: { role } });
  return data.users;
}

export async function listAllUsers() {
  const { data } = await apiClient.get<{ users: StaffUser[] }>("/users");
  return data.users;
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  name: string;
  role: "Admin" | "Manager" | "Agent";
  departmentId?: string;
  branchId?: string;
}) {
  const { data } = await apiClient.post<{ user: StaffUser }>("/users", input);
  return data.user;
}

export async function updateStaffUser(
  id: string,
  input: Partial<{
    role: "Admin" | "Manager" | "Agent" | "Customer";
    departmentId: string | null;
    branchId: string | null;
    isActive: boolean;
  }>
) {
  const { data } = await apiClient.patch<{ user: StaffUser }>(`/users/${id}`, input);
  return data.user;
}
```

(`listUsersByRole` is kept unchanged — it's already used elsewhere,
e.g. the ticket-assignment agent dropdown — everything else is new.)

- [ ] **Step 2: Create `frontend/src/pages/admin/UsersPage.tsx`**

```tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStaffUser,
  listAllUsers,
  updateStaffUser,
} from "../../lib/usersApi";
import type { StaffUser } from "../../lib/usersApi";
import { listDepartments, listBranches } from "../../lib/orgApi";
import { extractApiErrorMessage } from "../../lib/apiClient";
import { useAuth } from "../../auth/AuthContext";

const STAFF_ROLES = ["Admin", "Manager", "Agent"] as const;

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["all-users"], queryFn: listAllUsers });
  const departmentsQuery = useQuery({ queryKey: ["departments"], queryFn: listDepartments });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number]>("Agent");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createStaffUser({
        email,
        password,
        name,
        role,
        departmentId: departmentId || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setName("");
      setRole("Agent");
      setDepartmentId("");
      setBranchId("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; changes: Parameters<typeof updateStaffUser>[1] }) =>
      updateStaffUser(input.id, input.changes),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  function handleFieldChange(u: StaffUser, field: "role" | "departmentId" | "branchId", value: string) {
    updateMutation.mutate({
      id: u.id,
      changes: {
        [field]: field === "role" ? value : value || null,
      } as Parameters<typeof updateStaffUser>[1],
    });
  }

  function handleToggleActive(u: StaffUser) {
    updateMutation.mutate({ id: u.id, changes: { isActive: !u.isActive } });
  }

  const staff = (usersQuery.data ?? []).filter((u) => u.role !== "Customer");

  return (
    <div className="page">
      <div className="page-header d-flex justify-content-between align-items-center mb-3">
        <h1>Users</h1>
      </div>
      {error && <p role="alert" className="alert alert-danger">{error}</p>}

      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h5 card-title">Create staff account</h2>
          <form onSubmit={handleCreate} className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-name">Name</label>
              <input id="new-user-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-email">Email</label>
              <input id="new-user-email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="new-user-password">Password</label>
              <input id="new-user-password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="col-md-2">
              <label className="form-label" htmlFor="new-user-role">Role</label>
              <select id="new-user-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-primary w-100" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </button>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-department">Department (optional)</label>
              <select id="new-user-department" className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">None</option>
                {departmentsQuery.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="new-user-branch">Branch (optional)</label>
              <select id="new-user-branch" className="form-select" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">None</option>
                {branchesQuery.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </form>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Branch</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={u.role}
                    onChange={(e) => handleFieldChange(u, "role", e.target.value)}
                    disabled={updateMutation.isPending}
                  >
                    {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={u.departmentId ?? ""}
                    onChange={(e) => handleFieldChange(u, "departmentId", e.target.value)}
                    disabled={updateMutation.isPending}
                  >
                    <option value="">None</option>
                    {departmentsQuery.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: "auto" }}
                    value={u.branchId ?? ""}
                    onChange={(e) => handleFieldChange(u, "branchId", e.target.value)}
                    disabled={updateMutation.isPending}
                  >
                    <option value="">None</option>
                    {branchesQuery.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.isActive ? "bg-success" : "bg-secondary"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  {u.id === currentUser?.id ? (
                    <span className="text-muted small">(you)</span>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-sm ${u.isActive ? "btn-outline-danger" : "btn-outline-success"}`}
                      onClick={() => handleToggleActive(u)}
                      disabled={updateMutation.isPending}
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link to `frontend/src/components/Layout.tsx`**

Add this `<li>` right after the existing "Departments & Branches"
link (both are `user.role === "Admin"`-gated, keep them adjacent):

```tsx
{user.role === "Admin" && (
  <li className="nav-item"><Link to="/admin/users" className="nav-link">Users</Link></li>
)}
```

- [ ] **Step 4: Add the route to `frontend/src/App.tsx`**

Add the import:
```typescript
import { UsersPage } from "./pages/admin/UsersPage";
```

Add the route, alongside the existing `/admin/sla-settings`/
`/admin/org-settings` routes:
```tsx
<Route
  path="/admin/users"
  element={
    <RequireAuth roles={["Admin"]}>
      <UsersPage />
    </RequireAuth>
  }
/>
```

- [ ] **Step 5: Verify in the browser**

Log in as Admin. Navigate to Users. Create an Agent, a Manager, and
another Admin — confirm each appears in the table. Change a staff
member's role and department via the inline selects — confirm it
saves (re-fetch/reload confirms persistence). Deactivate a non-self
staff account — confirm the badge flips to "Inactive" and the button
becomes "Reactivate". Confirm your own row shows "(you)" instead of a
deactivate button. Log out, attempt to log in as the deactivated
account — confirm it's rejected. At 375px width, confirm the table
scrolls horizontally within its own container with no page-level
overflow. No console errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/usersApi.ts frontend/src/pages/admin/UsersPage.tsx frontend/src/components/Layout.tsx frontend/src/App.tsx
git commit -m "feat: add Users management page (create/edit/deactivate staff, department/branch assignment)"
```

---

### Task 3: Verification and spec closeout

**Files:**
- Modify: `docs/specs/001-customer-support-crm/features/21-staff-user-management.md` (Status → Done, check acceptance criteria)
- Modify: `docs/verification.md` (add a row)
- Modify: `docs/specs/001-customer-support-crm/implementation-plan.md` (mark TASK-050 Done)

**Interfaces:** none — this task only verifies and documents.

- [ ] **Step 1: Run the full backend test suite from a clean state**

Run: `cd backend && rm -f prisma/test.db prisma/test.db-journal && npm test`
Expected: all tests pass (26 total: 25 from before + the new
deactivated-login test).

- [ ] **Step 2: Re-verify the TASK-042 department-scoping regression still holds**

Per the spec's verification plan: reassign a Manager's department via
the new Users page, then confirm (via curl or the UI) that Manager's
ticket list now reflects the new department scope — reusing the exact
scenario `org-scoping.test.ts` already automates, but observed live
through the new UI this time, to confirm the UI's department-edit
control actually changes real authorization behavior, not just the
displayed field.

- [ ] **Step 3: `npm run build` (frontend) succeeds**

Run: `cd frontend && npm run build`

- [ ] **Step 4: Update the spec, verification doc, and implementation plan**

In `21-staff-user-management.md`, change `## Status: Not Started` to
`## Status: Done` and check every acceptance-criteria box that's
genuinely true based on Steps 1-3. Add a row to `docs/verification.md`:
`| Staff user management (create/edit/deactivate, dept/branch assignment) | Full UI + curl-verified deactivated-login rejection | PASS |`.
In `docs/specs/001-customer-support-crm/implementation-plan.md`,
change TASK-050's status from `Not Started` to `Done` (find it in the
"Round 2" table).

- [ ] **Step 5: Commit**

```bash
git add docs/specs/001-customer-support-crm/features/21-staff-user-management.md docs/verification.md docs/specs/001-customer-support-crm/implementation-plan.md
git commit -m "docs: mark staff user management done, record verification"
```
