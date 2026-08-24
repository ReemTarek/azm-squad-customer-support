import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/summary", requireAuth, requireRole("Admin", "Manager"), async (_req, res) => {
  const [byStatus, byPriority, resolvedTickets, byAgent] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.ticket.groupBy({
      by: ["assignedAgentId"],
      _count: { _all: true },
      where: { assignedAgentId: { not: null } },
    }),
  ]);

  const avgResolutionMinutes = resolvedTickets.length
    ? Math.round(
        resolvedTickets.reduce(
          (sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60_000,
          0
        ) / resolvedTickets.length
      )
    : null;

  const agentIds = byAgent.map((a) => a.assignedAgentId).filter((id): id is string => Boolean(id));
  const agents = await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  res.json({
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count._all })),
    avgResolutionMinutes,
    ticketsPerAgent: byAgent.map((a) => ({
      agentId: a.assignedAgentId,
      agentName: agentNameById.get(a.assignedAgentId!) ?? "Unknown",
      count: a._count._all,
    })),
  });
});

export default router;
