import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireRole("Admin"), async (req, res) => {
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;

  const logs = await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, email: true } } },
  });

  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      actorName: l.actor.name,
      actorEmail: l.actor.email,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata ? JSON.parse(l.metadata) : null,
      createdAt: l.createdAt,
    })),
  });
});

export default router;
