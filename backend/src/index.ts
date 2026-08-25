import { createServer } from "node:http";
import app from "./app";
import { env } from "./config/env";
import { createSocketServer, registerSocketHandlers } from "./lib/socket";

const httpServer = createServer(app);
const io = createSocketServer(httpServer);
registerSocketHandlers(io);
app.locals.io = io;

httpServer.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
