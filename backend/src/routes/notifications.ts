import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { computeSlaState } from "../services/sla";

const router = Router();

router.get("/summary", requireAuth, async (req, res) => {
  const user = req.user!;
  const where: Record<string, unknown> = { status: { in: ["Open", "InProgress"] } };

  if (user.role === "Customer") {
    where.customerId = user.id;
  } else if (user.role === "Agent") {
    where.assignedAgentId = user.id;
  }

  const tickets = await prisma.ticket.findMany({ where, select: { createdAt: true, resolutionDueAt: true, resolvedAt: true } });

  let breachedCount = 0;
  let atRiskCount = 0;
  for (const t of tickets) {
    const state = computeSlaState(t.createdAt, t.resolutionDueAt, t.resolvedAt);
    if (state === "breached") breachedCount++;
    else if (state === "at_risk") atRiskCount++;
  }

  res.json({ breachedCount, atRiskCount });
});

export default router;
