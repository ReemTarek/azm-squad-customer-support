import { io, type Socket } from "socket.io-client";
import { tokenStorage } from "./tokenStorage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const socketUrl = apiBaseUrl.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl, {
      // Passed as a callback (not a static object) so socket.io-client
      // re-invokes it — pulling a fresh token from storage — on every
      // (re)connection attempt, not just the first. This covers both
      // the initial connect and every automatic reconnection attempt
      // the library makes on its own after a drop, so a token that was
      // refreshed mid-session (or a socket surviving a login/logout
      // cycle) always reconnects with the current identity's token.
      auth: (cb) => cb({ token: tokenStorage.getAccessToken() ?? "" }),
      autoConnect: false,
    });

    // The server's periodic re-auth check (backend/src/lib/socket.ts)
    // disconnects a socket whose handshake token has since expired, even
    // if the user holds a valid refreshed access token at the HTTP layer
    // (refreshed independently by apiClient's 401 interceptor, which never
    // touches this socket). Socket.IO does NOT auto-reconnect after a
    // server-initiated disconnect ("io server disconnect") by design, so
    // without this the socket would go silently and permanently dead for
    // an actively-chatting, fully legitimate user. Reconnecting manually
    // re-invokes the auth callback above, which pulls the current
    // (already-refreshed) token — so a still-valid user reconnects
    // seamlessly, and only a genuinely logged-out/expired user falls
    // through to the connect_error handling already wired up in
    // ChatPage.tsx/LiveChatQueuePage.tsx.
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        socket?.connect();
      }
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/**
 * Tears down the shared socket singleton entirely (disconnects and
 * drops the reference so the next getSocket()/connectSocket() call
 * creates a brand new instance). Must be called on logout, and before
 * a new identity is established on login/register, so a still-
 * connected socket from a previous session on the same tab/browser
 * context can never keep receiving events (or send messages) under
 * the new user's session.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
