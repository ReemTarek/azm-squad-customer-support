import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

// Anchored to process.cwd() (not __dirname) because __dirname shifts between
// dev (`tsx watch src/index.ts`, __dirname = backend/src/lib) and the
// production start path (`node dist/src/index.js`, __dirname =
// backend/dist/src/lib) — resolving from __dirname would silently point
// uploads at backend/dist/uploads in production and wipe them on any
// `rm -rf dist && npm run build`. Both start paths run with backend/ as the
// process's working directory, so process.cwd() is stable across both.
export const UPLOAD_DIR = path.resolve(
  process.cwd(),
  env.nodeEnv === "test" ? "uploads-test" : "uploads"
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
]);

// Extensions permitted alongside the MIME allowlist. `file.mimetype` is a
// client-supplied header and trivially spoofable, so relying on it alone
// would let a file named e.g. "payload.exe" through (and back out again via
// res.download with that same extension) as long as the request lied about
// Content-Type. Both checks must pass.
const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".docx",
  ".csv",
  ".txt",
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    if (!ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});
