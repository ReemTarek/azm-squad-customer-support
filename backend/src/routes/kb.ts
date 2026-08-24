import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { createArticleSchema, updateArticleSchema } from "../validation/kb.schema";
import { writeAuditLog } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const isStaff = req.user!.role !== "Customer";
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const articles = await prisma.knowledgeBaseArticle.findMany({
    where: {
      ...(isStaff ? {} : { published: true }),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { body: { contains: search } },
              { category: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ articles });
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const article = await prisma.knowledgeBaseArticle.findUnique({ where: { id } });
  if (!article) throw Errors.notFound("Article not found");
  if (req.user!.role === "Customer" && !article.published) throw Errors.notFound("Article not found");
  res.json({ article });
});

router.post("/", requireAuth, requireRole("Admin", "Agent"), async (req, res) => {
  const body = createArticleSchema.parse(req.body);
  const article = await prisma.knowledgeBaseArticle.create({
    data: { ...body, authorId: req.user!.id },
  });
  res.status(201).json({ article });
});

router.patch("/:id", requireAuth, requireRole("Admin", "Agent"), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.knowledgeBaseArticle.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Article not found");
  if (req.user!.role === "Agent" && existing.authorId !== req.user!.id) {
    throw Errors.forbidden("Only the author or an Admin can edit this article");
  }

  const body = updateArticleSchema.parse(req.body);
  const article = await prisma.knowledgeBaseArticle.update({ where: { id }, data: body });

  if (body.published !== undefined && body.published !== existing.published) {
    await writeAuditLog(req.user!.id, body.published ? "kb.publish" : "kb.unpublish", "KnowledgeBaseArticle", id);
  }

  res.json({ article });
});

export default router;
