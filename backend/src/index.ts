import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import customersRouter from "./routes/customers";
import ticketsRouter from "./routes/tickets";
import kbRouter from "./routes/kb";
import reportsRouter from "./routes/reports";
import quickRepliesRouter from "./routes/quickReplies";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/kb", kbRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/quick-replies", quickRepliesRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
