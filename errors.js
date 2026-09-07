import { AppError } from "../utils/AppError.js";

export function notFound(req, _res, next) {
  next(new AppError(404, "NOT_FOUND", `المسار المطلوب غير موجود: ${req.method} ${req.path}`));
}

export function errorHandler(error, req, res, _next) {
  const known = error instanceof AppError;
  const status = known ? error.status : 500;

  if (!known || status >= 500) {
    console.error("REQUEST_FAILED", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      message: error.message
    });
  }

  res.status(status).json({
    success: false,
    error: {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "حدث خطأ غير متوقع. حاولي مرة أخرى لاحقًا.",
      details: known ? error.details : undefined,
      requestId: req.requestId
    }
  });
}

