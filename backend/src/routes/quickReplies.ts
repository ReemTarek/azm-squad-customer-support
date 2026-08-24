import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createQuickReplySchema } from "../validation/quickReplies.schema";

const router = Router();

router.get("/", requireAuth, requireRole("Admin", "Manager", "Agent"), async (_req, res) => {
  const quickReplies = await prisma.quickReply.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ quickReplies });
});

router.post("/", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const body = createQuickReplySchema.parse(req.body);
  const quickReply = await prisma.quickReply.create({
    data: { title: body.title, body: body.body, authorId: req.user!.id },
  });
  res.status(201).json({ quickReply });
});

router.delete("/:id", requireAuth, requireRole("Admin", "Manager", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.quickReply.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Quick reply not found");
  if (req.user!.role === "Agent" && existing.authorId !== req.user!.id) {
    throw Errors.forbidden("Only the author or an Admin/Manager can delete this quick reply");
  }

  await prisma.quickReply.delete({ where: { id } });
  res.status(204).send();
});

export default router;
