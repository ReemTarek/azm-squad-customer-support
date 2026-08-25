// backend/tests/liveChatSocket.test.ts
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import type { Socket as ClientSocket } from "socket.io-client";
import app from "../src/app";
import { createSocketServer, registerSocketHandlers } from "../src/lib/socket";
import { createUser, tokenFor } from "./helpers/fixtures";

let httpServer: ReturnType<typeof createServer>;
let baseUrl: string;
let io: ReturnType<typeof createSocketServer>;

beforeAll(async () => {
  httpServer = createServer(app);
  io = createSocketServer(httpServer);
  registerSocketHandlers(io);
  // Critical: the REST route handlers (in Task 3) emit via
  // `req.app.locals.io` — the same `app` instance is imported by both
  // this test file and every REST call made through `request(app)`
  // below, so wiring this `io` in here is what makes a `request(app).post(...)`
  // call in a test actually reach the sockets this file connects.
  // Without this line, every socket event assertion in this file would
  // hang until its `testTimeout` and fail, since the route handlers'
  // `io?.to(...)` would silently be a no-op against `undefined`.
  app.locals.io = io;
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  // Undo the app.locals.io wiring from beforeAll — this project's vitest
  // config runs every test file sequentially in one shared forked
  // process (see vitest.config.ts's comment on fileParallelism/pool),
  // so the same imported `app` module instance is reused across every
  // test file in the run. Leaving `io` attached here would leak into
  // liveChat.test.ts's Supertest-only tests, silently changing their
  // "REST works correctly with no socket server attached" guarantee
  // depending on file run order.
  delete app.locals.io;
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connect(token: string | undefined): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      auth: token !== undefined ? { token } : {},
      reconnection: false,
      forceNew: true,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
}

describe("live chat socket auth handshake", () => {
  it("accepts a connection with a valid access token", async () => {
    const agent = await createUser({ email: "socketagent@test.com", role: "Agent" });
    const socket = await connect(tokenFor(agent));
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it("rejects a connection with a missing token", async () => {
    await expect(connect(undefined)).rejects.toBeTruthy();
  });

  it("rejects a connection with an invalid token", async () => {
    await expect(connect("not-a-real-token")).rejects.toBeTruthy();
  });
});
