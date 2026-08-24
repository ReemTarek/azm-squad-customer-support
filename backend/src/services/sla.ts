import { Priority } from "@prisma/client";
import { prisma } from "../lib/prisma";

const FALLBACK_SLA_MINUTES: Record<Priority, { responseMinutes: number; resolutionMinutes: number }> = {
  Urgent: { responseMinutes: 30, resolutionMinutes: 4 * 60 },
  High: { responseMinutes: 2 * 60, resolutionMinutes: 8 * 60 },
  Medium: { responseMinutes: 8 * 60, resolutionMinutes: 24 * 60 },
  Low: { responseMinutes: 24 * 60, resolutionMinutes: 72 * 60 },
};

/**
 * SLA thresholds are admin-editable (SlaPolicy table). Falls back to
 * hardcoded defaults only if a row is somehow missing (e.g. seed
 * hasn't run yet) so the app never hard-fails on a missing policy.
 */
export async function computeSlaDueDates(priority: Priority, from: Date = new Date()) {
  const policy = await prisma.slaPolicy.findUnique({ where: { priority } });
  const { responseMinutes, resolutionMinutes } = policy ?? FALLBACK_SLA_MINUTES[priority];
  return {
    responseDueAt: new Date(from.getTime() + responseMinutes * 60_000),
    resolutionDueAt: new Date(from.getTime() + resolutionMinutes * 60_000),
  };
}

export type SlaState = "on_track" | "at_risk" | "breached";

const AT_RISK_THRESHOLD_FRACTION = 0.2;

/**
 * on_track: plenty of the resolution window remains.
 * at_risk: less than 20% of the window (createdAt -> resolutionDueAt) remains.
 * breached: past resolutionDueAt (or resolved after it).
 */
export function computeSlaState(
  createdAt: Date,
  resolutionDueAt: Date,
  resolvedAt: Date | null,
  now: Date = new Date()
): SlaState {
  const reference = resolvedAt ?? now;
  if (reference.getTime() > resolutionDueAt.getTime()) return "breached";

  const totalWindowMs = resolutionDueAt.getTime() - createdAt.getTime();
  const remainingMs = resolutionDueAt.getTime() - reference.getTime();

  return remainingMs <= totalWindowMs * AT_RISK_THRESHOLD_FRACTION ? "at_risk" : "on_track";
}
