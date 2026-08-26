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
      // Stashed so the periodic re-verification below (see
      // registerSocketHandlers) has the original handshake token to
      // re-check — it is never re-sent by the client after connect.
      socket.data.token = token;
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

// How often a long-lived, never-disconnected socket has its original
// handshake token re-verified. Access tokens expire after 15 minutes,
// so this guarantees a socket connected under an expired/revoked token
// is force-disconnected within 5 minutes of expiry, rather than
// staying alive indefinitely just because it never happened to drop.
// Disconnecting drives the client through its reconnect-with-fresh-
// token path (socketClient.ts's callback-form `auth` option).
const TOKEN_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

export function registerSocketHandlers(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as { id: string; role: Role };

    if (user.role === "Admin" || user.role === "Manager" || user.role === "Agent") {
      socket.join("agents");
    }

    const revalidationTimer = setInterval(() => {
      try {
        verifyAccessToken(socket.data.token as string);
      } catch {
        socket.disconnect(true);
      }
    }, TOKEN_REVALIDATION_INTERVAL_MS);

    socket.on("disconnect", () => {
      clearInterval(revalidationTimer);
    });

    socket.on(
      "join-session",
      async (payload: { sessionId?: string }, ack?: (res: JoinSessionAck) => void) => {
        const sessionId = payload?.sessionId;
        if (!sessionId) {
          ack?.({ ok: false, error: "sessionId is required" });
          return;
        }

        let session;
        try {
          session = await prisma.liveChatSession.findUnique({ where: { id: sessionId } });
        } catch {
          ack?.({ ok: false, error: "Failed to look up session" });
          return;
        }
        if (!session) {
          ack?.({ ok: false, error: "Session not found" });
          return;
        }
        if (session.status === "Ended") {
          ack?.({ ok: false, error: "This chat session has ended" });
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
