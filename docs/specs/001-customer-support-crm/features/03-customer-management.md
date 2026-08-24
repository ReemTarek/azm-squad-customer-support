# Feature Spec: Customer Management

**Requirement:** CRM-CUSTOMER-001
**Related task:** TASK-005

## Goal
Admin/Agent can manage customer records; a Customer can view/edit only
their own.

## Scope
- Create, list (with search), view, update customer records.
- Every Customer is a `User` row (role=Customer) with a 1:1
  `CustomerProfile` for phone/company — unifies login with staff
  accounts (see `docs/specs/001-customer-support-crm/decisions.md`).

Out of scope: customer merge/dedupe, import, soft delete.

## Acceptance criteria
- [x] Admin/Agent creates a customer → persisted → appears in list.
- [x] Customer views/edits their own record.
- [x] Customer requesting another customer's record → 403.
- [x] Search with no matches → empty list, not an error.

## Implementation
- Backend: `backend/src/routes/customers.ts` (ownership check: a
  Customer-role request is only allowed when `req.user.id === :id`).
- Frontend: `frontend/src/pages/customers/` (list, new form, detail/edit).

## Verification
`docs/verification.md`: "Customer creation", "Cross-customer record
access", "Empty search result" rows — all PASS.

## Status: Done
