// backend/tests/liveChatSocket.test.ts
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import type { Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
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

describe("live chat socket room scoping", () => {
  it("a customer can join their own session's room and receive a message event", async () => {
    const customer = await createUser({ email: "socketcust@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${token}`);
    const sessionId = createRes.body.session.id;

    const socket = await connect(token);
    const joinAck = await new Promise<{ ok: boolean }>((resolve) =>
      socket.emit("join-session", { sessionId }, resolve)
    );
    expect(joinAck.ok).toBe(true);

    const messageEvent = new Promise((resolve) => socket.once("message:new", resolve));

    const agent = await createUser({ email: "socketagent2@test.com", role: "Agent" });
    await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/claim`)
      .set("Authorization", `Bearer ${tokenFor(agent)}`);
    await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${tokenFor(agent)}`)
      .send({ body: "live push test" });

    const received = (await messageEvent) as { body: string };
    expect(received.body).toBe("live push test");
    socket.disconnect();
  });

  it("rejects a stray join-session attempt for a session the socket's user doesn't own", async () => {
    const customerA = await createUser({ email: "socketcusta@test.com", role: "Customer" });
    const customerB = await createUser({ email: "socketcustb@test.com", role: "Customer" });

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customerA)}`);
    const sessionId = createRes.body.session.id;

    const socketB = await connect(tokenFor(customerB));
    const joinAck = await new Promise<{ ok: boolean; error?: string }>((resolve) =>
      socketB.emit("join-session", { sessionId }, resolve)
    );
    expect(joinAck.ok).toBe(false);
    socketB.disconnect();
  });

  it("an agent auto-joins the shared agents room and receives queue:new-session", async () => {
    const agent = await createUser({ email: "socketagent3@test.com", role: "Agent" });
    const socket = await connect(tokenFor(agent));

    const queueEvent = new Promise((resolve) => socket.once("queue:new-session", resolve));

    const customer = await createUser({ email: "socketcust3@test.com", role: "Customer" });
    await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${tokenFor(customer)}`);

    const received = (await queueEvent) as { customerId: string };
    expect(received.customerId).toBe(customer.id);
    socket.disconnect();
  });

  it("ending a session removes every joined socket from that session's room", async () => {
    const customer = await createUser({ email: "socketcust4@test.com", role: "Customer" });
    const token = tokenFor(customer);

    const createRes = await request(app)
      .post("/api/live-chat/sessions")
      .set("Authorization", `Bearer ${token}`);
    const sessionId = createRes.body.session.id;

    const socket = await connect(token);
    await new Promise<{ ok: boolean }>((resolve) => socket.emit("join-session", { sessionId }, resolve));

    // Confirm the room actually has a member before ending — otherwise
    // an empty-room false positive after `end` would prove nothing.
    expect(io.sockets.adapter.rooms.get(sessionId)?.size).toBe(1);

    const endedEvent = new Promise((resolve) => socket.once("session:ended", resolve));
    await request(app)
      .post(`/api/live-chat/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${token}`);
    await endedEvent;

    // `socketsLeave()` runs synchronously within the same event-loop
    // turn as the response the client already awaited above, but leave
    // one microtask's worth of room for Socket.IO's internal adapter
    // bookkeeping to settle before asserting on it directly.
    await new Promise((resolve) => setImmediate(resolve));
    expect(io.sockets.adapter.rooms.get(sessionId)).toBeUndefined();

    socket.disconnect();
  });
});
