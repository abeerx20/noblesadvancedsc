import { auth } from "../config/firebase.js";
import { loadIdentity } from "../services/identityService.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AppError(401, "AUTH_REQUIRED", "يجب تسجيل الدخول للمتابعة.");
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(match[1], true);
  } catch (error) {
    const message = error instanceof Error && error.message?.includes("Could not load the default credentials")
      ? "خدمة Firebase غير مُهيأة في السيرفر. أضف ملف service account الصحيح أو حدّث GOOGLE_APPLICATION_CREDENTIALS."
      : "انتهت جلسة الدخول أو أنها غير صالحة. سجّلي الدخول مرة أخرى.";
    throw new AppError(401, "INVALID_TOKEN", message);
  }

  req.user = await loadIdentity(decodedToken);
  next();
});

