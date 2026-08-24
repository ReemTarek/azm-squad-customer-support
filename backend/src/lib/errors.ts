export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const Errors = {
  unauthenticated: (message = "Authentication required") =>
    new AppError(401, "UNAUTHENTICATED", message),
  forbidden: (message = "Not allowed to perform this action") =>
    new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Resource not found") =>
    new AppError(404, "NOT_FOUND", message),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  validation: (message: string, details?: unknown) =>
    new AppError(400, "VALIDATION_ERROR", message, details),
  aiUnavailable: (message = "AI assistant is currently unavailable") =>
    new AppError(503, "AI_UNAVAILABLE", message),
};
