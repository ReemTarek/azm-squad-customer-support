import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import type { Socket } from "socket.io";
import { verifyAccessToken } from "./jwt";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      next(new Error("Missing token"));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  return io;
}

interface JoinSessionAck {
  ok: boolean;
  error?: string;
}

export function registerSocketHandlers(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as { id: string; role: Role };

    if (user.role === "Admin" || user.role === "Manager" || user.role === "Agent") {
      socket.join("agents");
    }

    socket.on(
      "join-session",
      async (payload: { sessionId?: string }, ack?: (res: JoinSessionAck) => void) => {
        const sessionId = payload?.sessionId;
        if (!sessionId) {
          ack?.({ ok: false, error: "sessionId is required" });
          return;
        }

        const session = await prisma.liveChatSession.findUnique({ where: { id: sessionId } });
        if (!session) {
          ack?.({ ok: false, error: "Session not found" });
          return;
        }

        const allowed =
          (user.role === "Customer" && session.customerId === user.id) ||
          (user.role === "Agent" && session.assignedAgentId === user.id) ||
          user.role === "Admin" ||
          user.role === "Manager";

        if (!allowed) {
          ack?.({ ok: false, error: "Not allowed to join this session" });
          return;
        }

        socket.join(sessionId);
        ack?.({ ok: true });
      }
    );
  });
}
