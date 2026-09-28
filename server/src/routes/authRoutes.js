import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as controller from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parentLoginSchema } from "../validators/schemas.js";

export const authRoutes = Router();

const parentLoginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

authRoutes.post("/auth/parent-login", parentLoginLimit, validate(parentLoginSchema), asyncHandler(controller.parentLogin));