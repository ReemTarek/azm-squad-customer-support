import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "../lib/errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File exceeds the 10MB limit" : "Invalid file upload";
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: [{ field: "file", message }],
      },
    });
  }

  if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Unsupported file type",
        details: [{ field: "file", message: "Unsupported file type" }],
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
