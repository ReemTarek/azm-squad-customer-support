-- CreateTable
CREATE TABLE "LiveChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "assignedAgentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Waiting',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "LiveChatSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveChatSession_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LiveChatSession_customerId_idx" ON "LiveChatSession"("customerId");

-- CreateIndex
CREATE INDEX "LiveChatSession_assignedAgentId_idx" ON "LiveChatSession"("assignedAgentId");

-- CreateIndex
CREATE INDEX "LiveChatSession_status_idx" ON "LiveChatSession"("status");

-- CreateIndex
CREATE INDEX "LiveChatMessage_sessionId_idx" ON "LiveChatMessage"("sessionId");
