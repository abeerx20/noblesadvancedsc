import { Router } from "express";
import * as controller from "../controllers/siteSettingsController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { siteSettingsSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const siteSettingsRoutes = Router();
siteSettingsRoutes.get("/", asyncHandler(controller.index));
siteSettingsRoutes.use(authenticate);
siteSettingsRoutes.put(
    "/",
    requireRole("system_admin", "principal", "vice_principal", "admin", "upper_management"),
    requirePermission("manage_announcements"),
    validate(siteSettingsSchema),
    asyncHandler(controller.update)
);
