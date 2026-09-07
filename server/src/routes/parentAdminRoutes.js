import { Router } from "express";
import * as controller from "../controllers/parentAdminController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { parentSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const parentAdminRoutes = Router();
parentAdminRoutes.use(authenticate, requireRole("system_admin"));
parentAdminRoutes.get("/", asyncHandler(controller.index));
parentAdminRoutes.post("/", validate(parentSchema), asyncHandler(controller.create));