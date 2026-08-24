import { beforeAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

async function resetDb() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.ticketTask.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.customerFeedback.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.quickReply.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.knowledgeBaseArticle.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.branch.deleteMany();
}

async function seedSlaPolicies() {
  const defaults = [
    { priority: "Urgent" as const, responseMinutes: 30, resolutionMinutes: 240 },
    { priority: "High" as const, responseMinutes: 120, resolutionMinutes: 480 },
    { priority: "Medium" as const, responseMinutes: 480, resolutionMinutes: 1440 },
    { priority: "Low" as const, responseMinutes: 1440, resolutionMinutes: 4320 },
  ];
  for (const d of defaults) {
    await prisma.slaPolicy.upsert({ where: { priority: d.priority }, update: {}, create: d });
  }
}

beforeAll(async () => {
  await seedSlaPolicies();
});

beforeEach(async () => {
  await resetDb();
});
