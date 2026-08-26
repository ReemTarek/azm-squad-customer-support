import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { upload, UPLOAD_DIR } from "../lib/upload";
import { updateBrandingSchema } from "../validation/branding.schema";
import { writeAuditLog } from "../lib/audit";
import type { BrandingConfig } from "@prisma/client";

const router = Router();

const SINGLETON_ID = "singleton";

function toBrandingDto(config: BrandingConfig | null) {
  return {
    appName: config?.appName ?? null,
    primaryColor: config?.primaryColor ?? null,
    logoUrl: config?.logoPath ? "/api/admin/branding/logo" : null,
  };
}

router.get("/", async (_req, res) => {
  const config = await prisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });
  res.json({ config: toBrandingDto(config) });
});

router.get("/logo", async (_req, res, next) => {
  const config = await prisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!config?.logoPath) throw Errors.notFound("No logo configured");

  // Defense in depth: logoPath is always server-generated (a random
  // UUID filename with no path separators — see lib/upload.ts), so this
  // join can never actually escape UPLOAD_DIR today. Checking it anyway
  // matches the same guarantee attachments.ts keeps local to its route.
  const filePath = path.resolve(UPLOAD_DIR, config.logoPath);
  if (filePath !== UPLOAD_DIR && !filePath.startsWith(UPLOAD_DIR + path.sep)) {
    throw Errors.notFound("No logo configured");
  }

  res.sendFile(filePath, (err) => {
    if (err) next(Errors.notFound("Logo file not found"));
  });
});

router.patch("/", requireAuth, requireRole("Admin"), upload.single("logo"), async (req, res) => {
  const body = updateBrandingSchema.parse(req.body);
  const existing = await prisma.brandingConfig.findUnique({ where: { id: SINGLETON_ID } });

  const data: { appName?: string | null; primaryColor?: string | null; logoPath?: string | null } = {};
  if (body.appName !== undefined) data.appName = body.appName === "" ? null : body.appName;
  if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor === "" ? null : body.primaryColor;

  if (req.file) {
    data.logoPath = req.file.filename;
  } else if (body.removeLogo === "true") {
    data.logoPath = null;
  }

  // Best-effort cleanup of the previous logo file when it's being
  // replaced or removed — a cleanup failure never fails the request
  // (caught and logged, not thrown), but IS awaited before responding
  // so that by the time a client sees the response, the old file has
  // genuinely already been deleted (or the failure already logged) —
  // not still in flight. This keeps the response a reliable signal of
  // the operation's actual on-disk state instead of a race between the
  // response and a background unlink.
  if (data.logoPath !== undefined && existing?.logoPath && existing.logoPath !== data.logoPath) {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, existing.logoPath));
    } catch (err) {
      console.error("Old logo file cleanup failed (non-fatal):", err);
    }
  }

  const config = await prisma.brandingConfig.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });

  await writeAuditLog(req.user!.id, "branding.update", "BrandingConfig", config.id, data);

  res.json({ config: toBrandingDto(config) });
});

export default router;
