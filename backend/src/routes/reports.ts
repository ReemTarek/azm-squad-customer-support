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

router.get("/trends", requireAuth, requireRole("Admin", "Manager"), async (_req, res) => {
  const resolvedTickets = await prisma.ticket.findMany({
    where: { resolvedAt: { not: null } },
    select: { resolvedAt: true, resolutionDueAt: true },
  });
  const totalResolved = resolvedTickets.length;
  const totalBreached = resolvedTickets.filter((t) => t.resolvedAt!.getTime() > t.resolutionDueAt.getTime()).length;
  const slaBreachRatePercent = totalResolved === 0 ? 0 : Math.round((totalBreached / totalResolved) * 100);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const countsByDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    countsByDay.set(day, 0);
  }
  for (const t of recentTickets) {
    const day = t.createdAt.toISOString().slice(0, 10);
    if (countsByDay.has(day)) countsByDay.set(day, countsByDay.get(day)! + 1);
  }

  res.json({
    slaBreachRatePercent,
    totalResolved,
    totalBreached,
    ticketsCreatedPerDay: Array.from(countsByDay.entries()).map(([date, count]) => ({ date, count })),
  });
});

export default router;
