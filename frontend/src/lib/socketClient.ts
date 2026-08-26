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
