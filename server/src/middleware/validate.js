import { AppError } from "../utils/AppError.js";

export function validate(schema, source = "body") {
  return function validationMiddleware(req, _res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));
      return next(new AppError(422, "VALIDATION_ERROR", "تحققي من الحقول المطلوبة والقيم المدخلة.", details));
    }
    req.validated = {
      ...(req.validated ?? {}),
      [source]: result.data
    };
    if (source !== "query") {
      req[source] = result.data;
    }
    next();
  };
}
