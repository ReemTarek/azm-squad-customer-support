# Feature Spec: Authentication & Role-Based Authorization

**Requirement:** CRM-AUTH-001, CRM-AUTHZ-001
**Related tasks:** TASK-003, TASK-004

## Goal
Every user (Admin/Manager/Agent/Customer) logs in through one unified
flow, and every protected route enforces role + ownership rules.

## Scope
- Register (Customer self-service only) / Login / Refresh via JWT
  (15m access token, 7d refresh token).
- `requireAuth` (verifies JWT) + `requireRole(...roles)` middleware,
  applied to every non-public route.
- Ownership checks layered on top of role checks in service code where
  a role alone isn't enough (e.g. a Customer viewing a ticket must also
  own it — see 04-ticket-management.md).

Out of scope: OAuth/SSO, password reset flow, MFA, refresh-token
revocation list (refresh tokens are stateless JWTs — see
`docs/specs/001-customer-support-crm/decisions.md` trade-off note).

## Acceptance criteria
- [x] Register → login → authenticated dashboard shell.
- [x] Wrong password → 401, no token issued, clear UI error.
- [x] Missing / malformed / expired access token → 401.
- [x] Wrong-role access to a role-gated route → 403.
- [x] Refresh token rotates access+refresh tokens; invalid refresh
      token → 401.

## Implementation
- Backend: `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`,
  `backend/src/lib/jwt.ts`.
- Frontend: `frontend/src/auth/AuthContext.tsx` (token storage +
  current-user fetch), `frontend/src/auth/RequireAuth.tsx` (route
  guard), `frontend/src/lib/apiClient.ts` (refresh-on-401 interceptor),
  `LoginPage.tsx` / `RegisterPage.tsx`.

## Verification
`docs/verification.md`: Registration/Login, Invalid credentials,
Missing/expired JWT, RBAC rows — all PASS (curl + Playwright).

## Status: Done
