# Feature Spec: Aggregate CSAT + Agent Performance Reports

**Requirement:** CRM-REPORT-003
**Related task:** TASK-030

> **Process note:** written after implementation — see
> `features/14a-kb-search.md` for why, applies identically here.

## Goal

Roll up the individual customer-satisfaction ratings (captured since
TASK-024/P1) into an aggregate report metric, and show per-agent
resolution performance — both were captured as gaps in
`gap-analysis.md` (individual ratings existed but were never
summarized; ticket counts per agent existed but not resolution speed).

## Assumptions

- Simple arithmetic mean for CSAT (rounded to 1 decimal), not a
  weighted or time-decayed score — appropriate at this data volume.
- "Agent performance" means resolved-ticket count + average
  resolution time per agent; not response-time SLA compliance
  specifically (that's covered separately by the SLA breach-rate
  metric already on the same page).

## Scope

- `GET /reports/trends` extended with `avgCsatRating`, `csatCount`,
  and `agentPerformance` (per agent: `resolvedCount`,
  `avgResolutionMinutes`).
- Two new report cards on the existing Reports page.

Out of scope: CSAT trend-over-time (only the current aggregate),
per-agent CSAT breakdown (only resolution speed, not satisfaction, is
attributed per-agent).

## Acceptance criteria

- [x] `avgCsatRating`/`csatCount` match a manual count of
      `CustomerFeedback` rows.
- [x] Per-agent `resolvedCount`/`avgResolutionMinutes` match a manual
      per-agent query over resolved tickets.
- [x] Agent role remains blocked from the endpoint (pre-existing
      guard, unaffected by this addition).

## Implementation

`backend/src/routes/reports.ts` (`GET /trends`),
`frontend/src/pages/ReportsPage.tsx`.

## Verification

curl, cross-checked against a manual Prisma script for both the CSAT
average and one agent's resolved-count/avg-resolution-time — exact
match in both cases.

## Status: Done
