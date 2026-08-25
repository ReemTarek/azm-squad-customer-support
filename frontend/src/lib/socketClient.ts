import { io, type Socket } from "socket.io-client";
import { tokenStorage } from "./tokenStorage";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const socketUrl = apiBaseUrl.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl, {
      auth: { token: tokenStorage.getAccessToken() ?? "" },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  // Refresh the auth token on every (re)connect attempt, in case it
  // changed since the socket was first created (e.g. after a login).
  s.auth = { token: tokenStorage.getAccessToken() ?? "" };
  if (!s.connected) s.connect();
  return s;
}
