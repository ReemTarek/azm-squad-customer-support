import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

export default async function globalSetup() {
  const backendDir = path.resolve(__dirname, "..");
  // The datasource url in schema.prisma ("file:./test.db") is a relative
  // sqlite path, which both the Prisma CLI and the generated client resolve
  // relative to the schema file's directory (backend/prisma/), not the
  // backend root — so the actual db file lives at backend/prisma/test.db.
  const dbPath = path.join(backendDir, "prisma", "test.db");
  if (existsSync(dbPath)) rmSync(dbPath);
  const journalPath = `${dbPath}-journal`;
  if (existsSync(journalPath)) rmSync(journalPath);

  execSync("npx prisma migrate deploy", {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });
}
