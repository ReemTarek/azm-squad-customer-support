import { Router } from "express";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { UPLOAD_DIR } from "../lib/upload";
import { assertTicketAccess } from "./tickets";

const router = Router();

router.get("/:id", requireAuth, async (req, res) => {
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

  res.download(path.join(UPLOAD_DIR, attachment.storagePath), attachment.fileName);
});

export default router;
