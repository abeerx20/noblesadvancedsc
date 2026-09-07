import { Router } from "express";
import * as controller from "../controllers/announcementController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { announcementSchema } from "../validators/schemas.js";
import { idParamSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const announcementRoutes = Router();
announcementRoutes.use(authenticate);
announcementRoutes.get("/", asyncHandler(controller.index));
announcementRoutes.post("/", requirePermission("manage_announcements"), validate(announcementSchema), asyncHandler(controller.create));
announcementRoutes.delete("/:id", requirePermission("manage_announcements"), validate(idParamSchema, "params"), asyncHandler(controller.remove));

