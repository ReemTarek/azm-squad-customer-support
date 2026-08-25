import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

export default async function globalSetup() {
  const backendDir = path.resolve(__dirname, "..");
  // schema.prisma's datasource url is `env("DATABASE_URL")`, and we set
  // DATABASE_URL to the relative sqlite URL "file:./test.db" below. Both the
  // Prisma CLI and the generated client resolve that relative path against
  // the schema file's directory (backend/prisma/), not the backend root —
  // so the actual db file lives at backend/prisma/test.db.
  const dbPath = path.join(backendDir, "prisma", "test.db");
  if (existsSync(dbPath)) rmSync(dbPath);
  const journalPath = `${dbPath}-journal`;
  if (existsSync(journalPath)) rmSync(journalPath);

  const uploadsTestDir = path.join(backendDir, "uploads-test");
  if (existsSync(uploadsTestDir)) rmSync(uploadsTestDir, { recursive: true, force: true });

  execSync("npx prisma migrate deploy", {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}
