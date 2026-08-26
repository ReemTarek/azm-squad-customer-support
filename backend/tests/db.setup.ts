import { beforeAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

// Safety guard: resetDb() wipes entire tables via deleteMany(). The only thing
// standing between this and destroying a real database is DATABASE_URL
// actually pointing at the isolated test.db. Fail loudly and immediately
// (before any deleteMany() runs) if that ever isn't the case.
function assertTestDatabase() {
  if (!/test\.db/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error(`Refusing to run tests: DATABASE_URL is ${process.env.DATABASE_URL}`);
  }
}

async function resetDb() {
  assertTestDatabase();
  // Delete Attachment rows before anything they reference (TicketMessage,
  // User) — a normal attachment cascades away with its parent TicketMessage,
  // but a row with neither ticketMessageId nor customerId set (e.g. the
  // invariant-violation fixture in attachments.test.ts) has no cascade path
  // and would otherwise block deleting the uploader User below.
  await prisma.attachment.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.liveChatMessage.deleteMany();
  await prisma.liveChatSession.deleteMany();
  await prisma.ticketTask.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.customerFeedback.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.aiUsageEvent.deleteMany();
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
  // SlaPolicy is deliberately excluded from resetDb() so it doesn't need to be
  // reseeded per-test, but reseed it here anyway (upsert is idempotent) so a
  // future test that mutates /api/admin/sla-config can't leave shared state
  // that leaks into subsequent tests across files.
  await seedSlaPolicies();
});
