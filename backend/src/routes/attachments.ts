import { Router } from "express";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { UPLOAD_DIR } from "../lib/upload";
import { assertTicketAccess } from "./tickets";

const router = Router();

router.get("/:id", requireAuth, async (req, res, next) => {
  const user = req.user!;
  const id = String(req.params.id);

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { ticketMessage: { select: { ticketId: true, isInternalNote: true } } },
  });
  if (!attachment) throw Errors.notFound("Attachment not found");

  if (attachment.ticketMessageId && attachment.ticketMessage) {
    await assertTicketAccess(attachment.ticketMessage.ticketId, user);
    if (user.role === "Customer" && attachment.ticketMessage.isInternalNote) {
      throw Errors.forbidden("Cannot access this attachment");
    }
  } else if (attachment.customerId) {
    if (user.role === "Customer") {
      throw Errors.forbidden("Cannot access this attachment");
    }
  } else {
    throw Errors.forbidden("Cannot access this attachment");
  }

  // Defense in depth: storagePath is always server-generated (a random UUID
  // filename with no path separators — see lib/upload.ts), so this join can
  // never actually escape UPLOAD_DIR today. Checking it anyway keeps that
  // guarantee local to this route instead of depending on an invariant
  // enforced only elsewhere.
  const filePath = path.resolve(UPLOAD_DIR, attachment.storagePath);
  if (filePath !== UPLOAD_DIR && !filePath.startsWith(UPLOAD_DIR + path.sep)) {
    throw Errors.notFound("Attachment not found");
  }

  res.download(filePath, attachment.fileName, (err) => {
    if (err) next(Errors.notFound("Attachment file not found"));
  });
});

export default router;
