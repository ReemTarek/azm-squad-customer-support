import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

/**
 * Same Manager department/branch scoping as tickets.ts — a Manager's
 * report numbers are restricted to their own department/branch if
 * they have one set, so reports can't be used to see cross-department
 * data that the ticket list/detail endpoints already block.
 */
async function getOrgScopeWhere(user: { id: string; role: string }): Promise<Record<string, unknown>> {
  if (user.role !== "Manager") return {};

  const managerRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { departmentId: true, branchId: true },
  });
  const where: Record<string, unknown> = {};
  if (managerRecord?.departmentId) where.departmentId = managerRecord.departmentId;
  if (managerRecord?.branchId) where.branchId = managerRecord.branchId;
  return where;
}

router.get("/summary", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const orgWhere = await getOrgScopeWhere(req.user!);

  const [byStatus, byPriority, byDepartment, resolvedTickets, byAgent] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: orgWhere, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], where: orgWhere, _count: { _all: true } }),
    prisma.ticket.groupBy({
      by: ["departmentId"],
      // orgWhere.departmentId (if a scoped Manager) must win over the
      // "exclude nulls" default — spreading orgWhere first and this key
      // second would silently drop the Manager's own department scope.
      where: { ...orgWhere, departmentId: orgWhere.departmentId ?? { not: null } },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { ...orgWhere, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.ticket.groupBy({
      by: ["assignedAgentId"],
      _count: { _all: true },
      where: { ...orgWhere, assignedAgentId: { not: null } },
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

  const departmentIds = byDepartment.map((d) => d.departmentId).filter((id): id is string => Boolean(id));
  const departments = await prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } });
  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]));

  res.json({
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count._all })),
    byDepartment: byDepartment.map((d) => ({
      departmentId: d.departmentId,
      departmentName: departmentNameById.get(d.departmentId!) ?? "Unknown",
      count: d._count._all,
    })),
    avgResolutionMinutes,
    ticketsPerAgent: byAgent.map((a) => ({
      agentId: a.assignedAgentId,
      agentName: agentNameById.get(a.assignedAgentId!) ?? "Unknown",
      count: a._count._all,
    })),
  });
});

router.get("/trends", requireAuth, requireRole("Admin", "Manager"), async (req, res) => {
  const orgWhere = await getOrgScopeWhere(req.user!);

  const resolvedTickets = await prisma.ticket.findMany({
    where: { ...orgWhere, resolvedAt: { not: null } },
    select: { resolvedAt: true, resolutionDueAt: true },
  });
  const totalResolved = resolvedTickets.length;
  const totalBreached = resolvedTickets.filter((t) => t.resolvedAt!.getTime() > t.resolutionDueAt.getTime()).length;
  const slaBreachRatePercent = totalResolved === 0 ? 0 : Math.round((totalBreached / totalResolved) * 100);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTickets = await prisma.ticket.findMany({
    where: { ...orgWhere, createdAt: { gte: sevenDaysAgo } },
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

  const feedback = await prisma.customerFeedback.findMany({
    where: { ticket: orgWhere },
    select: { rating: true },
  });
  const avgCsatRating = feedback.length
    ? Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length) * 10) / 10
    : null;

  const resolvedByAgent = await prisma.ticket.findMany({
    where: { ...orgWhere, resolvedAt: { not: null }, assignedAgentId: { not: null } },
    select: { assignedAgentId: true, createdAt: true, resolvedAt: true },
  });
  const perAgent = new Map<string, { totalMinutes: number; count: number }>();
  for (const t of resolvedByAgent) {
    const agentId = t.assignedAgentId!;
    const minutes = (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60_000;
    const entry = perAgent.get(agentId) ?? { totalMinutes: 0, count: 0 };
    entry.totalMinutes += minutes;
    entry.count += 1;
    perAgent.set(agentId, entry);
  }
  const perfAgents = await prisma.user.findMany({
    where: { id: { in: Array.from(perAgent.keys()) } },
    select: { id: true, name: true },
  });
  const agentPerformance = perfAgents.map((a) => {
    const entry = perAgent.get(a.id)!;
    return {
      agentId: a.id,
      agentName: a.name,
      resolvedCount: entry.count,
      avgResolutionMinutes: Math.round(entry.totalMinutes / entry.count),
    };
  });

  res.json({
    slaBreachRatePercent,
    totalResolved,
    totalBreached,
    ticketsCreatedPerDay: Array.from(countsByDay.entries()).map(([date, count]) => ({ date, count })),
    avgCsatRating,
    csatCount: feedback.length,
    agentPerformance,
  });
});

export default router;
